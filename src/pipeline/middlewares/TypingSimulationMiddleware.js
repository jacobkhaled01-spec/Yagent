/**
 * Typing Simulation & Anti-Ban Middleware
 * Simulates human typing delay and composing presence indicators
 */
export function createTypingSimulationMiddleware(whatsappClient, options = {}) {
  const minDelayMs = options.minDelayMs || 1500;
  const maxDelayMs = options.maxDelayMs || 4000;

  return async (context, next) => {
    const { senderJid, candidateReply, isAudioResponse } = context;

    if (!candidateReply) {
      await next();
      return;
    }

    try {
      // Choose presence mode: 'recording' for audio notes, 'composing' for text
      const presenceState = isAudioResponse ? 'recording' : 'composing';
      await whatsappClient.sendPresenceUpdate(senderJid, presenceState);

      // Compute natural jitter delay based on text length
      const lengthFactor = Math.min((candidateReply.length || 20) * 30, 2500);
      const randomJitter = Math.floor(Math.random() * (maxDelayMs - minDelayMs)) + minDelayMs;
      const totalDelay = Math.min(randomJitter + lengthFactor, 5000);

      // Wait human-like delay unless explicitly skipped (e.g. in test suites)
      if (!options.skipDelay) {
        await new Promise((resolve) => setTimeout(resolve, totalDelay));
      }

      await whatsappClient.sendPresenceUpdate(senderJid, 'paused');
    } catch (err) {
      console.warn('[TypingSimulationMiddleware] Presence update skipped:', err.message);
    }

    await next();
  };
}
