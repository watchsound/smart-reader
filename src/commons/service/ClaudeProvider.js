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
   * @param {Array} tools - Array of tool definitions
   * @param {Object} options
   * @param {string} options.systemPrompt - System prompt
   * @param {number} options.maxTokens - Max tokens (default 4096)
   * @returns {Promise<{ text: string, toolCalls: Array, stopReason: string }>}
   *
   * Tool definition format:
   * {
   *   name: 'tool_name',
   *   description: 'What the tool does',
   *   input_schema: {
   *     type: 'object',
   *     properties: { ... },
   *     required: ['param1']
   *   }
   * }
   */
  async generateWithTools(prompt, tools, options = {}) {
    const client = this.createModel();
    const { systemPrompt, maxTokens = 4096 } = options;

    const requestParams = {
      model: this.model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    };

    // Add system prompt if provided
    if (systemPrompt) {
      requestParams.system = systemPrompt;
    }

    // Add tools if provided
    if (tools && tools.length > 0) {
      requestParams.tools = tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      }));
    }

    const response = await client.messages.create(requestParams);
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
   *
   * toolResults format:
   * [{ id: 'tool_use_id', result: { ... } }]
   */
  async continueWithToolResults(messages, toolResults, tools, options = {}) {
    const client = this.createModel();
    const { systemPrompt, maxTokens = 4096 } = options;

    // Build tool result content blocks
    const toolResultContent = toolResults.map(r => ({
      type: 'tool_result',
      tool_use_id: r.id,
      content: typeof r.result === 'string' ? r.result : JSON.stringify(r.result),
    }));

    // Add tool results as user message
    const updatedMessages = [
      ...messages,
      { role: 'user', content: toolResultContent },
    ];

    const requestParams = {
      model: this.model,
      max_tokens: maxTokens,
      messages: updatedMessages,
    };

    if (systemPrompt) {
      requestParams.system = systemPrompt;
    }

    if (tools && tools.length > 0) {
      requestParams.tools = tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      }));
    }

    const response = await client.messages.create(requestParams);
    return this.parseToolResponse(response);
  }

  /**
   * Parse Claude API response to extract text and tool calls
   * @param {Object} response
   * @returns {{ text: string, toolCalls: Array, stopReason: string }}
   */
  parseToolResponse(response) {
    const result = {
      text: '',
      toolCalls: [],
      stopReason: response.stop_reason,
    };

    for (const block of response.content) {
      if (block.type === 'text') {
        result.text += block.text;
      } else if (block.type === 'tool_use') {
        result.toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input,
        });
      }
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

      // Build assistant message with tool use
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
