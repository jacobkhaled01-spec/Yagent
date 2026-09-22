import fs from 'fs';
import path from 'path';

/**
 * ConversationMemoryStore
 * Manages per-contact conversation history using a memory-optimized ring buffer (LRU).
 * Retains multi-turn dialogue context for every contact.
 */
export class ConversationMemoryStore {
  constructor(options = {}) {
    this.maxMessagesPerContact = options.maxMessagesPerContact || 10;
    this.maxContacts = options.maxContacts || 200;
    this.filePath = options.filePath || './data/conversations.json';
    this.store = new Map(); // senderJid -> Array<{ role: 'user' | 'assistant', text: string, timestamp: Date }>
    this.#loadFromFile();
  }

  #loadFromFile() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const obj = JSON.parse(raw);
        Object.entries(obj).forEach(([jid, msgs]) => {
          if (Array.isArray(msgs)) {
            this.store.set(jid, msgs.map((m) => ({ ...m, timestamp: new Date(m.timestamp || Date.now()) })));
          }
        });
      }
    } catch {}
  }

  #saveToFile() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const obj = Object.fromEntries(this.store.entries());
      fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2), 'utf-8');
    } catch {}
  }

  /**
   * Add a message to a contact's conversation history
   */
  addMessage(senderJid, role, text) {
    if (!senderJid || !text) return;

    if (!this.store.has(senderJid)) {
      // LRU eviction if we exceed maxContacts to prevent RAM bloat
      if (this.store.size >= this.maxContacts) {
        const oldestKey = this.store.keys().next().value;
        this.store.delete(oldestKey);
      }
      this.store.set(senderJid, []);
    }

    const history = this.store.get(senderJid);
    history.push({
      role,
      text: text.trim(),
      timestamp: new Date()
    });

    // Enforce ring-buffer cap
    if (history.length > this.maxMessagesPerContact) {
      history.shift();
    }

    this.#saveToFile();
  }

  /**
   * Alias for addMessage
   */
  recordTurn(senderJid, role, text) {
    return this.addMessage(senderJid, role, text);
  }

  /**
   * Get the dialogue history for a contact
   */
  getHistory(senderJid) {
    return this.store.get(senderJid) || [];
  }

  /**
   * Formats the conversation history into a clean dialogue string for system prompts
   */
  formatHistoryForPrompt(senderJid, contactName = 'المتصل') {
    const history = this.getHistory(senderJid);
    if (!history.length) return '';

    return history.map((msg) => {
      const speaker = msg.role === 'user' ? contactName : 'أنت (المساعد)';
      return `${speaker}: "${msg.text}"`;
    }).join('\n');
  }

  /**
   * Clear history for a specific contact
   */
  clearContact(senderJid) {
    this.store.delete(senderJid);
  }

  /**
   * Total number of active remembered conversations
   */
  get activeConversationsCount() {
    return this.store.size;
  }
}
