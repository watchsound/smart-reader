/* eslint-disable prettier/prettier */
/* eslint-disable no-restricted-syntax */
import OpenAI from 'openai';
import { AIProviderInterface } from './AIProviderInterface';

/**
 * https://platform.moonshot.cn/docs/api/chat#%E5%8D%95%E8%BD%AE%E5%AF%B9%E8%AF%9D
 * Moonshot 提供基于 HTTP 的 API 服务接入，并且对大部分 API，我们兼容了 OpenAI SDK。
 *
 * so this code is simply copy from ChatGPTProvider
 */
export default class KimiProvider extends AIProviderInterface {
  constructor(key, model) {
    super(1000, false);
    this.apiKey = key;
    this.model =  model ||  "moonshot-v1-32k";
  }

  async generateContent(prompt ) {
    const openai = new OpenAI({
      apiKey: this.apiKey ,
      baseURL: "https://api.moonshot.cn/v1",
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
    const openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL: "https://api.moonshot.cn/v1",
      dangerouslyAllowBrowser: true});
    const chatCompletion = await openai.chat.completions.create({
      model:   this.model,
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
    const openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL: "https://api.moonshot.cn/v1",
      dangerouslyAllowBrowser: true});
    const filteredHistory = history.filter((h) => h.role !== 'assistant' || !!h.content )
    const newHistory = message ? [...filteredHistory, { 'user' : message }] : filteredHistory;
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
    const openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL: "https://api.moonshot.cn/v1",
      dangerouslyAllowBrowser: true});
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
    const openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL: "https://api.moonshot.cn/v1",
      dangerouslyAllowBrowser: true});
    const filteredHistory = history.filter((h) => h.role !== 'assistant' || !!h.content )

    const h = message ? [...filteredHistory, {  role  : 'user', content: message}] : filteredHistory;
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
    const openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL: "https://api.moonshot.cn/v1",
      dangerouslyAllowBrowser: true});
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
