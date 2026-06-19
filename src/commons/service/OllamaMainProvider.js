import { Ollama } from 'ollama';
import { AIProviderInterface } from './AIProviderInterface'; // Adjust path as necessary

export default class OllamaMainProvider extends AIProviderInterface {
  // Mirrors OllamaProvider — capabilities vary by local model.
  static capabilities = {
    maxContext: 32000,
    structuredOutput: 'json-mode',
    toolUse: false,
    promptCaching: false,
    extendedThinking: false,
    imageInput: false,
    streaming: true,
  };

  capabilities() {
    const base = this.constructor.capabilities;
    const m = (this.model || '').toLowerCase();
    if (m.includes('deepseek-r1')) {
      return {
        ...base,
        extendedThinking: true,
        toolUse: true,
        maxContext: 64000,
      };
    }
    if (m.includes('qwen2.5')) {
      return { ...base, toolUse: true, maxContext: 128000 };
    }
    if (m.includes('llama3.3')) {
      return { ...base, toolUse: true, maxContext: 128000 };
    }
    if (m.includes('llava') || m.includes('-vl')) {
      return { ...base, imageInput: true };
    }
    return base;
  }

  constructor(key, model) {
    super(1000, false);
    this.apiKey = key;
    this.model = model || 'llama3:8b';

  }

  // Generate text from text-only input
  async generateContent(prompt) {
    try {
      const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });
      const response = await ollama.chat({
        model: this.model,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
      });
      return response.message.content;
    } catch (error) {
      console.error('Error generating content with Ollama:', error);
      return '';
    }
  }

  async generateJsonMode(prompt) {
    try {
      const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });
      const response = await ollama.chat({
        model: this.model,
        temperature: 0,
        format: 'json',
        messages: [{ role: 'user', content: prompt }],
      });
      return response.message.content;
    } catch (error) {
      console.error('Error generating JSON-mode content with Ollama:', error);
      return '';
    }
  }

  // Build multi-turn conversations (chat)
  async sendChatMessage(history, message, configs = {}) {
    try {
      const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });
      const messages = history || [];
      if (message) messages.push(message);
      const response = await ollama.chat({
        model: this.model,
        temperature: 0,
        messages,
      });
      console.log("sendChatMessage: " + JSON.stringify(response));
      return response.message.content;
    } catch (error) {
      console.error('Error sending chat message with Ollama:', error);
      return '';
    }
  }

  // Use streaming for faster interactions (content generation)
  async generateContentStream(prompt) {
    try {
      const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });
      const response = await ollama.chat({
        model: this.model,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      });
      const responseChunks = [];
      for await (const part of response) {
        responseChunks.push(part.message.content || '');
      }
      return responseChunks.join('');
    } catch (error) {
      console.error('Error generating content stream with Ollama:', error);
      return '';
    }
  }

  // Use streaming for faster interactions (chat generation)
  async generateChatStream(history, message) {
    try {
      const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });
      const messages = history || [];
      if(message) messages.push(message);
      const response = await ollama.chat({
        model: this.model,
        temperature: 0,
        messages,
        stream: true,
      });
      const responseChunks = [];
      for await (const part of response) {
        responseChunks.push(part.message.content || '');
      }
      return responseChunks.join('');
    } catch (error) {
      console.error('Error generating chat stream with Ollama:', error);
      return '';
    }
  }
}
