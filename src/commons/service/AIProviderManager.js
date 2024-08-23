import JSON5 from 'json5';

import ChatGPTProvider from './ChatGPTProvider';
import GeminiProvider from './GeminiProvider';
import KimiProvider from './KimiProvider';
import { AIProvider } from '../model/DataTypes';
import {
  executeCommandWithRetry,
  stripJsonByTag,
  stripJsonWrap,
} from '../utils/commonUtil';
import { extractJsonPrompt } from '../utils/AIPrompts';
import ClaudeProvider from './ClaudeProvider';
import BaiduQianfanProvider from './BaiduQianfanProvider';
import BaiduProvider from './BaiduProvider';

class AIProviderManager {
  constructor() {
    if (AIProviderManager.instance) {
      return AIProviderManager.instance;
    }

    this.currentProvider = null; // Default provider
    this.currentProviderName = '';
    this.invokeTime = Date.now();
    AIProviderManager.instance = this;
  }

  preSetup(
    provider,
    apiKeyChatgpt,
    apiKeyGemini,
    apiKeyKimi,
    apiKeyClaude,
    apiKeyBaidu,
  ) {
    let key = '';
    let provider0 = provider;
    if (provider0 === AIProvider.ChatGPT) {
      key = apiKeyChatgpt;
    } else if (provider0 === AIProvider.Gemini) {
      key = apiKeyGemini;
    } else if (provider0 === AIProvider.Kimi) {
      key = apiKeyKimi;
    } else if (provider0 === AIProvider.Claude) {
      key = apiKeyClaude;
    } else if (provider0 === AIProvider.Baidu) {
      key = apiKeyBaidu;
    }

    if (!provider0) {
      key = apiKeyChatgpt;
      if (key) provider0 = AIProvider.ChatGPT;
      else {
        key = apiKeyGemini;
        if (key) provider0 = AIProvider.Gemini;
        else {
          key = apiKeyKimi;
          if (key) provider0 = AIProvider.Kimi;
          else {
            key = apiKeyClaude;
            if (key) provider0 = AIProvider.Claude;
            else {
              key = apiKeyBaidu;
              provider0 = AIProvider.Baidu;
            }
          }
        }
      }
    }
    return { key, provider: provider0 };
  }

  setup(isInRender, userId, provider, key, model) {
    if (!provider && !key) return;
    // console.log(`key = ${key}  provider = ${provider}`);
    if (provider === AIProvider.ChatGPT) {
      this.currentProvider = new ChatGPTProvider(key, model);
      this.currentProviderName = AIProvider.ChatGPT;
    } else if (provider === AIProvider.Gemini) {
      this.currentProvider = new GeminiProvider(key, model);
      this.currentProviderName = AIProvider.Gemini;
    } else if (provider === AIProvider.Kimi) {
      this.currentProvider = new KimiProvider(key, model);
      this.currentProviderName = AIProvider.Kimi;
    } else if (provider === AIProvider.Claude) {
      this.currentProvider = new ClaudeProvider(key, model);
      this.currentProviderName = AIProvider.Claude;
    } else if (provider === AIProvider.Baidu) {
      if (isInRender) {
        this.currentProvider = new BaiduProvider(model); // model is access_token here
      } else {
        this.currentProvider = new BaiduQianfanProvider(key, model);
      }
      this.currentProviderName = AIProvider.Baidu;
    }
  }

  static pause(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  async checkInvokeTime() {
    console.log(` this.currentProvider.timeGap = ${this.currentProvider.timeGap}`)
    if (this.currentProvider.timeGap > 0) {
      if (this.invokeTime + this.currentProvider.timeGap >= Date.now()) {
        await AIProviderManager.pause(this.currentProvider.timeGap);
      }
      this.invokeTime = Date.now();
    }
  }

  async generateContent(prompt) {
    await this.checkInvokeTime();
    return this.currentProvider.generateContent(prompt);
  }

  // Generate text from text-and-image input (multimodal)
  async generateMultimodalContent(prompt, imageParts, useJson, startTag) {
    await this.checkInvokeTime();
    const that = this;
    const response = await executeCommandWithRetry(() =>
      that.currentProvider.generateMultimodalContent(prompt, imageParts),
    );
    if (!response) return '';
    if (useJson) {
      return AIProviderManager.processResponseJsonData(response, startTag);
    }
    return response;
  }

  // Build multi-turn conversations (chat)
  async sendChatMessage(history, message, configs, useJson, startTag) {
    await this.checkInvokeTime();
    const that = this;
    const response = await executeCommandWithRetry(() =>
      that.currentProvider.sendChatMessage(history, message, configs),
    );
    if (!response) return '';
    if (useJson) {
      return AIProviderManager.processResponseJsonData(response, startTag);
    }
    return response;
  }

  // Use streaming for faster interactions
  async generateContentStream(prompt, imageParts) {
    await this.checkInvokeTime();
    return this.currentProvider.generateContentStream(prompt, imageParts);
  }

  // Use streaming for faster interactions
  async generateChatStream(history, message) {
    await this.checkInvokeTime();
    return this.currentProvider.generateChatStream(history, message);
  }

  async generateImage(message) {
    await this.checkInvokeTime();
    return this.currentProvider.generateImage(message);
  }

  async extractJsonData(openai, model, content) {
    await this.checkInvokeTime();
    return this.generateContentWithJson(
      extractJsonPrompt(extractJsonPrompt(content)),
      true,
    );
  }

  static processResponseJsonData(response, startTag) {
    console.log( response )
    let stripped = '';
    try {
      stripped = stripJsonWrap(response);
      if (!stripped && startTag) stripped = stripJsonByTag(response, startTag);

      return JSON5.parse(stripped);
    } catch (e) {
      // in chatgpt it may return illegal symbols for math, '\[', '\]', '\(', '\)'
      let stripped2 = stripped.replace(/(?<!\\)(\\)(?!\\)/g, '\\\\'); // (/\\([()[\]])/g, '\\\\$1');

      try {
        return JSON5.parse(stripped2);
      } catch (e2) {
        try {
          stripped2 = stripped2.replace(/\n/g, '\\n');
          return JSON5.parse(stripped2);
        } catch (e3) {
          console.log(e3);
          return '';
        }
      }
    }
  }

  async generateContentWithJson(data, useJson, startTag) {
    await this.checkInvokeTime();
    const that = this;
    const response = await executeCommandWithRetry(() =>
      that.generateContent(data),
    );
    if (!response) return response;
    if (useJson) {
      return AIProviderManager.processResponseJsonData(response, startTag);
    }
    return response;
  }
}

// Export the singleton instance
const instance = new AIProviderManager();
// Object.freeze(instance);

export default instance;
