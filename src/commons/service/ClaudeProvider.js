/* eslint-disable prettier/prettier */
/* eslint-disable no-restricted-syntax */
import Anthropic from '@anthropic-ai/sdk';
import { AIProviderInterface } from './AIProviderInterface';
import { ClaudeModel } from '../model/DataTypes';

export default class ClaudeProvider extends AIProviderInterface {
  constructor(apiKey, model) {
    super(0, false);
    this.apiKey = apiKey;
    this.model = model || ClaudeModel.CLAUDE_3_HAIKU;
  }


  createModel() {
    const client = new Anthropic({ apiKey: this.apiKey });
    return client;
  }

  async generateContent(prompt) {
    const client = this.createModel();
    const message = await client.messages.create({
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
      model: this.model,
    });
    return message.content;
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
     const client = this.createModel();
     const message = await client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type":  imageParts.mimeType || 'image/jpeg',
                            "data": imageParts.data,
                        },
                    }
                ],
            }
          ]
    });
    return message.content;
  }

  /**
   *
   * @param {*} history
   *   an array of objects; { role, content }
   * @param {*} message
   * @param {*} configs
   */
  async sendChatMessage(history, message, configs) {
    const client = this.createModel();
    const h = message ? [...history, { role: 'user', content: message}] : history;
    const r = await client.messages.create({
      max_tokens: 1024,
      messages: h,
      model: this.model,
    });
    return r.content;
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
     const client = this.createModel();
     const message = await client.messages.create({
      model: this.model,
      max_tokens: 1024,
      messages: [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type":  imageParts.mimeType || 'image/jpeg',
                            "data": imageParts.data,
                        },
                    }
                ],
            }
          ]
    });
    return message.content;
  }

  async generateChatStream(history, message) {
    const client = this.createModel();
    const h = message ? [...history, { role: 'user', content: message}] : history;
    const stream = await client.messages.create({
      max_tokens: 1024,
      messages: h,
      model: this.model,
      stream: true,
    });

    return {
      stream: (async function* () {
        for await (const messageStreamEvent of stream) {
          yield {
            data: () => {
              const {type} = messageStreamEvent;
              if (type === 'content_block_delta') return messageStreamEvent.delta.text;
              return '';
            },
          };
        }
      })(),
    };
  }

  async generateImage(message) {
    throw new Error('Method not implemented');
  }
}
