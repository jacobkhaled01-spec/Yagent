/**
 * Looping Engineering: Self-Critique & Reflection Middleware
 * Evaluates candidate response against active persona and temporal rules
 */
export function createSelfCritiqueMiddleware(llmProvider, maxIterations = 2) {
  return async (context, next) => {
    // Skip critique if already escalated
    if (context.isEscalated) {
      await next();
      return;
    }

    let iterations = 0;
    let reply = context.candidateReply;

    while (iterations < maxIterations) {
      try {
        const evaluation = await llmProvider.evaluateAndRefine({
          incomingText: context.text,
          candidateReply: reply,
          scheduleContext: context.scheduleContext
        });

        if (evaluation.passed) {
          context.critiquePassed = true;
          context.candidateReply = evaluation.refinedReply || reply;
          break;
        } else if (evaluation.refinedReply) {
          reply = evaluation.refinedReply;
        }
      } catch (err) {
        console.warn('[SelfCritiqueMiddleware] Reflection loop caught warning:', err.message);
        break;
      }
      iterations++;
    }

    context.candidateReply = reply;
    await next();
  };
}
