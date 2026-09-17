---
name: ai-persona-scheduler
description: >-
  Provides methods for evaluating the user's temporal schedule (Work, Sleep, Study, Busy/DND),
  resolving timezone offsets, and assembling prompt instructions that shape the AI model's tone and persona.
---

# AI Persona & Schedule Skill

This skill dictates how the WhatsApp AI agent determines what the user is doing right now and instructs the LLM accordingly.

## 1. Temporal Resolution Logic

```javascript
export class TemporalScheduleManager {
  constructor(config) {
    this.config = config; // timezone, activeModes, emergencyKeywords
  }

  getCurrentMode() {
    const now = new Date();
    // Format current time into HH:MM and Day of Week according to user timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.config.timezone || 'UTC',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'narrow'
    });

    // Match against configured windows (Work, Sleep, Study)
    // Priority order: Sleep > Study > Work > Default Available
    return this.resolveActiveWindow(now);
  }

  buildSystemPrompt(activeMode, contactProfile = {}) {
    return `
أنت وكيل ذكي ومساعد شخصي للمستخدم على واتساب.
المستخدم حالياً في وضع: [${activeMode.name}].
التعليمات الخاصة بهذا الوقت:
${activeMode.instruction}

القواعد الإضافية:
1. تحدث باللغة واللهجة التي يفضلها المستخدم وتناسب هوية المحادثة.
2. لا تدعِ قدرة المستخدم على الرد الفوري إذا كان نائماً أو في اجتماع عمل أو يدرس.
3. إذا احتوت الرسالة على كلمة طوارئ واضحة، نبه المرسل بأنه تم تسجيل الحالة العاجلة.
4. كن مختصراً وودوداً ولا تطل في الكلام.
    `.trim();
  }
}
```

---

## 2. Dynamic Tone Matrix

- **Work Hours:** Formal, succinct, focused on capturing action items, business hours, and polite delays.
- **Sleep Hours:** Warm, brief, apologetic for the late hour, stating the user will review in the morning.
- **Study Hours:** Encouraging, focused, stating user is in deep focus / research mode and will reply shortly.
