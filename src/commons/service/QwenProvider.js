/* eslint-disable prettier/prettier */
/* eslint-disable no-restricted-syntax */
/**
 * QwenProvider.js
 *
 * AI Provider for Alibaba's Qwen (通义千问) models via Alibaba Cloud Model Studio.
 * Uses OpenAI-compatible API endpoint.
 *
 * API Documentation: https://www.alibabacloud.com/help/en/model-studio/
 * Endpoint: https://dashscope.aliyuncs.com/compatible-mode/v1
 */

import OpenAI from 'openai';
import { AIProviderInterface } from './AIProviderInterface';
import { QwenModel } from '../model/DataTypes';

// Qwen API base URL (DashScope OpenAI-compatible mode)
const QWEN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

export default class QwenProvider extends AIProviderInterface {
  constructor(apiKey, model) {
    super(0, true);
    this.apiKey = apiKey;
    this.model = model || QwenModel.QWEN_PLUS;
  }

  createClient() {
    return new OpenAI({
      apiKey: this.apiKey,
      baseURL: QWEN_BASE_URL,
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

  /**
   * Generate content with image input (multimodal)
   * Qwen-VL models support vision
   * @param {string} prompt - Text prompt
   * @param {Object} imageParts - Image data { data: base64, mimeType: string }
   */
  async generateMultimodalContent(prompt, imageParts) {
    const client = this.createClient();
    // Use qwen-vl model for multimodal
    const visionModel = 'qwen-vl-max';

    const chatCompletion = await client.chat.completions.create({
      model: visionModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: Array.isArray(imageParts)
                  ? `data:${imageParts[0].mimeType};base64,${imageParts[0].data}`
                  : imageParts,
              },
            },
          ],
        },
      ],
    });
    return chatCompletion.choices[0].message?.content;
  }

  /**
   * Send chat message with history
   * @param {Array} history - Array of { role, content }
   * @param {string} message - New message
   */
  async sendChatMessage(history, message) {
    const client = this.createClient();
    const newHistory = message
      ? [...history, { role: 'user', content: message }]
      : history;
    const chatCompletion = await client.chat.completions.create({
      messages: newHistory,
      model: this.model,
    });
    return chatCompletion.choices[0].message?.content;
  }

  /**
   * Generate content with streaming
   */
  async generateContentStream(prompt) {
    const client = this.createClient();
    const stream = await client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      stream: true,
    });

    return {
      stream: (async function* () {
        for await (const chunk of stream) {
          yield {
            data: () => chunk.choices[0]?.delta?.content || '',
          };
        }
      })(),
    };
  }

  /**
   * Chat with streaming
   */
  async generateChatStream(history, message) {
    const client = this.createClient();
    const h = message
      ? [...history, { role: 'user', content: message }]
      : history;
    const stream = await client.chat.completions.create({
      model: this.model,
      messages: h,
      stream: true,
    });

    return {
      stream: (async function* () {
        for await (const chunk of stream) {
          yield {
            data: () => chunk.choices[0]?.delta?.content || '',
          };
        }
      })(),
    };
  }

  async generateImage() {
    throw new Error('Use Alibaba Wanx API for image generation');
  }

  /**
   * Check if this provider supports tool/function calling
   */
  supportsToolUse() {
    // Qwen supports function calling on plus, max, and turbo models
    return true;
  }

  /**
   * Generate content with tool use (function calling)
   */
  async generateWithTools(prompt, tools, options = {}) {
    const client = this.createClient();
    const { systemPrompt, maxTokens = 4096, toolChoice = 'auto' } = options;

    const messages = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    const requestParams = {
      model: this.model,
      max_tokens: maxTokens,
      messages,
    };

    if (tools && tools.length > 0) {
      requestParams.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }));
      requestParams.tool_choice = toolChoice;
    }

    const response = await client.chat.completions.create(requestParams);
    return this.parseToolResponse(response);
  }

  /**
   * Continue conversation after tool results
   */
  async continueWithToolResults(messages, toolResults, tools, options = {}) {
    const client = this.createClient();
    const { systemPrompt, maxTokens = 4096 } = options;

    const toolResultMessages = toolResults.map((r) => ({
      role: 'tool',
      tool_call_id: r.id,
      content: typeof r.result === 'string' ? r.result : JSON.stringify(r.result),
    }));

    const allMessages = [];

    if (systemPrompt) {
      allMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        const textParts = msg.content
          .filter((c) => c.type === 'text')
          .map((c) => c.text)
          .join('');
        const toolUseParts = msg.content.filter((c) => c.type === 'tool_use');

        allMessages.push({
          role: 'assistant',
          content: textParts || null,
          tool_calls: toolUseParts.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.input),
            },
          })),
        });
      } else {
        allMessages.push(msg);
      }
    }

    allMessages.push(...toolResultMessages);

    const requestParams = {
      model: this.model,
      max_tokens: maxTokens,
      messages: allMessages,
    };

    if (tools && tools.length > 0) {
      requestParams.tools = tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }));
    }

    const response = await client.chat.completions.create(requestParams);
    return this.parseToolResponse(response);
  }

  /**
   * Parse API response to extract text and tool calls
   */
  parseToolResponse(response) {
    const message = response.choices[0].message;
    const result = {
      text: message.content || '',
      toolCalls: [],
      stopReason: response.choices[0].finish_reason,
    };

    if (message.tool_calls) {
      result.toolCalls = message.tool_calls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments),
      }));
    }

    return result;
  }

  /**
   * Chat with tool use - full agentic conversation
   */
  async chatWithTools(messages, tools, options = {}) {
    const { systemPrompt, maxIterations = 5, onToolCall, executeTools } = options;

    if (!executeTools) {
      throw new Error('executeTools function is required for chatWithTools');
    }

    let currentMessages = [...messages];
    const toolsUsed = [];
    let iteration = 0;

    const lastMessage = currentMessages[currentMessages.length - 1];
    let response = await this.generateWithTools(lastMessage.content, tools, {
      systemPrompt,
      maxTokens: options.maxTokens || 4096,
    });

    while (response.toolCalls.length > 0 && iteration < maxIterations) {
      iteration++;

      if (onToolCall) {
        for (const tc of response.toolCalls) {
          onToolCall(tc);
        }
      }

      const toolResults = await executeTools(response.toolCalls);
      toolsUsed.push(...response.toolCalls.map((tc) => tc.name));

      const assistantContent = [];
      if (response.text) {
        assistantContent.push({ type: 'text', text: response.text });
      }
      for (const tc of response.toolCalls) {
        assistantContent.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: tc.input,
        });
      }

      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: assistantContent },
      ];

      response = await this.continueWithToolResults(
        currentMessages,
        toolResults,
        tools,
        { systemPrompt, maxTokens: options.maxTokens || 4096 }
      );
    }

    return {
      text: response.text,
      toolsUsed: [...new Set(toolsUsed)],
    };
  }
}
