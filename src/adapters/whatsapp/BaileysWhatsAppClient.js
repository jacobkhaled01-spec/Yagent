import fs from 'fs';
import path from 'path';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import { IWhatsAppClient } from '../../domain/ports/IWhatsAppClient.js';

/**
 * BaileysWhatsAppClient
 * Production-ready WhatsApp Web client using headless WebSockets
 */
export class BaileysWhatsAppClient extends IWhatsAppClient {
  constructor(options = {}) {
    super();
    this.sessionDir = options.sessionDir || './baileys_auth_info';
    this.sock = null;
    this.messageHandler = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.msgCache = new Map();
    this.sentMessageIds = new Set();
    this.contacts = new Map(); // jid -> { jid, name, phone }
  }

  async connect() {
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);
    const logger = pino({ level: 'silent' });

    this.sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      printQRInTerminal: false,
      logger,
      syncFullHistory: false, // Do not sync past history into RAM
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      getMessage: async (key) => {
        if (this.msgCache.has(key.id)) {
          return this.msgCache.get(key.id);
        }
        return undefined;
      }
    });

    this.sock.ev.on('creds.update', saveCreds);

    this.sock.ev.on('contacts.upsert', (contacts) => {
      if (!Array.isArray(contacts)) return;
      for (const c of contacts) {
        if (c.id && (c.name || c.notify || c.verifiedName)) {
          this.contacts.set(c.id, {
            jid: c.id,
            name: c.name || c.notify || c.verifiedName,
            phone: c.id.split('@')[0]
          });
        }
      }
    });

    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n======================================================');
        console.log('📌 Scan this QR code with your WhatsApp (Linked Devices):');
        console.log('======================================================\n');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isRestart = statusCode === DisconnectReason.restartRequired || statusCode === 515;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`[BaileysWhatsAppClient] Connection closed. Reason code: ${statusCode}`);

        // Destroy old socket listeners to prevent duplicate socket conflicts
        if (this.sock) {
          try {
            this.sock.ev.removeAllListeners();
            this.sock.end?.();
          } catch {}
          this.sock = null;
        }

        if (isRestart) {
          console.log('[BaileysWhatsAppClient] Stream restart required by WhatsApp (515). Reconnecting cleanly...');
          setTimeout(() => this.connect(), 1500);
          return;
        }

        if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = Math.min(Math.pow(2, this.reconnectAttempts) * 1000, 10000);
          console.log(`[BaileysWhatsAppClient] Reconnecting in ${delay}ms (Attempt ${this.reconnectAttempts})...`);
          setTimeout(() => this.connect(), delay);
        } else if (!shouldReconnect) {
          console.log('⚠️ [BaileysWhatsAppClient] Session was logged out (401). Resetting session files to generate a fresh QR code...');
          try {
            if (fs.existsSync(this.sessionDir)) {
              fs.rmSync(this.sessionDir, { recursive: true, force: true });
            }
          } catch (e) {
            console.warn('Failed to clear session dir:', e.message);
          }
          console.log('🔄 Generating fresh QR code for linking...');
          setTimeout(() => this.connect(), 1000);
        }
      } else if (connection === 'open') {
        this.reconnectAttempts = 0;
        const myUser = this.sock?.user;
        const myNumber = myUser?.id?.split(':')[0];
        console.log(`\n================================================================`);
        console.log(`✅ [BaileysWhatsAppClient] WhatsApp Web Connection successfully active!`);
        console.log(`📱 Connected as: +${myNumber || 'User'}`);
        console.log(`💬 You can now send commands to yourself on WhatsApp or receive auto-replies!`);
        console.log(`================================================================\n`);
      }
    });

    this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      // Allow both 'notify' (external incoming) and 'append' (self messages / synced from phone)
      if (type !== 'notify' && type !== 'append') return;

      const myPhone = this.sock?.user?.id?.split(':')[0]?.split('@')[0];
      const myLid = this.sock?.user?.lid?.split(':')[0]?.split('@')[0];

      for (const msg of messages) {
        const remoteJid = msg.key?.remoteJid;
        if (!remoteJid) continue;

        // Skip WhatsApp Status broadcasts completely
        if (remoteJid === 'status@broadcast' || remoteJid.endsWith('@broadcast')) {
          continue;
        }

        const isGroup = remoteJid.endsWith('@g.us');
        const isBroadcast = false;

        // Check if message is in the user's self chat (Message Yourself)
        const isSelfChat = Boolean(
          (myPhone && remoteJid.includes(myPhone)) ||
          (myLid && remoteJid.includes(myLid))
        );

        // Skip outbound messages sent by the user to other contacts
        if (msg.key.fromMe && !isSelfChat) {
          continue;
        }

        // Unwrap content from ephemeral or view-once containers
        let content = msg.message;
        if (!content) continue;

        if (content.ephemeralMessage) content = content.ephemeralMessage.message;
        if (content.viewOnceMessage) content = content.viewOnceMessage.message;
        if (content.viewOnceMessageV2) content = content.viewOnceMessageV2.message;
        if (content.documentWithCaptionMessage) content = content.documentWithCaptionMessage.message;

        let text = '';
        let isAudio = false;

        if (content.conversation) {
          text = content.conversation;
        } else if (content.extendedTextMessage?.text) {
          text = content.extendedTextMessage.text;
        } else if (content.audioMessage) {
          isAudio = true;
          text = '[Voice Note]';
        }

        // 1. Skip messages generated by this bot instance (by ID)
        if (this.sentMessageIds && this.sentMessageIds.has(msg.key?.id)) {
          this.sentMessageIds.delete(msg.key.id);
          continue;
        }

        // 2. Drop any empty message (receipts, reactions, status updates, sync events)
        if (!isAudio && (!text || text.trim() === '')) {
          continue;
        }

        // 3. Skip messages generated by this bot instance (by text content echo in self-chat)
        const cleanText = text.trim();
        if (isSelfChat && this.sentTexts && this.sentTexts.has(cleanText)) {
          continue;
        }

        if (msg.key.fromMe && msg.key?.id?.startsWith('BAE5')) {
          continue;
        }

        const targetJid = isSelfChat && myPhone ? `${myPhone}@s.whatsapp.net` : remoteJid;

        console.log(`\n📩 [Message Arrived] From: ${targetJid} | Name: ${msg.pushName || 'User'} | IsSelf: ${isSelfChat} | Text: "${text}"`);

        if (this.messageHandler) {
          this.messageHandler({
            senderJid: targetJid,
            senderName: isSelfChat ? 'المالك (أنت)' : (msg.pushName || 'WhatsApp User'),
            text: text.trim(),
            isAudio,
            isGroup,
            isBroadcast,
            isSelfAdmin: isSelfChat,
            rawMessage: msg
          });
        }
      }
    });
  }

  async sendMessage(to, text) {
    if (!this.sock) throw new Error('WhatsApp client is not connected.');

    // Track sent text to prevent self-chat echo loops
    if (typeof text === 'string' && text.trim()) {
      if (!this.sentTexts) this.sentTexts = new Set();
      this.sentTexts.add(text.trim());
      if (this.sentTexts.size > 200) {
        const oldest = this.sentTexts.values().next().value;
        this.sentTexts.delete(oldest);
      }
    }

    const result = await this.sock.sendMessage(to, { text });
    if (result?.key?.id) {
      if (!this.sentMessageIds) this.sentMessageIds = new Set();
      this.sentMessageIds.add(result.key.id);
      if (result.message) {
        this.msgCache.set(result.key.id, result.message);
      }
    }
    return result;
  }

  async sendVoiceNote(to, audioSource) {
    if (!this.sock) throw new Error('WhatsApp client is not connected.');

    let audioBuffer;
    if (typeof audioSource === 'string') {
      audioBuffer = fs.readFileSync(audioSource);
    } else {
      audioBuffer = audioSource;
    }

    const result = await this.sock.sendMessage(to, {
      audio: audioBuffer,
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true // Mark as Push-To-Talk Voice Note
    });

    if (result?.key?.id) {
      if (!this.sentMessageIds) this.sentMessageIds = new Set();
      this.sentMessageIds.add(result.key.id);
      if (result.message) {
        this.msgCache.set(result.key.id, result.message);
      }
    }
    return result;
  }

  async sendPresenceUpdate(to, presence) {
    if (!this.sock) return;
    try {
      await this.sock.sendPresenceUpdate(presence, to);
    } catch {}
  }

  findContactByName(query) {
    if (!query) return null;
    const cleanQuery = query.toLowerCase().trim().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/-/g, ' ');
    const digitsOnly = query.replace(/\D/g, '');

    const TRANSLITERATIONS = [
      { ar: 'محمد', en: ['mohammed', 'mohamed', 'muhammad', 'mhmd'] },
      { ar: 'حضرمي', en: ['hadrami', 'hadhrami', 'hadramy'] },
      { ar: 'احمد', en: ['ahmed', 'ahmad'] },
      { ar: 'خالد', en: ['khaled', 'khalid'] },
      { ar: 'سقاف', en: ['saggaf', 'alsaggaf', 'saqqaf'] },
      { ar: 'علي', en: ['ali'] },
      { ar: 'عبدالله', en: ['abdullah', 'abdallah'] },
      { ar: 'صالح', en: ['saleh', 'salih'] }
    ];

    for (const c of this.contacts.values()) {
      const normName = (c.name || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/-/g, ' ');
      if (digitsOnly.length >= 4 && c.phone.includes(digitsOnly)) {
        return c;
      }
      if (normName && cleanQuery && (normName.includes(cleanQuery) || cleanQuery.includes(normName))) {
        return c;
      }

      for (const t of TRANSLITERATIONS) {
        const qHasEn = t.en.some((e) => cleanQuery.includes(e));
        const cHasAr = normName.includes(t.ar);
        if (qHasEn && cHasAr) return c;

        const qHasAr = cleanQuery.includes(t.ar);
        const cHasEn = t.en.some((e) => normName.includes(e));
        if (qHasAr && cHasEn) return c;
      }
    }
    return null;
  }

  onMessageReceived(handler) {
    this.messageHandler = handler;
  }
}
