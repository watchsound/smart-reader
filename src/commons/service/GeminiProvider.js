/* eslint-disable prettier/prettier */
/* eslint-disable no-restricted-syntax */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProviderInterface } from './AIProviderInterface';

export default class GeminiProvider extends AIProviderInterface {
  static capabilities = {
    maxContext: 1000000,
    structuredOutput: 'native',
    toolUse: true,
    promptCaching: true,
    extendedThinking: true,
    imageInput: true,
    streaming: true,
  };

  constructor(apiKey, model) {
    super(0, false);
    this.apiKey = apiKey;
    this.model = model || 'gemini-2.5-flash';
  }

  createModel() {
    const genAI = new GoogleGenerativeAI(this.apiKey);
    // const { model } = configs || { model: 'gemini-1.5-flash' };
    return genAI.getGenerativeModel({ model : this.model });
  }

  async generateContent(prompt) {
    const gemini = this.createModel();
    const result = await gemini.generateContent(prompt);
    const response = await result.response;
    return response.text();
  }

  /**
   *
   * @param {*} prompt
   * @param {*} imageParts
   *   an array of object:
        * {
            data: Buffer.from(fs.readFileSync(path)).toString("base64"),
            mimeType
          },
   * @param {*} configs
   */
  async generateMultimodalContent(prompt, imageParts) {
    const gemini = this.createModel();
    const imageData = imageParts.map((m) => {
      return {
        inlineData: {
          data: m.data,
          mimeType: m.mimeType || 'image/jpeg',
        },
      };
    });
    const result = await gemini.generateContent([prompt, ...imageData]);
    const response = await result.response;
    return response.text();
  }

  /**
   *
   * @param {*} history
   *   an array of objects; { role, content }
   * @param {*} message
   * @param {*} configs
   */
  async sendChatMessage(history, message, configs) {
    const gemini = this.createModel();
    const geminiHistory = history.map((m) => {
      const role = m.role === 'system' ? 'model' : m.role; // 'user'
      return { role, parts: [{ text: m.content }] };
    });
    const chat = gemini.startChat({
      history: geminiHistory,
      generationConfig: {
        maxOutputTokens: configs?.maxOutputTokens || 8192,
      },
    });
    const result = await chat.sendMessage(message);
    const response = await result.response;
    return response.text();
  }

  /**
   * usage:
   *  const prompt = "your prompt here";
      const result = await generateContentStream(prompt);

      let text = '';
      for await (const chunk of result.stream) {
        const c = chunk.data();
        console.log(c);
        text += c;
    }
   *
   *
   *
   * @param {*} prompt
   * @param {*} imageParts
   * @param {*} configs
   * @returns
   */
  async generateContentStream(prompt, imageParts ) {
    const gemini = this.createModel();
    const result = (await imageParts)
      ? gemini.generateContentStream([prompt, ...imageParts])
      : gemini.generateContentStream(prompt);

    // Return a new object with the same structure but with the necessary changes
    return {
      stream: (async function* () {
        for await (const chunk of result.stream) {
          yield {
            data: () => chunk.text(), // Delegating text() method to data() method
          };
        }
      })(),
    };
  }

  async generateChatStream(history, message) {
    const gemini = this.createModel();

    // Separate history from the last user message
    // The last message in history should be sent via sendMessageStream
    const geminiHistory = [];
    let lastUserMessage = message;

    for (let i = 0; i < history.length; i++) {
      const m = history[i];
      const role = m.role === 'system' ? 'model' : m.role;

      // If this is the last message and it's from user, use it as the message to send
      if (i === history.length - 1 && m.role === 'user' && !message) {
        lastUserMessage = m.content;
      } else {
        geminiHistory.push({ role, parts: [{ text: m.content }] });
      }
    }

    // Start a chat with the history (excluding the last user message)
    const chat = gemini.startChat({
      history: geminiHistory,
    });

    // Use streaming to send the last user message
    const result = await chat.sendMessageStream(lastUserMessage);

    return {
      stream: (async function* () {
        for await (const chunk of result.stream) {
          yield {
            data: () => chunk.text(), // Delegating text() method to data() method
          };
        }
      })(),
    };
  }

  async generateImage(message) {
    throw new Error('Method not implemented');
  }
}
