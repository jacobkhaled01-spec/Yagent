import path from 'path';
import fs from 'fs';

/**
 * Voice Synthesis Middleware
 * Converts text response into a voice note if voice output is requested or sender used audio
 */
export function createVoiceSynthesisMiddleware(ttsProvider, options = {}) {
  const tempDir = options.tempAudioDir || './temp_audio';

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  return async (context, next) => {
    // If sender sent an audio note or global voice mode is active, reply with voice
    const replyAsVoice = options.forceVoice || context.isAudio || context.shouldSendVoice;

    if (replyAsVoice && ttsProvider && context.candidateReply) {
      try {
        const fileName = `reply_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.ogg`;
        const filePath = path.resolve(tempDir, fileName);

        await ttsProvider.synthesizeSpeech(context.candidateReply, filePath);
        context.outgoingAudioPath = filePath;
        context.isAudioResponse = true;
      } catch (error) {
        console.warn('[VoiceSynthesisMiddleware] Failed to synthesize voice note, falling back to text:', error.message);
      }
    }

    await next();
  };
}
