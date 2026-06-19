/**
 * Unit tests for BaiduProvider.
 *
 * Covers the three bugs fixed:
 *  1. generateContent must send { messages: [...] } (not { prompt })
 *  2. generateContent must return the text string (data.result), not the response object
 *  3. sendChatMessage must return the text string (data.result), not the response object
 *
 * axios is mocked — no real network calls.
 */

jest.mock('axios');

const axios = require('axios');
const BaiduProvider = require('../../commons/service/BaiduProvider').default;

const ACCESS_TOKEN = 'test-access-token';
const CHAT_URL =
  'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('BaiduProvider.generateContent', () => {
  it('sends messages-array body (not the old prompt field)', async () => {
    axios.post.mockResolvedValue({ data: { result: 'ok' } });
    const provider = new BaiduProvider(ACCESS_TOKEN);
    await provider.generateContent('hello');

    expect(axios.post).toHaveBeenCalledTimes(1);
    const body = JSON.parse(axios.post.mock.calls[0][1]);
    expect(body).toHaveProperty('messages');
    expect(body.messages[0]).toEqual({ role: 'user', content: 'hello' });
    expect(body).not.toHaveProperty('prompt');
  });

  it('includes Content-Type: application/json header', async () => {
    axios.post.mockResolvedValue({ data: { result: 'ok' } });
    const provider = new BaiduProvider(ACCESS_TOKEN);
    await provider.generateContent('hello');

    const headers = axios.post.mock.calls[0][2]?.headers;
    expect(headers?.['Content-Type']).toBe('application/json');
  });

  it('returns the text string from data.result (not the response object)', async () => {
    const responseBody = { id: 'abc', result: 'The answer is 42', usage: {} };
    axios.post.mockResolvedValue({ data: responseBody });
    const provider = new BaiduProvider(ACCESS_TOKEN);

    const result = await provider.generateContent('what is the answer?');

    expect(typeof result).toBe('string');
    expect(result).toBe('The answer is 42');
  });

  it('returns empty string when API call throws', async () => {
    axios.post.mockRejectedValue(new Error('network error'));
    const provider = new BaiduProvider(ACCESS_TOKEN);

    const result = await provider.generateContent('hello');

    expect(result).toBe('');
  });

  it('returns empty string when data.result is absent', async () => {
    axios.post.mockResolvedValue({ data: { id: 'abc' } });
    const provider = new BaiduProvider(ACCESS_TOKEN);

    const result = await provider.generateContent('hello');

    expect(result).toBe('');
  });

  it('appends access_token to the URL', async () => {
    axios.post.mockResolvedValue({ data: { result: 'ok' } });
    const provider = new BaiduProvider('my-token');
    await provider.generateContent('hi');

    const url = axios.post.mock.calls[0][0];
    expect(url).toContain('access_token=my-token');
    expect(url).toContain(CHAT_URL);
  });
});

describe('BaiduProvider.sendChatMessage', () => {
  it('returns the text string from data.result (not the response object)', async () => {
    const responseBody = { result: 'Chat reply here', usage: {} };
    axios.post.mockResolvedValue({ data: responseBody });
    const provider = new BaiduProvider(ACCESS_TOKEN);

    const result = await provider.sendChatMessage([], 'hello');

    expect(typeof result).toBe('string');
    expect(result).toBe('Chat reply here');
  });

  it('appends the new message to history before sending', async () => {
    axios.post.mockResolvedValue({ data: { result: 'ok' } });
    const provider = new BaiduProvider(ACCESS_TOKEN);
    const history = [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hey' }];

    await provider.sendChatMessage(history, 'follow up');

    const body = JSON.parse(axios.post.mock.calls[0][1]);
    expect(body.messages).toHaveLength(3);
    expect(body.messages[2]).toEqual({ role: 'user', content: 'follow up' });
  });

  it('returns empty string on network error', async () => {
    axios.post.mockRejectedValue(new Error('timeout'));
    const provider = new BaiduProvider(ACCESS_TOKEN);

    const result = await provider.sendChatMessage([], 'hi');

    expect(result).toBe('');
  });
});

describe('BaiduProvider capabilities', () => {
  it('declares structuredOutput as prompt-only (not json-mode)', () => {
    expect(BaiduProvider.capabilities.structuredOutput).toBe('prompt-only');
  });
});
