/* eslint-disable prettier/prettier */
/* eslint-disable no-restricted-syntax */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProviderInterface } from './AIProviderInterface';

export default class GeminiProvider extends AIProviderInterface {
  constructor(apiKey, model) {
    super(0, false);
    this.apiKey = apiKey;
    this.model = model || 'gemini-1.5-flash';
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
        maxOutputTokens: configs.maxOutputTokens || 100,
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
    const geminiHistory = history.map((m) => {
      const role = m.role === 'system' ? 'model' : m.role; // 'user'
      return { role, parts: [{ text: m.content }] };
    });
    if (message) {
      geminiHistory.push({
        role: 'user', parts: [{ text: message }]
      });
    }
    // Use streaming with multi-turn conversations (like chat)
    const result = await gemini.sendMessageStream(geminiHistory);
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
