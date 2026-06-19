/**
 * Unit tests for structuredOutput.js polyfill.
 *
 * Covers:
 *   - json-mode branch: calls generateJsonMode when provider declares it + exposes the method
 *   - json-mode parse failure: warns and returns '' when processResponseJsonData fails
 *   - json-mode fallthrough: falls back to prompt-only when generateJsonMode is absent
 *   - capability detection: uses capabilities(), not supports(), to read the level
 *   - prompt-only branch: uses generateContent with schema instruction appended
 *   - parse retry: re-prompts with stricter instruction on first parse failure
 *   - null provider: returns '' immediately
 */

jest.mock('../../commons/service/AIProviderManager', () => ({
  AIProviderManager: {
    processResponseJsonData: jest.fn(),
  },
}));

const { AIProviderManager } = require('../../commons/service/AIProviderManager');
const { getStructured } = require('../../commons/service/polyfills/structuredOutput');

const SCHEMA = { type: 'object', properties: { x: { type: 'string' } } };
const PROMPT = 'test prompt';

function makeProvider({ level, hasJsonMode = false }) {
  return {
    supports: jest.fn(() => true),
    capabilities: jest.fn(() => ({ structuredOutput: level })),
    generateContent: jest.fn(),
    ...(hasJsonMode ? { generateJsonMode: jest.fn() } : {}),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getStructured — json-mode branch', () => {
  it('calls generateJsonMode (not generateContent) when provider declares json-mode and exposes the method', async () => {
    const provider = makeProvider({ level: 'json-mode', hasJsonMode: true });
    const parsed = { x: 'hello' };
    provider.generateJsonMode.mockResolvedValue('{"x":"hello"}');
    AIProviderManager.processResponseJsonData.mockReturnValue(parsed);

    const result = await getStructured(provider, PROMPT, SCHEMA);

    expect(provider.generateJsonMode).toHaveBeenCalledTimes(1);
    expect(provider.generateContent).not.toHaveBeenCalled();
    expect(result).toBe(parsed);
  });

  it('passes prompt + schema instruction to generateJsonMode', async () => {
    const provider = makeProvider({ level: 'json-mode', hasJsonMode: true });
    provider.generateJsonMode.mockResolvedValue('{}');
    AIProviderManager.processResponseJsonData.mockReturnValue({});

    await getStructured(provider, PROMPT, SCHEMA);

    const calledWith = provider.generateJsonMode.mock.calls[0][0];
    expect(calledWith).toContain(PROMPT);
    expect(calledWith).toContain(JSON.stringify(SCHEMA, null, 2));
  });

  it('warns and returns parsed value when processResponseJsonData returns empty (parse failure)', async () => {
    const provider = makeProvider({ level: 'json-mode', hasJsonMode: true });
    provider.generateJsonMode.mockResolvedValue('not json');
    AIProviderManager.processResponseJsonData.mockReturnValue('');
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await getStructured(provider, PROMPT, SCHEMA);

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('json-mode parse failed'));
    expect(result).toBe('');
    warnSpy.mockRestore();
  });

  it('falls through to prompt-only when generateJsonMode is absent despite json-mode declaration', async () => {
    const provider = makeProvider({ level: 'json-mode', hasJsonMode: false });
    const parsed = { x: 'fallback' };
    provider.generateContent.mockResolvedValue('{"x":"fallback"}');
    AIProviderManager.processResponseJsonData.mockReturnValue(parsed);

    const result = await getStructured(provider, PROMPT, SCHEMA);

    expect(provider.generateContent).toHaveBeenCalledTimes(1);
    expect(result).toBe(parsed);
  });
});

describe('getStructured — prompt-only branch', () => {
  it('calls generateContent with schema instruction appended', async () => {
    const provider = makeProvider({ level: 'prompt-only' });
    provider.generateContent.mockResolvedValue('{"x":"y"}');
    AIProviderManager.processResponseJsonData.mockReturnValue({ x: 'y' });

    await getStructured(provider, PROMPT, SCHEMA);

    const calledWith = provider.generateContent.mock.calls[0][0];
    expect(calledWith).toContain(PROMPT);
    expect(calledWith).toContain(JSON.stringify(SCHEMA, null, 2));
  });

  it('retries once on parse failure and adds stricter instruction', async () => {
    const provider = makeProvider({ level: 'prompt-only' });
    provider.generateContent
      .mockResolvedValueOnce('not json')
      .mockResolvedValueOnce('{"x":"ok"}');
    AIProviderManager.processResponseJsonData
      .mockReturnValueOnce(null)
      .mockReturnValueOnce({ x: 'ok' });

    const result = await getStructured(provider, PROMPT, SCHEMA, { maxRetries: 1 });

    expect(provider.generateContent).toHaveBeenCalledTimes(2);
    const secondCall = provider.generateContent.mock.calls[1][0];
    expect(secondCall).toContain('not valid JSON');
    expect(result).toEqual({ x: 'ok' });
  });

  it('returns empty string when all retries exhaust without a parse', async () => {
    const provider = makeProvider({ level: 'prompt-only' });
    provider.generateContent.mockResolvedValue('still not json');
    AIProviderManager.processResponseJsonData.mockReturnValue(null);

    const result = await getStructured(provider, PROMPT, SCHEMA, { maxRetries: 1 });

    expect(provider.generateContent).toHaveBeenCalledTimes(2);
    expect(result).toBe('');
  });
});

describe('getStructured — capability detection', () => {
  it('reads structuredOutput from capabilities() not supports() — provider without supports() still routes correctly', async () => {
    // A duck-typed provider that has capabilities() but no supports() method.
    // Before the C1 fix (typeof provider.supports check), this would fall to prompt-only.
    const provider = {
      capabilities: jest.fn(() => ({ structuredOutput: 'json-mode' })),
      generateContent: jest.fn(),
      generateJsonMode: jest.fn().mockResolvedValue('{"x":"1"}'),
    };
    const parsed = { x: '1' };
    AIProviderManager.processResponseJsonData.mockReturnValue(parsed);

    const result = await getStructured(provider, PROMPT, SCHEMA);

    expect(provider.generateJsonMode).toHaveBeenCalledTimes(1);
    expect(provider.generateContent).not.toHaveBeenCalled();
    expect(result).toBe(parsed);
  });

  it('falls back to prompt-only when provider has neither capabilities() nor supports()', async () => {
    const provider = {
      generateContent: jest.fn().mockResolvedValue('{"x":"2"}'),
    };
    const parsed = { x: '2' };
    AIProviderManager.processResponseJsonData.mockReturnValue(parsed);

    const result = await getStructured(provider, PROMPT, SCHEMA);

    expect(provider.generateContent).toHaveBeenCalledTimes(1);
    expect(result).toBe(parsed);
  });
});

describe('getStructured — no provider', () => {
  it('returns empty string without calling any LLM method', async () => {
    const result = await getStructured(null, PROMPT, SCHEMA);
    expect(result).toBe('');
  });
});
