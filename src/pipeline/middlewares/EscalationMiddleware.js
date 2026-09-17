/**
 * Escalation & Fallback Middleware
 * When the AI cannot handle a query or an emergency is flagged,
 * politely notifies the sender that the user will follow up personally.
 */
export function createEscalationMiddleware(personaConfig, onEscalationLogged) {
  return async (context, next) => {
    const isEmergency = context.scheduleContext?.isEmergency;
    const isAmbiguousOrFailed = !context.candidateReply || context.candidateReply.trim().length === 0;

    if (isEmergency || isAmbiguousOrFailed) {
      context.isEscalated = true;
      const owner = personaConfig.ownerName || 'المستخدم';

      if (isEmergency) {
        context.candidateReply = `أهلاً بك، تم استلام رسالتك وتصنيفها كحالة عاجلة/طوارئ. سيتم إشعار ${owner} فوراً للتواصل معك في أسرع وقت.`;
      } else if (isAmbiguousOrFailed) {
        context.candidateReply = personaConfig.escalationNotice || 
          `أهلاً بك، تم استلام رسالتك وسيتم إطلاع ${owner} عليها للرد عليك شخصياً عند عودته.`;
      }

      // Trigger escalation event listener for daily reports and push notifications
      if (typeof onEscalationLogged === 'function') {
        onEscalationLogged({
          senderJid: context.senderJid,
          text: context.text,
          reason: isEmergency ? 'Emergency Detected' : 'AI Unhandled Query',
          timestamp: new Date()
        });
      }
    }

    await next();
  };
}
