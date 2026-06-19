// src/__tests__/spine/costEstimator.test.js
const costEstimator = require('../../main/brain/spine/costEstimator');

describe('costEstimator', () => {
  test('estimates DeepSeek-V3 cost from token counts', () => {
    // DeepSeek-V3 baseline: $0.27/MTok input, $1.10/MTok output (2026 pricing)
    const cost = costEstimator.estimate('deepseek-v3', { prompt_tokens: 1000, completion_tokens: 500 });
    expect(cost).toBeCloseTo(0.27e-3 + 0.55e-3, 6); // 1k * 0.27/MTok + 500 * 1.10/MTok
  });

  test('falls back to a default provider when unknown', () => {
    const cost = costEstimator.estimate('unknown-provider', { prompt_tokens: 1000, completion_tokens: 1000 });
    expect(cost).toBeGreaterThan(0);
  });

  test('estimateTokens approximates string length', () => {
    const t = costEstimator.estimateTokens('a'.repeat(400));
    expect(t).toBeGreaterThan(80);  // ~4 chars per token
    expect(t).toBeLessThan(150);
  });

  test('coarse provider name "claude" resolves to a non-default price', () => {
    const claude = costEstimator.estimate('claude', { prompt_tokens: 1000, completion_tokens: 1000 });
    const deepseek = costEstimator.estimate('deepseek-v3', { prompt_tokens: 1000, completion_tokens: 1000 });
    // Claude must be priced higher than DeepSeek (the default fallback)
    expect(claude).toBeGreaterThan(deepseek);
  });

  test('coarse provider name is case-insensitive (chatGPT → chatgpt)', () => {
    const chatGPTcost = costEstimator.estimate('chatGPT', { prompt_tokens: 1000, completion_tokens: 1000 });
    const expectedGpt4o = (1000 * 2.50 + 1000 * 10.00) / 1e6;
    expect(chatGPTcost).toBeCloseTo(expectedGpt4o, 6);
  });

  describe('estimateTokens — CJK text', () => {
    test('pure Chinese text counts ~1 token per character (not 1 per 4)', () => {
      // 4 Chinese chars → should be ~4 tokens, NOT ceil(4/4) = 1
      const t = costEstimator.estimateTokens('你好世界');
      expect(t).toBe(4);
    });

    test('pure Japanese hiragana counts ~1 token per character', () => {
      // "konnichi wa" in hiragana: 5 chars → 5 tokens
      const t = costEstimator.estimateTokens('こんにちわ');
      expect(t).toBe(5);
    });

    test('pure Korean hangul counts ~1 token per character', () => {
      // "annyeonghaseyo": 5 chars → 5 tokens
      const t = costEstimator.estimateTokens('안녕하세요');
      expect(t).toBe(5);
    });

    test('mixed Chinese + English applies correct ratio to each part', () => {
      // "Hello" (5 Latin chars) + "你好" (2 CJK chars)
      // Expected: ceil(2 + 5/4) = ceil(2 + 1.25) = ceil(3.25) = 4
      const t = costEstimator.estimateTokens('Hello你好');
      expect(t).toBe(4);
    });

    test('pure Chinese is substantially more tokens than old /4 heuristic would give', () => {
      const chinese100 = '你'.repeat(100);
      const t = costEstimator.estimateTokens(chinese100);
      // New: 100 tokens. Old heuristic would have returned ceil(100/4) = 25.
      expect(t).toBeGreaterThanOrEqual(90); // ~1 per char
      expect(t).toBeLessThanOrEqual(110);
    });

    test('pure Latin text is unchanged by the CJK fix', () => {
      const t = costEstimator.estimateTokens('a'.repeat(400));
      expect(t).toBeGreaterThan(80);
      expect(t).toBeLessThan(150);
    });

    test('empty string returns 0', () => {
      expect(costEstimator.estimateTokens('')).toBe(0);
    });

    test('null/undefined returns 0', () => {
      expect(costEstimator.estimateTokens(null)).toBe(0);
      expect(costEstimator.estimateTokens(undefined)).toBe(0);
    });
  });
});
