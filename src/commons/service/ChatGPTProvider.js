/* eslint-disable prettier/prettier */
/* eslint-disable no-restricted-syntax */
import OpenAI from 'openai';
import { AIProviderInterface } from './AIProviderInterface';
import { ChatGPTModel } from '../model/DataTypes';

export default class ChatGPTProvider extends AIProviderInterface {
  constructor(apiKey, model) {
    super(0, true);
    this.apiKey = apiKey;
    this.model = model || 'gpt-3.5-turbo';
  }

  async generateContent(prompt ) {
    const openai = new OpenAI({
      apiKey: this.apiKey ,
      dangerouslyAllowBrowser: true});
    const chatCompletion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: this.model,
    });
    return chatCompletion.choices[0].message?.content;
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
    const openai = new OpenAI({ apiKey: this.apiKey, dangerouslyAllowBrowser: true});
    const chatCompletion = await openai.chat.completions.create({
      model: ChatGPTModel.GPT4o, //  this.model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'image_url',
              image_url: {
                url: Array.isArray(imageParts) ? imageParts[0].data : imageParts,
              },
            },
          ],
        },
      ],
    });
    return chatCompletion.choices[0].message?.content;
  }

  /**
   *
   * @param {*} history
   *   an array of objects; { role, content }
   * @param {*} message
   * @param {*} configs
   */
  async sendChatMessage(history, message, configs) {
    const openai = new OpenAI({ apiKey: this.apiKey, dangerouslyAllowBrowser: true });
    const newHistory = message ? [...history, { 'user' : message }] : history;
    const chatCompletion = await openai.chat.completions.create({
      messages: newHistory,
      model: this.model,
    });
    return chatCompletion.choices[0].message?.content;
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
  async generateContentStream(prompt, imageParts, configs) {
    const openai = new OpenAI({ apiKey: this.apiKey, dangerouslyAllowBrowser: true });
    const stream = await openai.beta.chat.completions.stream({
      model: this.model,
      messages: [{ role: 'user', content:  prompt }],
      stream: true,
    });
    // Return a new object with the same structure but with the necessary changes
    return {
      stream: (async function* () {
        for await (const chunk of stream) {
          yield {
            data: () => chunk.choices[0]?.delta?.content || '', // Delegating text() method to data() method
          };
        }
      })(),
     finalChatCompletion: async () => {
        if (typeof  stream.finalChatCompletion === 'function') {
          return  stream.finalChatCompletion;
        }
        throw new TypeError("finalChatCompletion is not a function");
      },
    };
  }

  async generateChatStream(history, message) {
    const openai = new OpenAI({ apiKey: this.apiKey, dangerouslyAllowBrowser: true });
    const h = message ? [...history, {  role  : 'user', content: message}] : history;
    const stream = await openai.beta.chat.completions.stream({
      model: this.model,
      messages: h,
      stream: true,
    });
    // Return a new object with the same structure but with the necessary changes
    return {
      stream: (async function* () {
        for await (const chunk of stream) {
          yield {
            data: () => chunk.choices[0]?.delta?.content || '', // Delegating text() method to data() method
          };
        }
      })(),
      finalChatCompletion: async () => {
        if (typeof  stream.finalChatCompletion === 'function') {
          return  stream.finalChatCompletion;
        }
        throw new TypeError("finalChatCompletion is not a function");
      },
    };
  }

  async generateImage(message) {
    const openai = new OpenAI({ apiKey: this.apiKey, dangerouslyAllowBrowser: true });
    try {
      const response = await openai.images.generate({
        // model: 'dall-e-3',
        prompt: message,
        n: 1,
        size: '256x256',
      });
      return response.data[0].url;
    } catch (e) {
      return '';
    }
  }
}
