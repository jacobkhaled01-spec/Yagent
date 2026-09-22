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
    const tone = scheduleContext?.tone || 'طبيعي ومهذب ومطمئن';
    const customStatusText = scheduleContext?.customStatusText;

    const systemPrompt = `
أنت "المساعد الذكي" للمهندس "${ownerName}" على واتساب.
⚠️ تنبيه حاسم: أنت لست "${ownerName}"، بل أنت مساعده الشخصي الذي يدير محادثاته نيابة عنه باحترافية.
ممنوع قطعاً أن تقول "أنا ${ownerName}"، بل تحدث دائماً بصفتك المساعد، مثل: "معك المساعد الشخصي للمهندس ${ownerName}".

الوضع الحالي للمهندس ${ownerName}: [${modeName}].
التعليمات الخاصة بهذا الوضع: ${instruction}.
الأسلوب والنبرة المطلوبة: ${tone}.
${customStatusText ? `📌 تنبيه ظرف ${ownerName} الحالي: أبلغ ${ownerName} بأن حالته هي: [${customStatusText}]. يجب أن تعكس هذا الظرف بلطف شديد للمتصل باعتذار راقٍ (مثال: "المهندس ${ownerName} ${customStatusText} حالياً...") وتطمئنه بأنك استلمت رسالته وسيتواصل معه شخصياً فور فراغه.` : ''}

القواعد الإلزامية التي يجب تطبيقها في كل رد:
1. تحدث باللغة العربية بأسلوب راقٍ، مهذب، ومريح جداً كإنسان مساعد موثوق وودود.
2. طمئن الشخص تماماً وأشعره بالاهتمام البالغ: أخبره أنك استلمت ما تفضل به، وسوف تطلع المهندس ${ownerName} على رسالته بالتفصيل.
3. أكد له بوضوح تام أن المهندس ${ownerName} سيقوم بالرد والتواصل معه شخصياً فور أن يكون متاحاً إن شاء الله.
4. وضح باختصار ظرف المهندس ${ownerName} الحالي باعتذار لطيف ومحترم ومطمئن للمتصل.
5. لا تقدم وعوداً بمواعيد محددة لم يذكرها ${ownerName}.
6. اجعل الرد مختصراً، دافئاً، ومناسباً تماماً لرسائل الواتساب.
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
1. إذا ذكر المالك وضعه أو حالته الخاصة (مثلاً: "انا في المستشفى", "مسافر صنعاء", "عندي اختبار", "مشغول بالورشة", "في اجتماع إلى العصر"):
   حدد [CUSTOM_STATUS: وصف الحالة كما ذكرها المالك]
2. إذا طلب تفعيل وضع معين:
   - وضع النوم (أو قال: بنام، تعبان، نعسان): حدد [MODE:sleep]
   - وضع العمل (أو قال: دوام، اجتماع، شغل): حدد [MODE:work]
   - وضع المذاكرة (أو قال: بذاكر، دراسة، اختبار): حدد [MODE:study]
   - العودة للوضع الطبيعي (أو قال: تلقائي، متاح، فضيت، خلصت): حدد [MODE:null]
3. إذا طلب تقريراً أو ملخصاً للرسائل: اذكر له ملخص الحالات العاجلة (${totalEscalations} حالة مسجلة).
4. صغ رداً ذكياً ودوداً ومختصراً يؤكد له ما تم فهمه وتنفيذه.

التنسيق الإلزامي للرد:
[CUSTOM_STATUS: نص الحالة] (إذا كانت حالة مخصصة)
[MODE:sleep/work/study/null/none] (إذا كان وضعاً عاماً)
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
      let customStatus = undefined;
      let replyText = raw;

      const customMatch = raw.match(/\[CUSTOM_STATUS:\s*([^\]]+)\]/i);
      if (customMatch) {
        customStatus = customMatch[1].trim();
        replyText = replyText.replace(customMatch[0], '').trim();
      }

      const modeMatch = raw.match(/\[MODE:(sleep|work|study|null|none)\]/i);
      if (modeMatch) {
        const val = modeMatch[1].toLowerCase();
        if (val === 'null') setMode = null;
        else if (val !== 'none') setMode = val;

        replyText = raw.replace(modeMatch[0], '').trim();
      }

      return {
        reply: replyText,
        setMode,
        customStatus
      };
    } catch (error) {
      console.warn('[FreeSmartAIProvider] interpretAdminCommand error:', error.message);
      return {
        reply: null
      };
    }
  }
}
