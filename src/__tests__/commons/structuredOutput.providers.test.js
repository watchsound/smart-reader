/**
 * Regression tests: structured-output capability declarations must be consistent
 * with what getStructured() actually routes.
 *
 * Bug fixed: ChatGPT, Gemini, and Claude all declared 'native' but the native
 * branch in structuredOutput.js is commented out, so they silently fell through
 * to prompt-only — a worse path than the json-mode providers (DeepSeek, Kimi, etc).
 *
 * Fix:
 *   - ChatGPTProvider: capability → 'json-mode' + generateJsonMode() implemented
 *   - GeminiProvider:  capability → 'prompt-only' (SDK v0.1.3 predates responseMimeType)
 *   - ClaudeProvider:  capability → 'prompt-only' (tool_use-based JSON is deferred)
 */

// ── ChatGPTProvider — json-mode ──────────────────────────────────────────────

jest.mock('openai', () => {
  const create = jest.fn();
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create } },
  }));
});

const OpenAI = require('openai');

describe('ChatGPTProvider.generateJsonMode', () => {
  let ChatGPTProvider;

  beforeAll(() => {
    ChatGPTProvider = require('../../commons/service/ChatGPTProvider').default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends response_format: json_object to the OpenAI SDK', async () => {
    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: '{"result":"ok"}' } }],
          }),
        },
      },
    }));
    const provider = new ChatGPTProvider('sk-test', 'gpt-4o');

    await provider.generateJsonMode('return a JSON object');

    const instance = OpenAI.mock.results[OpenAI.mock.results.length - 1].value;
    const callArgs = instance.chat.completions.create.mock.calls[0][0];
    expect(callArgs.response_format).toEqual({ type: 'json_object' });
  });

  it('returns the content string from the API response', async () => {
    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: '{"x":1}' } }],
          }),
        },
      },
    }));
    const provider = new ChatGPTProvider('sk-test', 'gpt-4o');

    const result = await provider.generateJsonMode('prompt');

    expect(result).toBe('{"x":1}');
  });

  it('passes the prompt as a user message', async () => {
    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: '{}' } }],
          }),
        },
      },
    }));
    const provider = new ChatGPTProvider('sk-test', 'gpt-4o');

    await provider.generateJsonMode('my specific prompt');

    const instance = OpenAI.mock.results[OpenAI.mock.results.length - 1].value;
    const callArgs = instance.chat.completions.create.mock.calls[0][0];
    expect(callArgs.messages).toEqual([{ role: 'user', content: 'my specific prompt' }]);
  });
});

// ── Capability declarations ──────────────────────────────────────────────────

describe('provider structuredOutput capability declarations', () => {
  it('ChatGPTProvider declares json-mode (not native)', () => {
    const ChatGPTProvider = require('../../commons/service/ChatGPTProvider').default;
    expect(ChatGPTProvider.capabilities.structuredOutput).toBe('json-mode');
  });

  it('GeminiProvider declares prompt-only (not native)', () => {
    jest.mock('@google/generative-ai', () => ({}));
    const GeminiProvider = require('../../commons/service/GeminiProvider').default;
    expect(GeminiProvider.capabilities.structuredOutput).toBe('prompt-only');
  });

  it('ClaudeProvider declares prompt-only (not native)', () => {
    jest.mock('@anthropic-ai/sdk', () => ({ default: jest.fn() }));
    const ClaudeProvider = require('../../commons/service/ClaudeProvider').default;
    expect(ClaudeProvider.capabilities.structuredOutput).toBe('prompt-only');
  });

  it('ChatGPTProvider exposes generateJsonMode (required by json-mode routing)', () => {
    const ChatGPTProvider = require('../../commons/service/ChatGPTProvider').default;
    const provider = new ChatGPTProvider('key');
    expect(typeof provider.generateJsonMode).toBe('function');
  });
});
