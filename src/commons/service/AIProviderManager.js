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
import OllamaProvider from './OllamaProvider';
import OllamaMainProvider from './OllamaMainProvider.js';
import DoubaoProvider from './DoubaoProvider';
import QwenProvider from './QwenProvider';

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
    apiKeyDoubao,
    apiKeyQwen,
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
    } else if (provider0 === AIProvider.Doubao) {
      key = apiKeyDoubao;
    } else if (provider0 === AIProvider.Qwen) {
      key = apiKeyQwen;
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
              if (key) provider0 = AIProvider.Baidu;
              else {
                key = apiKeyDoubao;
                if (key) provider0 = AIProvider.Doubao;
                else {
                  key = apiKeyQwen;
                  provider0 = AIProvider.Qwen;
                }
              }
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
    if (provider === AIProvider.Ollama) {
      if (isInRender) {
        this.currentProvider = new OllamaProvider(key, model); // model is access_token here
      } else {
        this.currentProvider = new OllamaMainProvider(key, model);
      }
      this.currentProviderName = AIProvider.Ollama;
    } else if (provider === AIProvider.ChatGPT) {
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
    } else if (provider === AIProvider.Doubao) {
      this.currentProvider = new DoubaoProvider(key, model);
      this.currentProviderName = AIProvider.Doubao;
    } else if (provider === AIProvider.Qwen) {
      this.currentProvider = new QwenProvider(key, model);
      this.currentProviderName = AIProvider.Qwen;
    }
  }

  getCurrentModel() {
    return this.currentProvider ? this.currentProvider.model : '';
  }

  isFullSupported() {
    return this.currentProvider
      ? this.currentProvider.isFullSupported()
      : false;
  }

  static pause(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  async checkInvokeTime() {
    if (!this.currentProvider) {
      console.warn('AIProviderManager: No provider configured. Please set up an AI provider in Settings.');
      return;
    }
    console.log(
      ` this.currentProvider.timeGap = ${this.currentProvider.timeGap}`,
    );
    if (this.currentProvider.timeGap > 0) {
      if (this.invokeTime + this.currentProvider.timeGap >= Date.now()) {
        await AIProviderManager.pause(this.currentProvider.timeGap);
      }
      this.invokeTime = Date.now();
    }
  }

  async generateContent(prompt) {
    if (!this.currentProvider) {
      console.error('AIProviderManager: No provider configured. Please set up an AI provider in Settings.');
      return null;
    }
    await this.checkInvokeTime();
    return this.currentProvider.generateContent(prompt);
  }

  // Generate text from text-and-image input (multimodal)
  async generateMultimodalContent(prompt, imageParts, useJson, startTag) {
    if (!this.currentProvider) {
      console.error('AIProviderManager: No provider configured. Please set up an AI provider in Settings.');
      return '';
    }
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
    if (!this.currentProvider) {
      console.error('AIProviderManager: No provider configured. Please set up an AI provider in Settings.');
      return '';
    }
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
    if (!this.currentProvider) {
      console.error('AIProviderManager: No provider configured. Please set up an AI provider in Settings.');
      return null;
    }
    await this.checkInvokeTime();
    return this.currentProvider.generateContentStream(prompt, imageParts);
  }

  // Use streaming for faster interactions
  async generateChatStream(history, message) {
    if (!this.currentProvider) {
      console.error('AIProviderManager: No provider configured. Please set up an AI provider in Settings.');
      return null;
    }
    await this.checkInvokeTime();
    return this.currentProvider.generateChatStream(history, message);
  }

  async generateImage(message) {
    if (!this.currentProvider) {
      console.error('AIProviderManager: No provider configured. Please set up an AI provider in Settings.');
      return null;
    }
    await this.checkInvokeTime();
    return this.currentProvider.generateImage(message);
  }

  async extractJsonData(openai, model, content) {
    if (!this.currentProvider) {
      console.error('AIProviderManager: No provider configured. Please set up an AI provider in Settings.');
      return null;
    }
    await this.checkInvokeTime();
    return this.generateContentWithJson(
      extractJsonPrompt(extractJsonPrompt(content)),
      true,
    );
  }

  static processResponseJsonData(response, startTag) {
    console.log(response);
    let stripped = '';
    try {
      stripped = stripJsonWrap(response);
      if (!stripped && startTag) stripped = stripJsonByTag(response, startTag);

      // If stripJsonWrap didn't find JSON block markers, try to find raw JSON
      if (!stripped) {
        const trimmed = response.trim();
        // Find first { and last }
        const firstBrace = trimmed.indexOf('{');
        const lastBrace = trimmed.lastIndexOf('}');
        if (firstBrace >= 0 && lastBrace > firstBrace) {
          stripped = trimmed.substring(firstBrace, lastBrace + 1);
        }
      }

      if (!stripped) return '';

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
          // Try converting single quotes to double quotes as fallback
          try {
            // Replace single quotes with double quotes for JSON compatibility
            // This handles JSON with Python-style single quotes
            let converted = stripped;

            // Strategy: Replace single-quoted keys and values with double quotes
            // Handle keys: 'key': -> "key":
            converted = converted.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'\s*:/g, '"$1":');
            // Handle string values: : 'value' -> : "value"
            converted = converted.replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, ': "$1"');
            // Handle array items: , 'item' or ['item'
            converted = converted.replace(/([,\[]\s*)'([^'\\]*(?:\\.[^'\\]*)*)'/g, '$1"$2"');

            return JSON.parse(converted);
          } catch (e4) {
            console.log('JSON parse failed:', e3);
            console.log('Original stripped content:', stripped);
            return '';
          }
        }
      }
    }
  }

  async generateContentWithJson(data, useJson, startTag) {
    if (!this.currentProvider) {
      console.error('AIProviderManager: No provider configured. Please set up an AI provider in Settings.');
      return null;
    }
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

  /**
   * Check if the current provider supports tool/function calling
   * @returns {boolean}
   */
  supportsToolUse() {
    if (!this.currentProvider) {
      return false;
    }
    return typeof this.currentProvider.supportsToolUse === 'function'
      ? this.currentProvider.supportsToolUse()
      : false;
  }

  /**
   * Chat with skills - AI-directed skill execution
   *
   * This method allows the AI to automatically invoke skills based on the conversation.
   * The AI will decide when to use skills and execute them via function calling.
   *
   * @param {Array} messages - Conversation history [{ role: 'user'|'assistant', content: string }]
   * @param {Object} options - Configuration options
   * @param {Object} options.skillExecutor - SkillExecutor instance
   * @param {Object} options.context - Execution context (from ContextManager)
   * @param {Array} options.tools - Tool definitions (from SkillRegistry.getToolDefinitions)
   * @param {string} options.systemPrompt - Optional system prompt
   * @param {number} options.maxIterations - Max tool use iterations (default 5)
   * @param {Function} options.onToolCall - Callback when a tool is called
   * @param {Function} options.onToolResult - Callback when a tool returns
   * @returns {Promise<{ text: string, toolsUsed: Array<string> }>}
   */
  async chatWithSkills(messages, options = {}) {
    if (!this.currentProvider) {
      console.error('AIProviderManager: No provider configured. Please set up an AI provider in Settings.');
      return { text: 'AI provider not configured.', toolsUsed: [] };
    }

    if (!this.supportsToolUse()) {
      // Fallback to regular chat for providers without tool support
      console.warn('AIProviderManager: Current provider does not support tool use. Falling back to regular chat.');
      await this.checkInvokeTime();
      const lastMessage = messages[messages.length - 1];
      const response = await this.currentProvider.sendChatMessage(
        messages.slice(0, -1),
        lastMessage?.content || '',
        {},
      );
      const text = typeof response === 'string' ? response : response[0]?.text || '';
      return { text, toolsUsed: [] };
    }

    const {
      skillExecutor,
      context,
      tools,
      systemPrompt,
      maxIterations = 5,
      onToolCall,
      onToolResult,
    } = options;

    if (!skillExecutor || !tools || tools.length === 0) {
      // No skills provided, just do regular chat
      await this.checkInvokeTime();
      const lastMessage = messages[messages.length - 1];
      const response = await this.currentProvider.sendChatMessage(
        messages.slice(0, -1),
        lastMessage?.content || '',
        {},
      );
      const text = typeof response === 'string' ? response : response[0]?.text || '';
      return { text, toolsUsed: [] };
    }

    await this.checkInvokeTime();

    // Use the provider's chatWithTools method
    const result = await this.currentProvider.chatWithTools(messages, tools, {
      systemPrompt,
      maxIterations,
      onToolCall: (toolCall) => {
        console.log(`[AIProviderManager] Tool called: ${toolCall.name}`, toolCall.input);
        if (onToolCall) {
          onToolCall(toolCall);
        }
      },
      executeTools: async (toolCalls) => {
        // Execute skills and return results
        const results = await skillExecutor.executeToolCalls(toolCalls, context);

        // Notify about results
        if (onToolResult) {
          results.forEach((r, i) => {
            onToolResult(toolCalls[i], r.result);
          });
        }

        return results;
      },
    });

    return result;
  }

  /**
   * Generate content with tool use (single turn)
   *
   * @param {string} prompt - User prompt
   * @param {Array} tools - Tool definitions
   * @param {Object} options - Options including systemPrompt, maxTokens
   * @returns {Promise<{ text: string, toolCalls: Array, stopReason: string }>}
   */
  async generateWithTools(prompt, tools, options = {}) {
    if (!this.currentProvider) {
      console.error('AIProviderManager: No provider configured.');
      return { text: '', toolCalls: [], stopReason: 'error' };
    }

    if (!this.supportsToolUse()) {
      // Fallback: just generate without tools
      await this.checkInvokeTime();
      const response = await this.currentProvider.generateContent(prompt);
      const text = typeof response === 'string' ? response : response[0]?.text || '';
      return { text, toolCalls: [], stopReason: 'end_turn' };
    }

    await this.checkInvokeTime();
    return this.currentProvider.generateWithTools(prompt, tools, options);
  }
}

// Export the singleton instance
const instanceInMain = new AIProviderManager();
const instanceInRender = new AIProviderManager();
// Object.freeze(instance);

export { instanceInMain, instanceInRender };
