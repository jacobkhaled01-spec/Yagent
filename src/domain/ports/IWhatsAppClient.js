/**
 * Port: IWhatsAppClient
 * Contract for WhatsApp connection and message dispatching
 */
export class IWhatsAppClient {
  /**
   * Initializes and connects to WhatsApp
   * @returns {Promise<void>}
   */
  async connect() {
    throw new Error('Method connect() must be implemented.');
  }

  /**
   * Sends a text message to a recipient
   * @param {string} to - Recipient JID (e.g., "123456789@s.whatsapp.net")
   * @param {string} text - Message content
   * @returns {Promise<any>}
   */
  async sendMessage(to, text) {
    throw new Error('Method sendMessage() must be implemented.');
  }

  /**
   * Sends a voice note (audio message) to a recipient
   * @param {string} to - Recipient JID
   * @param {string|Buffer} audioSource - File path or buffer
   * @returns {Promise<any>}
   */
  async sendVoiceNote(to, audioSource) {
    throw new Error('Method sendVoiceNote() must be implemented.');
  }

  /**
   * Updates presence state (e.g. 'composing', 'recording', 'paused')
   * @param {string} to
   * @param {'composing'|'recording'|'paused'} presence
   * @returns {Promise<void>}
   */
  async sendPresenceUpdate(to, presence) {
    throw new Error('Method sendPresenceUpdate() must be implemented.');
  }

  /**
   * Registers a callback for incoming messages
   * @param {Function} handler - async (incomingMessage) => void
   */
  onMessageReceived(handler) {
    throw new Error('Method onMessageReceived() must be implemented.');
  }
}
