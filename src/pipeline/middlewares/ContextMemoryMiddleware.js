/**
 * ContextMemoryMiddleware
 * Injects multi-turn conversational history into the pipeline context
 * and records interactions into both ConversationMemoryStore and ExecutiveBriefingStore.
 */
export function createContextMemoryMiddleware(memoryStore, briefingStore) {
  return async (context, next) => {
    // If it's the owner interacting in self chat, skip contact memory injection
    if (context.isSelfAdmin) {
      await next();
      return;
    }

    // 1. Pre-execution: Fetch and attach conversation history for prompt enrichment
    if (memoryStore) {
      context.conversationHistory = memoryStore.formatHistoryForPrompt(
        context.senderJid,
        context.senderName
      );
    }

    // 2. Execute downstream middlewares (LLM generation, critique, dispatch)
    await next();

    // 3. Post-execution: Record dialogue into memory and executive briefing
    const finalReply = context.dispatchedText || context.candidateReply;
    if (context.senderJid && context.text) {
      if (memoryStore) {
        memoryStore.addMessage(context.senderJid, 'user', context.text);
        if (finalReply) {
          memoryStore.addMessage(context.senderJid, 'assistant', finalReply);
        }
      }

      if (briefingStore && finalReply) {
        briefingStore.recordInteraction({
          senderJid: context.senderJid,
          senderName: context.senderName,
          incomingText: context.text,
          replyText: finalReply,
          isEmergency: Boolean(context.isEmergency || context.isEscalated)
        });
      }
    }
  };
}
