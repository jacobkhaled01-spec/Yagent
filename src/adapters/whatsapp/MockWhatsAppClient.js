import { IWhatsAppClient } from '../../domain/ports/IWhatsAppClient.js';

/**
 * MockWhatsAppClient
 * Simulates WhatsApp client for dry-runs, local verification, and automated tests
 */
export class MockWhatsAppClient extends IWhatsAppClient {
  constructor() {
    super();
    this.sentMessages = [];
    this.sentVoiceNotes = [];
    this.presenceUpdates = [];
    this.messageHandler = null;
    this.contacts = new Map();
  }

  findContactByName(query) {
    if (!query) return null;
    const cleanQuery = query.toLowerCase().trim().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
    const digitsOnly = query.replace(/\D/g, '');

    for (const c of this.contacts.values()) {
      const normName = (c.name || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
      if (digitsOnly.length >= 4 && c.phone.includes(digitsOnly)) {
        return c;
      }
      if (normName && cleanQuery && (normName.includes(cleanQuery) || cleanQuery.includes(normName))) {
        return c;
      }
    }
    return null;
  }

  async connect() {
    console.log('[MockWhatsAppClient] Connected in Mock/Dry-Run Mode (No real socket).');
  }

  async sendMessage(to, text) {
    const record = { to, text, timestamp: new Date() };
    this.sentMessages.push(record);
    console.log(`\n[MockWhatsAppClient -> Sent Text to ${to}]:\n"${text}"\n`);
    return { status: 'mock_sent', ...record };
  }

  async sendVoiceNote(to, audioSource) {
    const record = { to, audioSource, timestamp: new Date() };
    this.sentVoiceNotes.push(record);
    console.log(`\n[MockWhatsAppClient -> Sent Voice Note to ${to}]: File: ${audioSource}\n`);
    return { status: 'mock_voice_sent', ...record };
  }

  async sendPresenceUpdate(to, presence) {
    this.presenceUpdates.push({ to, presence, timestamp: new Date() });
    console.log(`[MockWhatsAppClient -> Presence Update (${to})]: ${presence}`);
  }

  onMessageReceived(handler) {
    this.messageHandler = handler;
  }

  /**
   * Helper to inject synthetic inbound message for testing
   */
  async simulateInboundMessage(from, text, options = {}) {
    if (this.messageHandler) {
      console.log(`\n--- [Simulating Inbound Message from ${from}]: "${text}" ---`);
      await this.messageHandler({
        senderJid: from,
        senderName: options.name || 'Test User',
        text,
        isAudio: Boolean(options.isAudio),
        isGroup: Boolean(options.isGroup),
        isBroadcast: Boolean(options.isBroadcast)
      });
    }
  }
}
