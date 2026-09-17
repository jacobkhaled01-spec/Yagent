/**
 * Port: ILLMProvider
 * Contract for swappable AI model providers (Ollama, Gemini, Groq, Mock)
 */
export class ILLMProvider {
  /**
   * Generates a candidate response based on conversation history and active persona context.
   * @param {Object} params
   * @param {string} params.senderJid
   * @param {string} params.incomingText
   * @param {Object} params.scheduleContext
   * @param {Object} params.persona
   * @returns {Promise<string>}
   */
  async generateResponse(params) {
    throw new Error('Method generateResponse() must be implemented.');
  }

  /**
   * Evaluates a candidate reply against active temporal and safety constraints (Looping Self-Critique).
   * @param {Object} params
   * @param {string} params.incomingText
   * @param {string} params.candidateReply
   * @param {Object} params.scheduleContext
   * @returns {Promise<{ passed: boolean, reason?: string, refinedReply?: string }>}
   */
  async evaluateAndRefine(params) {
    throw new Error('Method evaluateAndRefine() must be implemented.');
  }

  /**
   * Interprets natural language commands and instructions directly from the account owner.
   * @param {Object} params
   * @param {string} params.incomingText
   * @param {Object} params.scheduleContext
   * @param {Array} params.auditHistory
   * @param {Object} params.persona
   * @returns {Promise<{ reply: string, setMode?: string|null }>}
   */
  async interpretAdminCommand(params) {
    throw new Error('Method interpretAdminCommand() must be implemented.');
  }
}
