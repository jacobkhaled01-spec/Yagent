/**
 * Port: ITextToSpeechProvider
 * Contract for converting text into WhatsApp-compatible audio streams
 */
export class ITextToSpeechProvider {
  /**
   * Synthesizes text into an Opus/OGG audio file
   * @param {string} text - Text to speak
   * @param {string} destinationPath - Path to save audio file
   * @returns {Promise<string>} Output file path
   */
  async synthesizeSpeech(text, destinationPath) {
    throw new Error('Method synthesizeSpeech() must be implemented.');
  }
}
