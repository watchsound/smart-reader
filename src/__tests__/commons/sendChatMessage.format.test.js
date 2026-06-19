/**
 * Regression tests: sendChatMessage (and generateChatStream) must append new
 * messages as { role: 'user', content: message } — not { 'user': message }.
 *
 * The wrong shape was a copy-paste bug present in ChatGPTProvider,
 * KimiProvider, and BaiduQianfanProvider. All three OpenAI-compatible APIs
 * (and the Qianfan SDK) reject { 'user': message } with a 400 error.
 *
 * These tests pin the correct shape so the bug cannot regress silently.
 */

// ── ChatGPTProvider ──────────────────────────────────────────────────────────

jest.mock('openai', () => {
  const create = jest.fn();
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create } },
  }));
});

const OpenAI = require('openai');

// Isolated require blocks so each suite gets its own module + mock state.
// Jest hoists jest.mock() to module scope; individual suites reset via
// beforeEach + jest.clearAllMocks().

describe('ChatGPTProvider.sendChatMessage — message shape', () => {
  let ChatGPTProvider;
  let mockCreate;

  beforeAll(() => {
    ChatGPTProvider = require('../../commons/service/ChatGPTProvider').default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate = OpenAI.mock.results[OpenAI.mock.results.length - 1]?.value?.chat?.completions?.create;
  });

  it('appends new message as { role: "user", content } (not { user: message })', async () => {
    const provider = new ChatGPTProvider('sk-test', 'gpt-4');
    const history = [{ role: 'assistant', content: 'Hello!' }];

    // mockCreate may not be set yet — mock the return for the next call
    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'reply' } }],
          }),
        },
      },
    }));
    const freshProvider = new ChatGPTProvider('sk-test', 'gpt-4');

    await freshProvider.sendChatMessage(history, 'hi there');

    // Retrieve the messages passed to the OpenAI SDK
    const instance = OpenAI.mock.results[OpenAI.mock.results.length - 1].value;
    const callArgs = instance.chat.completions.create.mock.calls[0][0];
    const lastMsg = callArgs.messages[callArgs.messages.length - 1];

    expect(lastMsg).toEqual({ role: 'user', content: 'hi there' });
    expect(lastMsg).not.toHaveProperty('user');
  });

  it('does not append when message is falsy', async () => {
    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'ok' } }],
          }),
        },
      },
    }));
    const provider = new ChatGPTProvider('sk-test', 'gpt-4');
    const history = [{ role: 'user', content: 'prior' }];

    await provider.sendChatMessage(history, '');

    const instance = OpenAI.mock.results[OpenAI.mock.results.length - 1].value;
    const callArgs = instance.chat.completions.create.mock.calls[0][0];
    expect(callArgs.messages).toHaveLength(1);
    expect(callArgs.messages[0]).toEqual({ role: 'user', content: 'prior' });
  });
});

// ── KimiProvider ─────────────────────────────────────────────────────────────

describe('KimiProvider.sendChatMessage — message shape', () => {
  it('appends new message as { role: "user", content } (not { user: message })', async () => {
    OpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'kimi reply' } }],
          }),
        },
      },
    }));
    const KimiProvider = require('../../commons/service/KimiProvider').default;
    const provider = new KimiProvider('kimi-key');
    const history = [{ role: 'assistant', content: 'hey' }];

    await provider.sendChatMessage(history, 'follow up');

    const instance = OpenAI.mock.results[OpenAI.mock.results.length - 1].value;
    const callArgs = instance.chat.completions.create.mock.calls[0][0];
    const lastMsg = callArgs.messages[callArgs.messages.length - 1];

    expect(lastMsg).toEqual({ role: 'user', content: 'follow up' });
    expect(lastMsg).not.toHaveProperty('user');
  });
});

// ── BaiduQianfanProvider ─────────────────────────────────────────────────────

jest.mock('@baiducloud/qianfan', () => {
  const chatFn = jest.fn();
  const ChatCompletion = jest.fn().mockImplementation(() => ({ chat: chatFn }));
  ChatCompletion.__getChatFn = () => chatFn;
  return { ChatCompletion, Text2Image: jest.fn(), Image2Text: jest.fn() };
});

describe('BaiduQianfanProvider.sendChatMessage — message shape', () => {
  it('appends new message as { role: "user", content } (not { user: message })', async () => {
    const { ChatCompletion } = require('@baiducloud/qianfan');
    const chatFn = ChatCompletion.__getChatFn();
    chatFn.mockResolvedValue({ result: 'qianfan reply' });

    const BaiduQianfanProvider = require('../../commons/service/BaiduQianfanProvider').default;
    const provider = new BaiduQianfanProvider('ak', 'sk');
    const history = [{ role: 'user', content: 'first' }];

    await provider.sendChatMessage(history, 'second');

    const callArgs = chatFn.mock.calls[0][0];
    const lastMsg = callArgs.messages[callArgs.messages.length - 1];
    expect(lastMsg).toEqual({ role: 'user', content: 'second' });
    expect(lastMsg).not.toHaveProperty('user');
  });

  it('generateChatStream appends new message as { role: "user", content }', async () => {
    const { ChatCompletion } = require('@baiducloud/qianfan');
    const chatFn = ChatCompletion.__getChatFn();
    // Return an async iterable that yields one chunk then ends
    chatFn.mockResolvedValue(
      (async function* () { yield { result: 'chunk' }; })()
    );

    const BaiduQianfanProvider = require('../../commons/service/BaiduQianfanProvider').default;
    const provider = new BaiduQianfanProvider('ak', 'sk');

    await provider.generateChatStream([{ role: 'user', content: 'hi' }], 'follow');

    const callArgs = chatFn.mock.calls[chatFn.mock.calls.length - 1][0];
    const lastMsg = callArgs.messages[callArgs.messages.length - 1];
    expect(lastMsg).toEqual({ role: 'user', content: 'follow' });
    expect(lastMsg).not.toHaveProperty('user');
  });
});
