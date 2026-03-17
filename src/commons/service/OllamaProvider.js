import { AIProviderInterface } from './AIProviderInterface'; // Adjust path as necessary

export default class OllamaProvider extends AIProviderInterface {
  constructor(key, model) {
    super(1000, false);
    this.apiKey = key;
    this.model = model || 'llama3:8b';
  }

  static async createStream() {
    const queue = [];
    let done = false;
    let resolveQueue = null;

    // Start listening for streamed data
    window.electron.ipcRenderer.onStreamData((data) => {
      queue.push({ data: () => data });
      if (resolveQueue) {
        resolveQueue(); // Notify that data is available
        resolveQueue = null;
      }
    });

    // Listen for the stream completion signal
    window.electron.ipcRenderer.onStreamDone(() => {
      done = true;
       if (resolveQueue) {
         resolveQueue(); // Wake up any waiting consumers
         resolveQueue = null;
       }
    });

    // Return an async generator
    const stream = {
      async *[Symbol.asyncIterator]() {
        while (!done || queue.length > 0) {
          if (queue.length === 0) {
             await new Promise((resolve) => {
               resolveQueue = resolve;
             });
          } else {
            yield queue.shift();
          }
        }
      },
    };
    // Define a promise for `finalChatCompletion`
    const finalChatCompletion = async () => {
      return new Promise((resolve) => {
        window.electron.ipcRenderer.onStreamDone(() => resolve(true)); // Resolve when the stream completes
      });
    };

    // Return the desired structure
    return {
      stream, // Async generator
      finalChatCompletion, // Completion promise
    };
  }

  // Generate text from text-only input
  async generateContent(prompt) {
    try {
      return window.electron.ipcRenderer.generateContent(prompt);
    } catch (error) {
      console.error('Error generating content with Ollama:', error);
      throw error;
    }
  }

  // Build multi-turn conversations (chat)
  async sendChatMessage(history, message, configs = {}) {
    try {
      return window.electron.ipcRenderer.sendChatMessage(history, message);
    } catch (error) {
      console.error('Error sending chat message with Ollama:', error);
      throw error;
    }
  }

  // Use streaming for faster interactions (content generation)
  async generateContentStream(prompt) {
    try {
      window.electron.ipcRenderer.startStream([], {
        role: 'user',
        content: prompt,
      });
      const result = await OllamaProvider.createStream();
      return result;
    } catch (error) {
      console.error('Error generating content stream with Ollama:', error);
      throw error;
    }
  }

  // Use streaming for faster interactions (chat generation)
  async generateChatStream(history, message) {
    try {
       window.electron.ipcRenderer.startStream(history || [], message);
       const result = await OllamaProvider.createStream();
       return result;
    } catch (error) {
      console.error('Error generating chat stream with Ollama:', error);
      throw error;
    }
  }
}
