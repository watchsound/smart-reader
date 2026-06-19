/**
 * AIProviderManager registry — the cross-provider failover registry
 * introduced in Phase 15a-1. Pins:
 *   - register/has/get round-trip
 *   - empty keys are ignored (no eligibility for empty-string accounts)
 *   - getProviderByName stamps the canonical name onto the instance so the
 *     Call Ledger records correctly
 *   - unknown names → null (chain walker can safely skip)
 */

const {
  instanceInMain: aiProviderManager,
} = require('../../commons/service/AIProviderManager');
const { AIProvider } = require('../../commons/model/DataTypes');

beforeEach(() => {
  aiProviderManager.providerRegistry.clear();
});

describe('AIProviderManager registry', () => {
  test('registerProvider with a key makes hasRegisteredProvider true', () => {
    expect(aiProviderManager.hasRegisteredProvider(AIProvider.Kimi)).toBe(false);
    aiProviderManager.registerProvider(AIProvider.Kimi, 'k-key', 'moonshot-v1-8k');
    expect(aiProviderManager.hasRegisteredProvider(AIProvider.Kimi)).toBe(true);
  });

  test('registerProvider with empty key is a no-op', () => {
    aiProviderManager.registerProvider(AIProvider.Claude, '', 'claude-haiku-4-5');
    expect(aiProviderManager.hasRegisteredProvider(AIProvider.Claude)).toBe(false);
  });

  test('registerProvider with empty name is a no-op', () => {
    aiProviderManager.registerProvider('', 'some-key', 'some-model');
    expect(aiProviderManager.providerRegistry.size).toBe(0);
  });

  test('getProviderByName returns a constructed instance with name stamped', () => {
    aiProviderManager.registerProvider(AIProvider.DeepSeek, 'ds-key', 'deepseek-chat');
    const p = aiProviderManager.getProviderByName(AIProvider.DeepSeek);
    expect(p).not.toBeNull();
    expect(p.name).toBe(AIProvider.DeepSeek);
    expect(p.model).toBe('deepseek-chat');
  });

  test('getProviderByName returns null for unregistered names', () => {
    expect(aiProviderManager.getProviderByName(AIProvider.Qwen)).toBeNull();
  });

  test('each getProviderByName call returns a fresh instance', () => {
    aiProviderManager.registerProvider(AIProvider.Kimi, 'k-key', 'moonshot-v1-8k');
    const a = aiProviderManager.getProviderByName(AIProvider.Kimi);
    const b = aiProviderManager.getProviderByName(AIProvider.Kimi);
    expect(a).not.toBe(b);
  });

  test('registry survives across providers (multi-key tenant)', () => {
    aiProviderManager.registerProvider(AIProvider.DeepSeek, 'ds-key', 'deepseek-chat');
    aiProviderManager.registerProvider(AIProvider.Kimi, 'k-key', 'moonshot-v1-8k');
    aiProviderManager.registerProvider(AIProvider.ChatGPT, 'gpt-key', 'gpt-4o-mini');
    expect(aiProviderManager.hasRegisteredProvider(AIProvider.DeepSeek)).toBe(true);
    expect(aiProviderManager.hasRegisteredProvider(AIProvider.Kimi)).toBe(true);
    expect(aiProviderManager.hasRegisteredProvider(AIProvider.ChatGPT)).toBe(true);
    expect(aiProviderManager.hasRegisteredProvider(AIProvider.Gemini)).toBe(false);
  });
});
