/* eslint-disable import/prefer-default-export */

/**
 * Default capability map. Providers override the entries they support
 * (typically by setting `static capabilities = {...}` on the subclass).
 * Polyfills in src/commons/service/polyfills/ degrade gracefully when
 * a feature requests a capability the provider lacks natively.
 *
 * Capability shape:
 *   maxContext         number  — max input tokens (conservative — use the lowest-tier
 *                                model the user might pick if it varies)
 *   structuredOutput   string  — 'native' | 'json-mode' | 'prompt-only'
 *   toolUse            bool    — native function/tool calling
 *   promptCaching      bool    — API-side cache for repeated prefixes
 *   extendedThinking   bool    — native deeper-reasoning mode
 *   imageInput         bool    — multimodal input
 *   streaming          bool    — token-streaming output
 */
export const DEFAULT_CAPABILITIES = Object.freeze({
  maxContext: 4096,
  structuredOutput: 'prompt-only',
  toolUse: false,
  promptCaching: false,
  extendedThinking: false,
  imageInput: false,
  streaming: false,
});

export class AIProviderInterface {
  // Subclasses override with their actual capability map.
  static capabilities = DEFAULT_CAPABILITIES;

  constructor(timeGap, fullSupported) {
    this.timeGap = timeGap;
    this.fullSupported = fullSupported || false;
    this.model = '';
  }

  timeElapseBetweenCalls() {
    return this.timeGap;
  }

  isFullSupported() {
    return this.fullSupported;
  }

  /**
   * Return this provider's capability map. Subclasses may override this
   * instance method (rather than the static field) if capabilities vary
   * by selected model — e.g., Ollama with different local models.
   */
  capabilities() {
    return this.constructor.capabilities;
  }

  /**
   * Convenience for capability checks.
   *   supports('toolUse')                       → boolean
   *   supports('structuredOutput', 'native')    → boolean (exact-level match)
   */
  supports(capabilityName, level) {
    const value = this.capabilities()[capabilityName];
    if (level === undefined) return Boolean(value);
    return value === level;
  }

  // Generate text from text-only input
  async generateContent(prompt) {
    throw new Error('Method not implemented');
  }

  // Generate text from text-and-image input (multimodal)
  async generateMultimodalContent(prompt, imageParts) {
    throw new Error('Method not implemented');
  }

  // Build multi-turn conversations (chat)
  async sendChatMessage(history, message, configs) {
    throw new Error('Method not implemented');
  }

  // Use streaming for faster interactions
  async generateContentStream(prompt, imageParts) {
    throw new Error('Method not implemented');
  }

  // Use streaming for faster interactions
  async generateChatStream(history, message) {
    throw new Error('Method not implemented');
  }

  async generateImage(message) {
    throw new Error('Method not implemented');
  }
}
