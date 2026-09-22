/**
 * Looping Engineering: Message Debouncer & Aggregator
 * Gathers rapid consecutive messages into a single conversational turn
 */
export class MessageDebounceManager {
  constructor(debounceMs = 3500, onBatchReady) {
    this.debounceMs = debounceMs;
    this.onBatchReady = onBatchReady;
    this.buffers = new Map(); // senderJid -> { timer, messages: [], isAudio: boolean }
  }

  /**
   * Enqueues an incoming message from a sender
   * @param {Object} item
   * @param {string} item.senderJid
   * @param {string} item.senderName
   * @param {string} item.text
   * @param {boolean} [item.isAudio=false]
   * @param {any} [item.rawMessage]
   */
  enqueue(item) {
    const { senderJid } = item;
    let entry = this.buffers.get(senderJid);

    if (!entry) {
      entry = {
        timer: null,
        senderJid,
        senderName: item.senderName,
        messages: [],
        hasAudio: false,
        rawMessages: []
      };
      this.buffers.set(senderJid, entry);
    }

    if (item.text) {
      entry.messages.push(item.text);
    }
    if (item.isAudio) {
      entry.hasAudio = true;
    }
    if (item.rawMessage) {
      entry.rawMessages.push(item.rawMessage);
    }

    if (item.isSelfAdmin) {
      entry.isSelfAdmin = true;
    }

    // Reset timer on every new burst
    if (entry.timer) {
      clearTimeout(entry.timer);
    }

    const waitDelay = entry.isSelfAdmin ? 600 : this.debounceMs;

    entry.timer = setTimeout(() => {
      this.buffers.delete(senderJid);
      const combinedText = entry.messages.join(' ').trim();

      if (typeof this.onBatchReady === 'function') {
        Promise.resolve(
          this.onBatchReady({
            senderJid,
            senderName: entry.senderName,
            text: combinedText,
            isAudio: entry.hasAudio,
            isSelfAdmin: Boolean(entry.isSelfAdmin),
            rawMessages: entry.rawMessages
          })
        ).catch((err) => {
          console.error(`[MessageDebounceManager] Unhandled batch processing error for ${senderJid}:`, err);
        });
      }
    }, waitDelay);
  }

  cancel(senderJid) {
    if (!senderJid) return;
    const entry = this.buffers.get(senderJid);
    if (entry) {
      if (entry.timer) clearTimeout(entry.timer);
      this.buffers.delete(senderJid);
      console.log(`[MessageDebounceManager] ⏹️ Cancelled pending debounce batch for ${senderJid}`);
    }
  }

  clear() {
    for (const entry of this.buffers.values()) {
      if (entry.timer) clearTimeout(entry.timer);
    }
    this.buffers.clear();
  }
}
