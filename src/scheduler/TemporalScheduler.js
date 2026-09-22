import fs from 'fs';
import path from 'path';

/**
 * TemporalScheduler
 * Resolves current user status, temporal mode, and emergency conditions
 */
export class TemporalScheduler {
  constructor(scheduleConfig, storagePath = null) {
    this.config = scheduleConfig;
    this.manualModeOverride = null;
    this.storageFile = storagePath || path.resolve('data', 'custom_status.json');
    this.customStatus = { active: false, text: '', setAt: null };
    this.loadCustomStatus();
  }

  loadCustomStatus() {
    try {
      if (fs.existsSync(this.storageFile)) {
        const raw = fs.readFileSync(this.storageFile, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.text) {
          this.customStatus = {
            active: Boolean(parsed.active),
            text: parsed.text,
            setAt: parsed.setAt || new Date().toISOString()
          };
        }
      }
    } catch (err) {
      console.warn('[TemporalScheduler] Warning loading custom status:', err.message);
    }
  }

  saveCustomStatus() {
    try {
      const dir = path.dirname(this.storageFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storageFile, JSON.stringify(this.customStatus, null, 2), 'utf8');
    } catch (err) {
      console.warn('[TemporalScheduler] Warning saving custom status:', err.message);
    }
  }

  setCustomStatus(text) {
    const cleanText = (text || '').trim();
    if (!cleanText) return;
    this.customStatus = {
      active: true,
      text: cleanText,
      setAt: new Date().toISOString()
    };
    this.manualModeOverride = 'custom';
    this.saveCustomStatus();
  }

  clearCustomStatus() {
    this.customStatus = {
      active: false,
      text: '',
      setAt: null
    };
    if (this.manualModeOverride === 'custom') {
      this.manualModeOverride = null;
    }
    this.saveCustomStatus();
  }

  getCustomStatus() {
    return this.customStatus;
  }

  /**
   * Evaluates the active mode based on current timestamp and message content
   * @param {string} [incomingMessageText='']
   * @param {Date} [currentTime=new Date()]
   * @returns {Object} Active schedule context
   */
  resolveScheduleContext(incomingMessageText = '', currentTime = new Date()) {
    const isEmergency = this.checkEmergency(incomingMessageText);
    const timezone = this.config.timezone || 'Asia/Riyadh';

    // Check dynamic custom status override (highest priority)
    if (this.customStatus && this.customStatus.active && this.customStatus.text) {
      return {
        modeKey: 'custom',
        name: `حالة خاصة (${this.customStatus.text})`,
        tone: 'مهذب جداً، معتذر بلطف، ومطمئن وراقٍ',
        instruction: `المستخدم أبلغ عن ظرفه وحالته الحالية: [${this.customStatus.text}]. وضح للمتصل هذا الظرف باعتذار راقٍ ولطيف لعدم القدرة على الرد المباشر الآن، وطمئنه بأنك استلمت رسالته وسيقوم المستخدم بالرد عليه شخصياً فور تفرغه.`,
        customStatusText: this.customStatus.text,
        isEmergency,
        maxRepliesPerContact: 3,
        allowEmergencyOverride: true
      };
    }

    // Check manual override from user command
    if (this.manualModeOverride && this.config.modes?.[this.manualModeOverride]) {
      const mode = this.config.modes[this.manualModeOverride];
      return {
        modeKey: this.manualModeOverride,
        name: `${mode.name} (يدوي)`,
        tone: mode.tone,
        instruction: mode.instruction,
        isEmergency,
        maxRepliesPerContact: mode.maxRepliesPerContact || 5,
        allowEmergencyOverride: mode.allowEmergencyOverride ?? true
      };
    }

    // Get current time string in HH:MM and weekday (0=Sun, 1=Mon, ..., 6=Sat)
    const timeParts = this.getTimeParts(currentTime, timezone);
    const currentMinutes = timeParts.hour * 60 + timeParts.minute;
    const currentDay = timeParts.day;

    let matchedModeKey = null;
    let matchedModeConfig = null;

    // Check modes in priority order: sleep > work > study
    const modes = this.config.modes || {};
    const priority = ['sleep', 'work', 'study'];

    for (const key of priority) {
      const mode = modes[key];
      if (!mode || !mode.enabled) continue;

      if (mode.days && !mode.days.includes(currentDay)) continue;

      if (this.isTimeWithinRange(currentMinutes, mode.start, mode.end)) {
        matchedModeKey = key;
        matchedModeConfig = mode;
        break;
      }
    }

    if (matchedModeConfig) {
      return {
        modeKey: matchedModeKey,
        name: matchedModeConfig.name,
        tone: matchedModeConfig.tone,
        instruction: matchedModeConfig.instruction,
        isEmergency,
        maxRepliesPerContact: matchedModeConfig.maxRepliesPerContact || 3,
        allowEmergencyOverride: matchedModeConfig.allowEmergencyOverride ?? true
      };
    }

    // Default Available Mode
    const defaultMode = this.config.defaultMode || {
      name: 'Available (متاح)',
      tone: 'طبيعي ومساعد',
      instruction: 'المستخدم متاح حالياً ولكن يتولى الوكيل الرد الأولي لترتيب الأولويات.'
    };

    return {
      modeKey: 'default',
      name: defaultMode.name,
      tone: defaultMode.tone,
      instruction: defaultMode.instruction,
      isEmergency,
      maxRepliesPerContact: 10,
      allowEmergencyOverride: true
    };
  }

  checkEmergency(text) {
    if (!text || typeof text !== 'string') return false;
    const lower = text.toLowerCase();
    const keywords = this.config.emergencyKeywords || ['طارئ', 'urgent', 'ضروري'];
    return keywords.some((kw) => lower.includes(kw.toLowerCase()));
  }

  isTimeWithinRange(currentMinutes, startStr, endStr) {
    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      // Normal daytime range (e.g. 09:00 to 17:00)
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Overnight range (e.g. 23:30 to 07:00)
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }

  getTimeParts(date, timeZone) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric'
      });

      const parts = formatter.formatToParts(date);
      let hour = 0, minute = 0, weekdayStr = '';

      for (const p of parts) {
        if (p.type === 'hour') hour = parseInt(p.value, 10);
        if (p.type === 'minute') minute = parseInt(p.value, 10);
        if (p.type === 'weekday') weekdayStr = p.value;
      }

      // Handle 24:00 edge cases in some locales
      if (hour === 24) hour = 0;

      const daysMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      const day = daysMap[weekdayStr] ?? date.getDay();

      return { hour, minute, day };
    } catch {
      return { hour: date.getHours(), minute: date.getMinutes(), day: date.getDay() };
    }
  }
}
