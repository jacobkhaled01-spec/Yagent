/**
 * TemporalScheduler
 * Resolves current user status, temporal mode, and emergency conditions
 */
export class TemporalScheduler {
  constructor(scheduleConfig) {
    this.config = scheduleConfig;
    this.manualModeOverride = null;
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
