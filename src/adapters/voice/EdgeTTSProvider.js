import fs from 'fs';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { ITextToSpeechProvider } from '../../domain/ports/ITextToSpeechProvider.js';

/**
 * EdgeTTSProvider
 * Free, zero-API-key Text-to-Speech using Microsoft Edge Neural Arabic Voices
 */
export class EdgeTTSProvider extends ITextToSpeechProvider {
  constructor(voiceName = 'ar-SA-HamedNeural') {
    super();
    this.voiceName = voiceName;
  }

  async synthesizeSpeech(text, destinationPath) {
    const tts = new MsEdgeTTS();
    // Use WhatsApp-friendly audio format (Opus 24kHz)
    await tts.setMetadata(this.voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_OPUS);

    const readableStream = tts.toStream(text);

    return new Promise((resolve, reject) => {
      const writableFile = fs.createWriteStream(destinationPath);
      readableStream.pipe(writableFile);

      writableFile.on('finish', () => resolve(destinationPath));
      writableFile.on('error', (err) => reject(err));
    });
  }
}
