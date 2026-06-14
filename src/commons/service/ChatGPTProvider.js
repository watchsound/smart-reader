/* eslint-disable prettier/prettier */
/* eslint-disable no-restricted-syntax */
import OpenAI from 'openai';
import { AIProviderInterface } from './AIProviderInterface';
import { ChatGPTModel } from '../model/DataTypes';

export default class ChatGPTProvider extends AIProviderInterface {
  static capabilities = {
    maxContext: 128000,
    structuredOutput: 'native',
    toolUse: true,
    promptCaching: true,
    extendedThinking: false,
    imageInput: true,
    streaming: true,
  };

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

  /**
   * Check if this provider supports tool/function calling
   * @returns {boolean}
   */
  supportsToolUse() {
    return true;
  }

  /**
   * Generate content with tool use (function calling)
   *
   * @param {string} prompt - User prompt
   * @param {Array} tools - Array of tool definitions (Claude format, will be converted)
   * @param {Object} options
   * @param {string} options.systemPrompt - System prompt
   * @param {number} options.maxTokens - Max tokens (default 4096)
   * @param {string} options.toolChoice - 'auto' | 'none' | 'required' (default 'auto')
   * @returns {Promise<{ text: string, toolCalls: Array, stopReason: string }>}
   */
  async generateWithTools(prompt, tools, options = {}) {
    const openai = new OpenAI({ apiKey: this.apiKey, dangerouslyAllowBrowser: true });
    const { systemPrompt, maxTokens = 4096, toolChoice = 'auto' } = options;

    const messages = [];

    // Add system prompt if provided
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    const requestParams = {
      model: this.model,
      max_tokens: maxTokens,
      messages,
    };

    // Convert tools from Claude format to OpenAI format
    if (tools && tools.length > 0) {
      requestParams.tools = tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }));
      requestParams.tool_choice = toolChoice;
    }

    const response = await openai.chat.completions.create(requestParams);
    return this.parseToolResponse(response);
  }

  /**
   * Continue conversation after tool results
   *
   * @param {Array} messages - Previous messages in conversation
   * @param {Array} toolResults - Results from tool executions
   * @param {Array} tools - Tool definitions
   * @param {Object} options
   * @returns {Promise<{ text: string, toolCalls: Array, stopReason: string }>}
   */
  async continueWithToolResults(messages, toolResults, tools, options = {}) {
    const openai = new OpenAI({ apiKey: this.apiKey, dangerouslyAllowBrowser: true });
    const { systemPrompt, maxTokens = 4096 } = options;

    // Build tool result messages (OpenAI format)
    const toolResultMessages = toolResults.map(r => ({
      role: 'tool',
      tool_call_id: r.id,
      content: typeof r.result === 'string' ? r.result : JSON.stringify(r.result),
    }));

    // Build complete message list
    const allMessages = [];

    if (systemPrompt) {
      allMessages.push({ role: 'system', content: systemPrompt });
    }

    // Add previous messages (convert from Claude format if needed)
    for (const msg of messages) {
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        // Claude-style assistant message with tool_use blocks
        const textParts = msg.content.filter(c => c.type === 'text').map(c => c.text).join('');
        const toolUseParts = msg.content.filter(c => c.type === 'tool_use');

        allMessages.push({
          role: 'assistant',
          content: textParts || null,
          tool_calls: toolUseParts.map(tc => ({
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

    // Add tool results
    allMessages.push(...toolResultMessages);

    const requestParams = {
      model: this.model,
      max_tokens: maxTokens,
      messages: allMessages,
    };

    if (tools && tools.length > 0) {
      requestParams.tools = tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }));
    }

    const response = await openai.chat.completions.create(requestParams);
    return this.parseToolResponse(response);
  }

  /**
   * Parse OpenAI API response to extract text and tool calls
   * @param {Object} response
   * @returns {{ text: string, toolCalls: Array, stopReason: string }}
   */
  parseToolResponse(response) {
    const message = response.choices[0].message;
    const result = {
      text: message.content || '',
      toolCalls: [],
      stopReason: response.choices[0].finish_reason,
    };

    if (message.tool_calls) {
      result.toolCalls = message.tool_calls.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments),
      }));
    }

    return result;
  }

  /**
   * Chat with tool use - full agentic conversation
   *
   * @param {Array} messages - Conversation history
   * @param {Array} tools - Available tools
   * @param {Object} options
   * @param {string} options.systemPrompt
   * @param {number} options.maxIterations - Max tool use iterations (default 5)
   * @param {Function} options.onToolCall - Callback when tool is called
   * @param {Function} options.executeTools - Function to execute tool calls
   * @returns {Promise<{ text: string, toolsUsed: Array }>}
   */
  async chatWithTools(messages, tools, options = {}) {
    const {
      systemPrompt,
      maxIterations = 5,
      onToolCall,
      executeTools,
    } = options;

    if (!executeTools) {
      throw new Error('executeTools function is required for chatWithTools');
    }

    let currentMessages = [...messages];
    const toolsUsed = [];
    let iteration = 0;

    // Initial request
    const lastMessage = currentMessages[currentMessages.length - 1];
    let response = await this.generateWithTools(
      lastMessage.content,
      tools,
      { systemPrompt, maxTokens: options.maxTokens || 4096 }
    );

    // Handle tool calls in a loop
    while (response.toolCalls.length > 0 && iteration < maxIterations) {
      iteration++;

      // Notify about tool calls
      if (onToolCall) {
        for (const tc of response.toolCalls) {
          onToolCall(tc);
        }
      }

      // Execute tools
      const toolResults = await executeTools(response.toolCalls);
      toolsUsed.push(...response.toolCalls.map(tc => tc.name));

      // Build assistant message with tool calls (Claude format for consistency)
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

      // Update messages
      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: assistantContent },
      ];

      // Continue with tool results
      response = await this.continueWithToolResults(
        currentMessages,
        toolResults,
        tools,
        { systemPrompt, maxTokens: options.maxTokens || 4096 }
      );
    }

    return {
      text: response.text,
      toolsUsed: [...new Set(toolsUsed)], // unique tools
    };
  }
}
