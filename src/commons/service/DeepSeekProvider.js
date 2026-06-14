/* eslint-disable prettier/prettier */
/* eslint-disable no-restricted-syntax */
/**
 * DeepSeekProvider.js
 *
 * AI Provider for DeepSeek models via the official DeepSeek API.
 * Uses OpenAI-compatible API endpoint.
 *
 * API Documentation: https://api-docs.deepseek.com/
 * Endpoint: https://api.deepseek.com/v1
 *
 * DeepSeek-V3 (deepseek-chat) is the recommended default for SmartReader's
 * workload: strong text quality (summary, extraction, micro-cards,
 * translation) at ~5% of frontier-model cost. DeepSeek-R1 (deepseek-reasoner)
 * is the extended-thinking variant for harder tasks like nuanced grading.
 *
 * NOTE: This provider class is complete but not yet wired into
 * AIProviderManager.setup() — wiring requires extending the preSetup/setup
 * method signatures, which is a non-additive change deferred to a follow-up.
 */

import OpenAI from 'openai';
import { AIProviderInterface } from './AIProviderInterface';
import { DeepSeekModel } from '../model/DataTypes';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

export default class DeepSeekProvider extends AIProviderInterface {
  static capabilities = {
    maxContext: 128000,
    structuredOutput: 'json-mode',
    toolUse: true,
    promptCaching: true,  // DeepSeek supports context caching (auto, server-side)
    extendedThinking: false,  // refined for R1 below
    imageInput: false,    // DeepSeek-VL is a separate model line
    streaming: true,
  };

  capabilities() {
    const base = this.constructor.capabilities;
    if ((this.model || '').toLowerCase().includes('reasoner')) {
      return { ...base, extendedThinking: true };
    }
    return base;
  }

  constructor(apiKey, model) {
    super(0, true);
    this.apiKey = apiKey;
    this.model = model || DeepSeekModel.DEEPSEEK_CHAT;
  }

  createClient() {
    return new OpenAI({
      apiKey: this.apiKey,
      baseURL: DEEPSEEK_BASE_URL,
      dangerouslyAllowBrowser: true,
    });
  }

  async generateContent(prompt) {
    const client = this.createClient();
    const chatCompletion = await client.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: this.model,
    });
    return chatCompletion.choices[0].message?.content;
  }

  async generateMultimodalContent(prompt, imageParts) {
    // DeepSeek-VL exists but is a separate model line not supported here.
    // Fall back to text-only with a warning.
    console.warn('[DeepSeekProvider] multimodal not supported on deepseek-chat / deepseek-reasoner; ignoring image input');
    return this.generateContent(prompt);
  }

  async sendChatMessage(history, message, configs) {
    const client = this.createClient();
    const messages = message
      ? [...history, { role: 'user', content: message }]
      : history;
    const chatCompletion = await client.chat.completions.create({
      messages,
      model: this.model,
      ...(configs || {}),
    });
    return chatCompletion.choices[0].message?.content;
  }

  async generateContentStream(prompt) {
    const client = this.createClient();
    const stream = await client.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: this.model,
      stream: true,
    });
    return {
      stream: (async function* iter() {
        for await (const chunk of stream) {
          yield {
            data: () => chunk.choices[0]?.delta?.content || '',
          };
        }
      })(),
    };
  }

  async generateChatStream(history, message) {
    const client = this.createClient();
    const messages = message
      ? [...history, { role: 'user', content: message }]
      : history;
    const stream = await client.chat.completions.create({
      messages,
      model: this.model,
      stream: true,
    });
    return {
      stream: (async function* iter() {
        for await (const chunk of stream) {
          yield {
            data: () => chunk.choices[0]?.delta?.content || '',
          };
        }
      })(),
    };
  }

  async generateImage(message) {
    throw new Error('Image generation not supported by DeepSeek models');
  }

  supportsToolUse() {
    return true;
  }
}
