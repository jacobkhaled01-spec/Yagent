import { ILLMProvider } from '../../domain/ports/ILLMProvider.js';

/**
 * MockLLMProvider
 * Fast, deterministic provider for unit testing, dry-runs, and offline execution
 */
export class MockLLMProvider extends ILLMProvider {
  constructor() {
    super();
  }

  async generateResponse({ incomingText, scheduleContext, persona }) {
    const modeName = scheduleContext?.name || 'Available';
    const owner = persona?.ownerName || 'صاحب الحساب';

    if (scheduleContext?.modeKey === 'sleep') {
      return `أهلاً بك، ${owner} نائم حالياً وسيقوم بقراءة رسالتك في الصباح إن شاء الله.`;
    }

    if (scheduleContext?.modeKey === 'work') {
      return `مرحباً، ${owner} منشغل حالياً في ساعات العمل وسيعاود التواصل معك بعد انتهاء المهام.`;
    }

    if (scheduleContext?.modeKey === 'study') {
      return `أهلاً بك، ${owner} في جلسة تركيز ودراسة حالياً، تم استلام رسالتك وسيرد عليك فور انتهائه.`;
    }

    return `أهلاً بك! أنا المساعد الذكي لـ ${owner}. كيف يمكنني مساعدتك؟`;
  }

  async evaluateAndRefine({ incomingText, candidateReply, scheduleContext }) {
    // Looping Self-Critique validation logic
    if (scheduleContext?.modeKey === 'sleep' && candidateReply.includes('سأتصل بك الآن')) {
      return {
        passed: false,
        reason: 'Contradicts sleep mode: promised an immediate call while sleeping.',
        refinedReply: 'أهلاً بك، المستخدم نائم حالياً وسيقوم بالتواصل معك غداً صباحاً.'
      };
    }

    return {
      passed: true,
      refinedReply: candidateReply
    };
  }

  async interpretAdminCommand({ incomingText, scheduleContext, auditHistory, persona, briefingDigest }) {
    const text = incomingText.toLowerCase();
    const owner = persona?.ownerName || 'يا سيدي';

    if (text.includes('نوم') || text.includes('نايم') || text.includes('انام')) {
      return {
        reply: `🌙 تم تفعيل وضع النوم بنجاح يا ${owner}. سأرد بهدوء على رسائلك ولن أزعجك إلا في حالات الطوارئ القصوى. تصبح على خير!`,
        setMode: 'sleep'
      };
    }

    if (text.includes('عمل') || text.includes('شغل') || text.includes('اجتماع') || text.includes('دوام')) {
      return {
        reply: `💼 تم تفعيل وضع العمل بنجاح يا ${owner}. سأتولى الرد الرسمي وتسجيل المهام الهامة ريثما تنتهي. بالتوفيق في عملك!`,
        setMode: 'work'
      };
    }

    if (text.includes('مذاكرة') || text.includes('دراسة') || text.includes('تركيز') || text.includes('امتحان')) {
      return {
        reply: `📚 تم تفعيل وضع المذاكرة والتركيز بنجاح يا ${owner}. سأخبر المتصلين بأنك في جلسة دراسة لتتفرغ لتركيزك.`,
        setMode: 'study'
      };
    }

    if (text.includes('تقرير') || text.includes('احصائيات') || text.includes('من كلمني') || text.includes('جديد') || text.includes('رسائل')) {
      if (briefingDigest) {
        return { reply: briefingDigest };
      }
      const total = auditHistory.length;
      return {
        reply: `📊 **تقريرك المباشر يا ${owner}:**\n• حالة النظام: متصل ونشط 🟢\n• الوضع الحالي: [${scheduleContext.name}]\n• البلاغات العاجلة: ${total} حالة\nسأوافيك بكل جديد فور حدوثه.`
      };
    }

    return {
      reply: `👋 أهلاً بك يا ${owner}! أنا مساعدك الشخصي الذكي، وفهمت رسالتك: "${incomingText}". يمكنك إخباري بأي ظرف (مثل: "أنا نايم" أو "أنا في اجتماع" أو "التقرير") وسأقوم بضبط الردود التلقائية وفق رغبتك فوراً.`
    };
  }
}
