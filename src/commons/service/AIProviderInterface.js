/* eslint-disable import/prefer-default-export */
export class AIProviderInterface {

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
