/**
 * HumanTakeoverManager
 * Manages human owner intervention and suppresses AI auto-replies
 * when the account owner is actively messaging a contact directly from their phone.
 */
export class HumanTakeoverManager {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.cooldownMinutes=30] Duration in minutes to suppress bot replies after owner speaks
   */
  constructor(options = {}) {
    const envCooldown = process.env.HUMAN_TAKEOVER_COOLDOWN_MINUTES ? parseInt(process.env.HUMAN_TAKEOVER_COOLDOWN_MINUTES, 10) : 30;
    this.cooldownMs = (options.cooldownMinutes || envCooldown) * 60 * 1000;
    this.takeovers = new Map(); // jid -> { lastOwnerReply: number, active: boolean }
  }

  /**
   * Record that the owner personally replied to this contact
   * @param {string} contactJid
   * @param {number} [timestamp=Date.now()]
   */
  recordOwnerReply(contactJid, timestamp = Date.now()) {
    if (!contactJid) return;
    this.takeovers.set(contactJid, {
      lastOwnerReply: timestamp,
      active: true
    });
    console.log(`[HumanTakeoverManager] 🛑 Human takeover initiated for ${contactJid}. Auto-replies paused for ${this.cooldownMs / 60000} mins.`);
  }

  /**
   * Check if human takeover is currently active for this contact
   * @param {string} contactJid
   * @param {number} [now=Date.now()]
   * @returns {boolean}
   */
  isTakeoverActive(contactJid, now = Date.now()) {
    if (!contactJid) return false;
    const record = this.takeovers.get(contactJid);
    if (!record || !record.active) return false;

    const elapsed = now - record.lastOwnerReply;
    if (elapsed < this.cooldownMs) {
      return true;
    }

    // Cooldown expired, automatically release takeover
    record.active = false;
    return false;
  }

  /**
   * Explicitly release human takeover to allow AI to respond again
   * @param {string} contactJid
   */
  releaseTakeover(contactJid) {
    if (!contactJid) return;
    if (this.takeovers.has(contactJid)) {
      this.takeovers.get(contactJid).active = false;
      console.log(`[HumanTakeoverManager] ▶️ Human takeover released for ${contactJid}. AI auto-replies resumed.`);
    }
  }

  /**
   * Get all active takeovers
   * @param {number} [now=Date.now()]
   * @returns {Array<{ jid: string, remainingMinutes: number }>}
   */
  getActiveTakeovers(now = Date.now()) {
    const active = [];
    for (const [jid, record] of this.takeovers.entries()) {
      if (record.active) {
        const remaining = Math.max(0, Math.ceil((this.cooldownMs - (now - record.lastOwnerReply)) / 60000));
        if (remaining > 0) {
          active.push({ jid, remainingMinutes: remaining });
        } else {
          record.active = false;
        }
      }
    }
    return active;
  }
}
