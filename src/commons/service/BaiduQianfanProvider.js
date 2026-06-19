/* eslint-disable prettier/prettier */
/* eslint-disable no-restricted-syntax */
import {ChatCompletion, Text2Image, Image2Text} from "@baiducloud/qianfan";

import { AIProviderInterface } from './AIProviderInterface';

export default class BaiduQianfanProvider extends AIProviderInterface {
  static capabilities = {
    maxContext: 32000,
    structuredOutput: 'prompt-only',
    toolUse: true,
    promptCaching: false,
    extendedThinking: false,
    imageInput: false,
    streaming: true,
  };

  constructor(apiKey, apiSecret) {
    super(0, true);
    this.apiKey = apiKey;
    this.apiSecret = apiSecret ;
  }

  async generateContent(prompt ) {
    const client = new ChatCompletion({ QIANFAN_AK: this.apiKey, QIANFAN_SK: this.apiSecret });
    try {
      const resp = await client.chat({
          messages: [
              {
                  role: 'user',
                  content: prompt,
              },
          ],
      });
      return resp.result;
    } catch (e) {
      console.log(e)
      return '';
    }
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
    const client = new Image2Text({ QIANFAN_AK: this.apiKey, QIANFAN_SK: this.apiSecret });
    try {
      const resp = await client.image2Text({
          prompt,
          image: imageParts.data,  //  请替换图片的base64编码
      });
      return resp.result;
    } catch (e) {
      console.log(e)
      return '';
    }
  }

  /**
   *
   * @param {*} history
   *   an array of objects; { role, content }
   * @param {*} message
   * @param {*} configs
   */
  async sendChatMessage(history, message, configs) {
    const client = new ChatCompletion({ QIANFAN_AK: this.apiKey, QIANFAN_SK: this.apiSecret });
    const newHistory = message ? [...history, { role: 'user', content: message }] : history;
    try {
      const resp = await client.chat({
        messages: newHistory,
      });
      return resp.result;
    } catch (e) {
      console.log(e)
      return '';
    }
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
    return this.generateChatStream([], prompt);
  }

  async generateChatStream(history, message) {
   const client = new ChatCompletion({ QIANFAN_AK: this.apiKey, QIANFAN_SK: this.apiSecret });
    const newHistory = message ? [...history, { role: 'user', content: message }] : history;
    const resp = await client.chat({
      messages: newHistory,
      stream: true,
    });
    try {
      return {
        stream: (async function* () {
          for await (const chunk of resp) {
            yield {
              data: () => chunk.result || '', // Delegating text() method to data() method
            };
          }
        })(),
        finalChatCompletion: async () => {
          if (typeof  resp.finalChatCompletion === 'function') {
            return  resp.finalChatCompletion;
          }
          throw new TypeError("finalChatCompletion is not a function");
        },
      };
    } catch (e) {
      console.log(e)
      return '';
    }
  }

  async generateImage(message) {
    const client = new Text2Image({ QIANFAN_AK: this.apiKey, QIANFAN_SK: this.apiSecret });
    try {
      const resp = await client.text2Image({
          prompt: message,
      });
      return  resp.data[0].b64_image;
    } catch (e) {
      console.log(e)
      return '';
    }
  }
}
