import { ILLMProvider } from '../../domain/ports/ILLMProvider.js';

/**
 * GeminiFreeProvider
 * Connects to Google Gemini Free Tier API via direct REST calls
 */
export class GeminiFreeProvider extends ILLMProvider {
  constructor(apiKey = process.env.GEMINI_API_KEY, modelName = 'gemini-1.5-flash') {
    super();
    this.apiKey = apiKey;
    this.modelName = modelName;
  }

  async generateResponse({ incomingText, scheduleContext, persona }) {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in .env');
    }

    const systemInstruction = `
أنت المساعد الشخصي الذكي لـ "${persona?.ownerName || 'المستخدم'}".
الحالة الزمنية الحالية: ${scheduleContext?.name}.
التعليمات الخاصة بالحالة: ${scheduleContext?.instruction}.
الأسلوب والنبرة: ${scheduleContext?.tone}.
القواعد:
${(persona?.generalRules || []).map((r) => `- ${r}`).join('\n')}
    `.trim();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: 'user', parts: [{ text: incomingText }] }]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errBody}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  }

  async evaluateAndRefine({ incomingText, candidateReply, scheduleContext }) {
    if (!this.apiKey) return { passed: true, refinedReply: candidateReply };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
    const prompt = `
قيّم الرد المقترح عبر واتساب بناءً على حالة المستخدم:
الرسالة المستلمة: "${incomingText}"
الرد المقترح: "${candidateReply}"
الحالة: "${scheduleContext?.name}" - ${scheduleContext?.instruction}

أجب بصيغة JSON فقط:
{"passed": true/false, "reason": "...", "refinedReply": "..."}
    `.trim();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: { responseMimeType: 'application/json' },
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) return { passed: true, refinedReply: candidateReply };

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(rawText);
      return {
        passed: Boolean(parsed.passed),
        reason: parsed.reason,
        refinedReply: parsed.refinedReply || candidateReply
      };
    } catch {
      return { passed: true, refinedReply: candidateReply };
    }
  }

  async interpretAdminCommand({ incomingText, scheduleContext, auditHistory, persona }) {
    if (!this.apiKey) {
      return {
        reply: `أهلاً بك يا ${persona?.ownerName || 'المستخدم'}. يرجى إضافة GEMINI_API_KEY في ملف .env لتفعيل الفهم الذكي المتقدم.`
      };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
    const prompt = `
أنت المساعد الشخصي الذكي لـ "${persona?.ownerName || 'المستخدم'}".
المالك يتحدث معك الآن في واتساب ويقول لك:
"${incomingText}"

افهم قصد المالك جيداً:
1. هل يريد تغيير وضع الردود التلقائية؟
   - إذا أراد وضع النوم (أو ذكر أنه سينام/تعبان): setMode = "sleep"
   - إذا أراد وضع العمل (أو اجتماع/دوام/شغل): setMode = "work"
   - إذا أراد وضع المذاكرة (أو دراسة/تركيز/امتحان): setMode = "study"
   - إذا أراد العودة للوضع الطبيعي التلقائي: setMode = null
2. صغ رداً ذكياً ولبقاً ومؤدباً باللغة العربية يؤكد له تنفيذ ما طلب، ويعطيه ملخصاً إن طلب تقريراً.

أجب بصيغة JSON فقط:
{
  "setMode": "sleep" | "work" | "study" | null,
  "reply": "نص ردك الذكي على المالك"
}
    `.trim();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationConfig: { responseMimeType: 'application/json' },
          contents: [{ role: 'user', parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) {
        return { reply: `أهلاً بك يا ${persona?.ownerName || 'سيدي'}! تلقيت رسالتك: "${incomingText}".` };
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(rawText);
      return {
        reply: parsed.reply || `تم استلام أمرك يا سيدي!`,
        setMode: parsed.setMode || null
      };
    } catch (err) {
      return { reply: `أهلاً بك! تم استلام رسالتك: "${incomingText}".` };
    }
  }
}
