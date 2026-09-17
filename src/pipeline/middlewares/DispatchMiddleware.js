import fs from 'fs';

/**
 * Dispatch Middleware
 * Emits the approved text or voice response through the IWhatsAppClient port
 */
export function createDispatchMiddleware(whatsappClient) {
  return async (context, next) => {
    const { senderJid, candidateReply, isAudioResponse, outgoingAudioPath } = context;

    if (!candidateReply && !outgoingAudioPath) {
      await next();
      return;
    }

    try {
      if (isAudioResponse && outgoingAudioPath && fs.existsSync(outgoingAudioPath)) {
        await whatsappClient.sendVoiceNote(senderJid, outgoingAudioPath);
        context.dispatched = true;
        context.dispatchType = 'voice';

        // Clean up temp audio file after dispatch
        try {
          fs.unlinkSync(outgoingAudioPath);
        } catch {}
      } else {
        await whatsappClient.sendMessage(senderJid, candidateReply);
        context.dispatched = true;
        context.dispatchType = 'text';
      }
    } catch (error) {
      console.error('[DispatchMiddleware] Failed to send message:', error.message);
      context.dispatchError = error;
    }

    await next();
  };
}
