import fs from 'fs';
import path from 'path';

/**
 * ExecutiveBriefingStore
 * Stores and structures executive briefing cards for the owner (Yaaqob).
 * Organizes who contacted him, their main request/topic, the time, and the response given.
 */
export class ExecutiveBriefingStore {
  constructor(options = {}) {
    this.maxEntries = options.maxEntries || 100;
    this.filePath = options.filePath || './data/briefings.json';
    this.entries = new Map(); // senderJid -> BriefingCard
    this.#loadFromFile();
  }

  #loadFromFile() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((item) => {
            if (item?.senderJid) {
              item.lastContactAt = new Date(item.lastContactAt || Date.now());
              this.entries.set(item.senderJid, item);
            }
          });
        }
      }
    } catch {}
  }

  #saveToFile() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const list = Array.from(this.entries.values());
      fs.writeFileSync(this.filePath, JSON.stringify(list, null, 2), 'utf-8');
    } catch {}
  }

  /**
   * Records or updates a briefing card for a contact
   */
  recordInteraction({ senderJid, senderName, incomingText, replyText, isEmergency = false }) {
    if (!senderJid) return;

    const existing = this.entries.get(senderJid) || {
      senderJid,
      senderName: senderName || senderJid.split('@')[0],
      phone: senderJid.split('@')[0],
      firstContactAt: new Date(),
      lastContactAt: new Date(),
      messagesCount: 0,
      recentMessages: [],
      lastReply: '',
      isEmergency: false
    };

    existing.senderName = senderName || existing.senderName;
    existing.lastContactAt = new Date();
    existing.messagesCount += 1;
    existing.recentMessages.push(incomingText);
    if (existing.recentMessages.length > 5) existing.recentMessages.shift();
    existing.lastReply = replyText;
    if (isEmergency) existing.isEmergency = true;

    // LRU eviction
    if (this.entries.size >= this.maxEntries && !this.entries.has(senderJid)) {
      const oldestKey = this.entries.keys().next().value;
      this.entries.delete(oldestKey);
    }

    this.entries.set(senderJid, existing);
    this.#saveToFile();
  }

  /**
   * Generates a structured executive digest for Yaaqob
   */
  generateExecutiveDigest(ownerName = 'يعقوب المهاجري') {
    const cards = Array.from(this.entries.values());

    if (cards.length === 0) {
      return `📋 **التقرير التنفيذي يا ${ownerName}:**\n\nلم تتلقَ أي رسائل جديدة حتى الآن. كل شيء هادئ ومنظم 🟢.`;
    }

    let report = `📋 **التقرير التنفيذي لرسائل اليوم يا ${ownerName}:**\n`;
    report += `📊 إجمالي جهات الاتصال التي تواصلت معك: **${cards.length} أشخاص**.\n\n`;

    const emergencies = cards.filter((c) => c.isEmergency);
    if (emergencies.length > 0) {
      report += `🚨 **تنبيهات عاجلة ذات أولوية قصوى (${emergencies.length}):**\n`;
      emergencies.forEach((c, idx) => {
        const timeStr = c.lastContactAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
        report += `${idx + 1}. **${c.senderName}** (${c.phone}) - [${timeStr}]:\n`;
        report += `   • طلبه الأخير: "${c.recentMessages[c.recentMessages.length - 1]}"\n`;
        report += `   • الإجراء: تم إشعاره بتسجيل الحالة العاجلة وإبلاغك فوراً.\n`;
      });
      report += '\n';
    }

    const regulars = cards.filter((c) => !c.isEmergency);
    if (regulars.length > 0) {
      report += `💬 **المحادثات الواردة (${regulars.length}):**\n`;
      regulars.forEach((c, idx) => {
        const timeStr = c.lastContactAt.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
        const lastMsg = c.recentMessages[c.recentMessages.length - 1];
        report += `${idx + 1}. **${c.senderName}** (${c.phone}) - [${timeStr}]:\n`;
        report += `   • المحتوى: "${lastMsg}"\n`;
        report += `   • الموقف: طمأنته بأنك ستطلع على رسالته وتتواصل معه شخصياً فور أن تكون متاحاً.\n`;
      });
    }

    return report.trim();
  }

  /**
   * Finds a contact briefing card by name or phone (Arabic & English matching)
   */
  findContact(query) {
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

    for (const card of this.entries.values()) {
      const normName = (card.senderName || '').toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/-/g, ' ');
      const phoneDigits = (card.phone || '').replace(/\D/g, '');

      if (digitsOnly.length >= 4 && phoneDigits.includes(digitsOnly)) {
        return card;
      }
      if (normName && cleanQuery && (normName.includes(cleanQuery) || cleanQuery.includes(normName))) {
        return card;
      }

      // Cross-lingual matching (e.g. Mohammed alhadrami -> محمد الحضرمي)
      for (const t of TRANSLITERATIONS) {
        const qHasEn = t.en.some((e) => cleanQuery.includes(e));
        const cHasAr = normName.includes(t.ar);
        if (qHasEn && cHasAr) return card;

        const qHasAr = cleanQuery.includes(t.ar);
        const cHasEn = t.en.some((e) => normName.includes(e));
        if (qHasAr && cHasEn) return card;
      }
    }
    return null;
  }

  /**
   * Clear processed briefings (e.g. at the start of a new day)
   */
  clear() {
    this.entries.clear();
  }
}
