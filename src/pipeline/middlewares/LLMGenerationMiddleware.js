/**
 * LLM Generation Middleware
 * Calls the injected ILLMProvider adapter to produce a candidate response
 */
export function createLLMGenerationMiddleware(llmProvider, personaConfig) {
  return async (context, next) => {
    try {
      const candidateReply = await llmProvider.generateResponse({
        senderJid: context.senderJid,
        senderName: context.senderName,
        incomingText: context.text,
        scheduleContext: context.scheduleContext,
        persona: personaConfig,
        conversationHistory: context.conversationHistory || ''
      });

      context.candidateReply = candidateReply;
      await next();
    } catch (error) {
      console.error('[LLMGenerationMiddleware] Error generating reply:', error.message);
      // Graceful degradation: Fallback to escalation template
      context.isEscalated = true;
      context.candidateReply = personaConfig.escalationNotice || 'تم استلام رسالتك وسيتم الرد عليك قريباً.';
      await next();
    }
  };
}
