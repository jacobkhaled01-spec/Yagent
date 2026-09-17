import { ILLMProvider } from '../../domain/ports/ILLMProvider.js';

/**
 * FreeSmartAIProvider
 * High-performance, zero-cost, zero-API-key AI provider powered by state-of-the-art open models (OpenAI / Qwen)
 */
export class FreeSmartAIProvider extends ILLMProvider {
  constructor(options = {}) {
    super();
    this.endpoint = options.endpoint || 'https://text.pollinations.ai/';
    this.model = options.model || 'openai';
  }

  async generateResponse({ senderJid, senderName, incomingText, scheduleContext, persona, conversationHistory }) {
    const ownerName = persona?.ownerName || 'يعقوب المهاجري';
    const modeName = scheduleContext?.name || 'متاح';
    const instruction = scheduleContext?.instruction || '';
    const tone = scheduleContext?.tone || 'طبيعي ومهذب';

    const systemPrompt = `
أنت المساعد الشخصي الذكي لـ "${ownerName}" على واتساب.
المستخدم حالياً في وضع: [${modeName}].
التعليمات الخاصة بهذا الوضع: ${instruction}.
الأسلوب والنبرة المطلوبة: ${tone}.

القواعد الإلزامية التي يجب تطبيقها في كل رد:
1. تحدث باللغة العربية بأسلوب راقٍ، مهذب، ومريح جداً كإنسان مساعد موثوق.
2. طمئن الشخص تماماً وأشعره بالاهتمام: أخبره أنك استلمت ما تفضل به، وأنك ستتواصل مع ${ownerName} وتطلعه على ما يريد بالتفصيل.
3. أكد له بوضوح أن ${ownerName} سيأتي ويرد عليه شخصياً فور أن يكون متاحاً.
4. وضح باختصار ظرف ${ownerName} الحالي (مثلاً في العمل أو نائم أو يدرس) باعتذار لطيف.
5. لا تقدم وعوداً بمواعيد محددة لم يحددها ${ownerName}.
6. اجعل الرد مختصراً، دافئاً، ومناسباً لرسائل الواتساب.
    `.trim();

    let userPrompt = incomingText;
    if (conversationHistory) {
      userPrompt = `[سياق المحادثة السابقة مع المتصل]:\n${conversationHistory}\n\n[رسالة المتصل الحالية]:\n"${incomingText}"\n\nرد عليه بذكاء مع مراعاة كامل سياق الحوار السابق:`;
    }

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          model: this.model,
          seed: Math.floor(Math.random() * 100000)
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const text = await response.text();
      return text.trim();
    } catch (error) {
      console.warn('[FreeSmartAIProvider] Generation fallback triggered:', error.message);
      return `أهلاً بك! تم استلام رسالتك وسأقوم بإطلاع ${ownerName} على طلبك، وسيتواصل معك ويرد عليك شخصياً فور أن يكون متاحاً إن شاء الله.`;
    }
  }

  async evaluateAndRefine({ incomingText, candidateReply, scheduleContext }) {
    const systemPrompt = `
أنت مدقق أمان ونقد ذاتي لرسائل المساعد الذكي على واتساب.
الوضع الحالي للمستخدم: "${scheduleContext?.name}" (${scheduleContext?.instruction}).

تحقق: هل يتعارض الرد المقترح مع الوضع الحالي (مثلاً يعد باتصال فوري وهو نائم أو في اجتماع)؟
أجب بسطرين فقط:
سطر 1: إما "PASSED" أو "FAILED: [السبب]"
سطر 2: الرد المصحح إذا كان FAILED
    `.trim();

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `الرسالة المستلمة: "${incomingText}"\nالرد المقترح: "${candidateReply}"` }
          ],
          model: this.model
        })
      });

      if (!response.ok) return { passed: true, refinedReply: candidateReply };

      const text = await response.text();
      const lines = text.trim().split('\n').map((l) => l.trim()).filter(Boolean);

      if (lines[0]?.startsWith('PASSED')) {
        return { passed: true, refinedReply: candidateReply };
      } else if (lines.length > 1) {
        return { passed: false, reason: lines[0], refinedReply: lines.slice(1).join('\n') };
      }

      return { passed: true, refinedReply: candidateReply };
    } catch {
      return { passed: true, refinedReply: candidateReply };
    }
  }

  async interpretAdminCommand({ incomingText, scheduleContext, auditHistory, persona }) {
    const ownerName = persona?.ownerName || 'يعقوب المهاجري';
    const totalEscalations = auditHistory?.length || 0;

    const systemPrompt = `
أنت المساعد الشخصي الذكي لـ "${ownerName}" على واتساب.
المالك يتحدث معك الآن في محادثته الخاصة (Message Yourself / Admin Mode).
افهم قصد المالك ونفذه بذكاء:
1. إذا طلب تفعيل وضع معين:
   - وضع النوم (أو قال: بنام، تعبان، نعسان): حدد [MODE:sleep]
   - وضع العمل (أو قال: دوام، اجتماع، شغل): حدد [MODE:work]
   - وضع المذاكرة (أو قال: بذاكر، دراسة، اختبار): حدد [MODE:study]
   - العودة للوضع الطبيعي (أو قال: تلقائي، متاح): حدد [MODE:null]
2. إذا طلب تقريراً أو ملخصاً للرسائل: اذكر له ملخص الحالات العاجلة (${totalEscalations} حالة مسجلة).
3. صغ رداً ذكياً ودوداً ومختصراً يؤكد له ما تم فهمه وتنفيذه.

التنسيق الإلزامي للرد:
[MODE:sleep/work/study/null/none]
نص ردك الودود والمباشر لـ ${ownerName}.
    `.trim();

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: incomingText }
          ],
          model: this.model
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const raw = await response.text();
      let setMode = undefined;
      let replyText = raw;

      const modeMatch = raw.match(/\[MODE:(sleep|work|study|null|none)\]/i);
      if (modeMatch) {
        const val = modeMatch[1].toLowerCase();
        if (val === 'null') setMode = null;
        else if (val !== 'none') setMode = val;

        replyText = raw.replace(modeMatch[0], '').trim();
      }

      return {
        reply: replyText,
        setMode
      };
    } catch (error) {
      console.warn('[FreeSmartAIProvider] interpretAdminCommand error:', error.message);
      return {
        reply: null
      };
    }
  }
}
