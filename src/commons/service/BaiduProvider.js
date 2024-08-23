/* eslint-disable prettier/prettier */
/* eslint-disable no-restricted-syntax */
import axios from 'axios';

import { AIProviderInterface } from './AIProviderInterface';


const CHAT_URL = 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions';

export default class BaiduProvider extends AIProviderInterface {
  constructor(accessToken) {
    super(1000, false);
    this.accessToken = accessToken;
  }

  async generateContent(prompt) {
    try {
      const res = await axios.post(
          `${CHAT_URL}?access_token=${this.accessToken}`,
          JSON.stringify({'prompt': prompt}),
      );
      const { data } = res;
      return data;
    } catch (e) {
      console.log(e);
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
    // FIXME  current disabled
    try {
      const response = await axios.post(CHAT_URL, imageParts.data, {
        headers: {
          'Content-Type': 'application/json', // Or another appropriate content type
          'Authorization': `Bearer ${this.accessToken}`, // 设置认证头部
        },
        params: {
          // Add any other parameters required by the API
        },
      })

      return response.data;
    } catch (e) {
      console.log(e);
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
    const h = message ? [...history, { role: 'user', content: message}] : history;
    try {
      const res = await axios.post(
          `${CHAT_URL}?access_token=${this.accessToken}`,
          JSON.stringify({
                messages: h,
            }),
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
      );
      const { data } = res;
      return data;
    } catch (e) {
      console.log(e);
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
  async generateContentStream(prompt, imageParts ) {
     // FIXME  current disabled
     return this.generateMultimodalContent(prompt, imageParts)
  }

  async generateChatStream(history, message) {
    const h = message ? [...history, { role: 'user', content: message}] : history;
    try {
       const response = await axios.post(
            `${CHAT_URL}?access_token=${this.accessToken}`,
            JSON.stringify({
                messages: h,
            }),
            {
                headers: { 'Content-Type': 'text/plain' },
                responseType: 'stream'
            }
        );

       return {
            stream: (async function* () {
                const decoder = new TextDecoder();
                for await (const chunk of response.data) {
                    let data = '';
                    if (typeof chunk === 'string') data = chunk;
                    else {
                      data = chunk ?  decoder.decode(new Uint8Array(chunk), { stream: true }) : '';
                    }
                    yield {
                        data: () => data,
                    };
                }
            })(),
      };
    } catch (e) {
      console.log(e);
      return {
        stream: (async function* () {
            yield {
              data: () =>  '',
            };
        })(),
      };
    }
  }

  async generateImage(message) {
    throw new Error('Method not implemented');
  }
}
