/**
 * Tests: DeepSeek wiring in AIProviderManager (Phase 13.3)
 *
 * Covers:
 *  1. preSetup with provider=DeepSeek picks apiKeyDeepSeek
 *  2. preSetup with no provider but apiKeyDeepSeek set falls back to DeepSeek
 *  3. setup() with provider=DeepSeek instantiates a DeepSeekProvider
 */

import { AIProviderManager } from '../../commons/service/AIProviderManager';
import { AIProvider, DeepSeekModel } from '../../commons/model/DataTypes';

// Mock the provider classes so we don't need real API keys or OpenAI SDK
jest.mock('../../commons/service/DeepSeekProvider', () => {
  return jest.fn().mockImplementation((apiKey, model) => ({
    apiKey,
    model: model || DeepSeekModel.DEEPSEEK_CHAT,
    timeGap: 0,
    isFullSupported: () => true,
  }));
});

jest.mock('../../commons/service/ChatGPTProvider', () =>
  jest.fn().mockImplementation(() => ({ timeGap: 0 })),
);
jest.mock('../../commons/service/GeminiProvider', () =>
  jest.fn().mockImplementation(() => ({ timeGap: 0 })),
);
jest.mock('../../commons/service/KimiProvider', () =>
  jest.fn().mockImplementation(() => ({ timeGap: 0 })),
);
jest.mock('../../commons/service/ClaudeProvider', () =>
  jest.fn().mockImplementation(() => ({ timeGap: 0 })),
);
jest.mock('../../commons/service/BaiduProvider', () =>
  jest.fn().mockImplementation(() => ({ timeGap: 0 })),
);
jest.mock('../../commons/service/BaiduQianfanProvider', () =>
  jest.fn().mockImplementation(() => ({ timeGap: 0 })),
);
jest.mock('../../commons/service/OllamaProvider', () =>
  jest.fn().mockImplementation(() => ({ timeGap: 0 })),
);
jest.mock('../../commons/service/OllamaMainProvider.js', () =>
  jest.fn().mockImplementation(() => ({ timeGap: 0 })),
);
jest.mock('../../commons/service/DoubaoProvider', () =>
  jest.fn().mockImplementation(() => ({ timeGap: 0 })),
);
jest.mock('../../commons/service/QwenProvider', () =>
  jest.fn().mockImplementation(() => ({ timeGap: 0 })),
);

describe('AIProviderManager — DeepSeek wiring (Phase 13.3)', () => {
  let manager;

  beforeEach(() => {
    // Reset singleton so each test gets a clean instance
    AIProviderManager.instance = null;
    manager = new AIProviderManager();
  });

  describe('preSetup()', () => {
    it('picks apiKeyDeepSeek when provider is DeepSeek', () => {
      const result = manager.preSetup(
        AIProvider.DeepSeek,
        '', // chatgpt
        '', // gemini
        '', // kimi
        '', // claude
        '', // baidu
        '', // doubao
        '', // qwen
        'ds-test-key-123',
      );
      expect(result.provider).toBe(AIProvider.DeepSeek);
      expect(result.key).toBe('ds-test-key-123');
    });

    it('falls back to DeepSeek when no provider given but apiKeyDeepSeek is set', () => {
      const result = manager.preSetup(
        '', // no explicit provider
        '', // chatgpt key missing
        '', // gemini key missing
        '', // kimi key missing
        '', // claude key missing
        '', // baidu key missing
        '', // doubao key missing
        '', // qwen key missing
        'ds-fallback-key',
      );
      expect(result.provider).toBe(AIProvider.DeepSeek);
      expect(result.key).toBe('ds-fallback-key');
    });

    it('does NOT pick DeepSeek when another provider has a key and no explicit provider', () => {
      const result = manager.preSetup(
        '',
        'sk-openai-key',
        '',
        '',
        '',
        '',
        '',
        '',
        'ds-key-ignored',
      );
      expect(result.provider).toBe(AIProvider.ChatGPT);
      expect(result.key).toBe('sk-openai-key');
    });
  });

  describe('setup()', () => {
    it('instantiates DeepSeekProvider when provider is DeepSeek', () => {
      const DeepSeekProvider = require('../../commons/service/DeepSeekProvider');
      manager.setup(
        true,
        1,
        AIProvider.DeepSeek,
        'ds-key-abc',
        DeepSeekModel.DEEPSEEK_CHAT,
      );
      expect(DeepSeekProvider).toHaveBeenCalledWith(
        'ds-key-abc',
        DeepSeekModel.DEEPSEEK_CHAT,
      );
      expect(manager.currentProviderName).toBe(AIProvider.DeepSeek);
      expect(manager.currentProvider).not.toBeNull();
    });

    it('uses DEEPSEEK_REASONER model when specified', () => {
      const DeepSeekProvider = require('../../commons/service/DeepSeekProvider');
      DeepSeekProvider.mockClear();
      manager.setup(
        true,
        1,
        AIProvider.DeepSeek,
        'ds-key-xyz',
        DeepSeekModel.DEEPSEEK_REASONER,
      );
      expect(DeepSeekProvider).toHaveBeenCalledWith(
        'ds-key-xyz',
        DeepSeekModel.DEEPSEEK_REASONER,
      );
    });
  });
});
