import { ILLMProvider } from '../../domain/ports/ILLMProvider.js';

/**
 * OllamaProvider
 * Connects to local Ollama instance (e.g. Llama 3, DeepSeek, Qwen)
 */
export class OllamaProvider extends ILLMProvider {
  constructor(options = {}) {
    super();
    this.host = options.host || process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
    this.model = options.model || process.env.OLLAMA_MODEL || 'llama3:latest';
  }

  async generateResponse({ incomingText, scheduleContext, persona }) {
    const systemPrompt = `
أنت المساعد الشخصي الذكي لـ "${persona?.ownerName || 'المستخدم'}".
الحالة الزمنية الحالية: ${scheduleContext?.name}.
التعليمات الخاصة بالحالة: ${scheduleContext?.instruction}.
الأسلوب والنبرة: ${scheduleContext?.tone}.

القواعد:
${(persona?.generalRules || []).map((r) => `- ${r}`).join('\n')}
    `.trim();

    const response = await fetch(`${this.host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: incomingText,
        system: systemPrompt,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.response ? data.response.trim() : '';
  }

  async evaluateAndRefine({ incomingText, candidateReply, scheduleContext }) {
    const critiquePrompt = `
راجع الرد المقترح التالي المرسل عبر واتساب:
الرسالة الواردة: "${incomingText}"
الرد المقترح: "${candidateReply}"
الحالة الزمنية الحالية: "${scheduleContext?.name}" (${scheduleContext?.instruction})

هل يتوافق الرد بدقة مع الحالة الزمنية وبدون تقديم وعود مستحيلة؟
أجب بصيغة JSON فقط:
{"passed": true/false, "reason": "سبب التقييم", "refinedReply": "الرد بعد التصحيح إن لزم"}
    `.trim();

    try {
      const response = await fetch(`${this.host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: critiquePrompt,
          stream: false,
          format: 'json'
        })
      });

      if (!response.ok) return { passed: true, refinedReply: candidateReply };

      const data = await response.json();
      const parsed = JSON.parse(data.response);
      return {
        passed: Boolean(parsed.passed),
        reason: parsed.reason,
        refinedReply: parsed.refinedReply || candidateReply
      };
    } catch {
      return { passed: true, refinedReply: candidateReply };
    }
  }
}
