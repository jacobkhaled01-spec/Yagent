import { ILLMProvider } from '../../domain/ports/ILLMProvider.js';
import { FreeSmartAIProvider } from './FreeSmartAIProvider.js';

/**
 * HuggingFaceProvider
 * Connects to Hugging Face Inference API / Pipeline
 * Models: 'Qwen/Qwen2.5-72B-Instruct', 'meta-llama/Llama-3.1-8B-Instruct', etc.
 */
export class HuggingFaceProvider extends ILLMProvider {
  constructor(options = {}) {
    super();
    this.token = options.token || process.env.HF_TOKEN || '';
    this.model = options.model || process.env.HF_MODEL || 'Qwen/Qwen2.5-72B-Instruct';
    this.baseUrl = options.baseUrl || 'https://router.huggingface.co/v1/chat/completions';
    this.fallbackProvider = new FreeSmartAIProvider();
  }

  async #callHfChat(messages, maxTokens = 250) {
    if (!this.token) {
      throw new Error('HF_TOKEN is missing in .env. Please set your free token from https://huggingface.co/settings/tokens');
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`
    };

    const payload = {
      model: this.model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7
    };

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const rawText = await response.text();
      const cleanSummary = rawText.slice(0, 120).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      throw new Error(`Hugging Face API error (${response.status}): ${cleanSummary}`);
    }

    const json = await response.json();
    return json.choices?.[0]?.message?.content?.trim() || '';
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
5. لا تقدم وعوداً بمواعيد محددة لم يذكرها ${ownerName}.
6. اجعل الرد مختصراً، دافئاً، ومناسباً لرسائل الواتساب.
    `.trim();

    let userPrompt = incomingText;
    if (conversationHistory) {
      userPrompt = `[سياق المحادثة السابقة مع المتصل]:\n${conversationHistory}\n\n[رسالة المتصل الحالية]:\n"${incomingText}"\n\nرد عليه بذكاء مع مراعاة كامل سياق الحوار السابق:`;
    }

    try {
      const reply = await this.#callHfChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], 250);

      return reply || `أهلاً بك! تم استلام رسالتك وسأقوم بإطلاع ${ownerName} على طلبك، وسيتواصل معك ويرد عليك شخصياً فور أن يكون متاحاً إن شاء الله.`;
    } catch (error) {
      console.warn('[HuggingFaceProvider] Generation warning, using resilient fallback:', error.message);
      if (this.fallbackProvider) {
        return this.fallbackProvider.generateResponse({ senderJid, senderName, incomingText, scheduleContext, persona, conversationHistory });
      }
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
      const text = await this.#callHfChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `الرسالة المستلمة: "${incomingText}"\nالرد المقترح: "${candidateReply}"` }
      ], 150);

      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
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
المالك يتحدث معك الآن في محادثته الخاصة (Admin Mode).
افهم قصد المالك ونفذه بذكاء:
1. إذا طلب تفعيل وضع معين:
   - وضع النوم (أو قال: بنام، تعبان، نعسان): حدد [MODE:sleep]
   - وضع العمل (أو قال: دوام، اجتماع، شغل): حدد [MODE:work]
   - وضع المذاكرة (أو قال: بذاكر، دراسة، اختبار): حدد [MODE:study]
   - العودة للوضع الطبيعي (أو قال: تلقائي، متاح): حدد [MODE:null]
2. إذا طلب تقريراً أو ملخصاً للرسائل: اذكر له ملخص الحالات العاجلة (${totalEscalations} حالة مسجلة).
3. إذا طلب الرد على شخص معين أو ذكره بالاسم ولم تكن جهة الاتصال معروفة:
   أخبر ${ownerName} بذكاء بأنك جاهز ومستعد للرد عليه واطلب منه رقم هاتفه أو نص الرسالة لإرسالها فوراً.
4. صغ رداً ذكياً ودوداً ومختصراً يؤكد له ما تم فهمه وتنفيذه.

التنسيق الإلزامي للرد:
[MODE:sleep/work/study/null/none]
نص ردك الودود والمباشر لـ ${ownerName}.
    `.trim();

    try {
      const raw = await this.#callHfChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: incomingText }
      ], 200);

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
        reply: replyText || `أهلاً بك يا ${ownerName}! استلمت رسالتك. المساعد الذكي نشط وجاهز لخدمتك.`,
        setMode
      };
    } catch (error) {
      console.warn('[HuggingFaceProvider] interpretAdminCommand warning, using resilient fallback:', error.message);
      if (this.fallbackProvider) {
        return this.fallbackProvider.interpretAdminCommand({ incomingText, scheduleContext, auditHistory, persona });
      }
      return {
        reply: null
      };
    }
  }
}
