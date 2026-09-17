/**
 * Port: ISpeechToTextProvider
 * Contract for transcribing audio messages into text
 */
export class ISpeechToTextProvider {
  /**
   * Transcribes an audio buffer or file into text
   * @param {Buffer|string} audioSource
   * @param {Object} options
   * @returns {Promise<string>} Transcribed text
   */
  async transcribeAudio(audioSource, options = {}) {
    throw new Error('Method transcribeAudio() must be implemented.');
  }
}
