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
});
