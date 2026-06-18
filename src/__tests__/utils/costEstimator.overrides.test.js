/**
 * costEstimator — Phase 13.2 pricing-override tests.
 *
 * electron-store is mocked with a simple in-memory object so the test
 * doesn't touch the filesystem.  The mock must be hoisted before the
 * module under test is required (jest.mock is hoisted automatically).
 */

const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

// In-memory backing object shared between Store instances in the same test.
let _storeData = {};

jest.mock('electron-store', () => {
  return class MockStore {
    get(key, fallback) {
      // Support dot-notation keys: 'aiPricing.overrides'
      const parts = key.split('.');
      let cur = _storeData;
      for (const p of parts) {
        if (cur == null || typeof cur !== 'object') return fallback;
        cur = cur[p];
      }
      return cur === undefined ? fallback : cur;
    }
    set(key, value) {
      const parts = key.split('.');
      let cur = _storeData;
      for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') {
          cur[parts[i]] = {};
        }
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
    }
  };
});

// Reset store data AND module registry before each test so the lazy _store
// singleton in costEstimator picks up fresh mock state.
beforeEach(() => {
  _storeData = {};
  jest.resetModules();
});

afterEach(() => {
  jest.resetModules();
});

function loadEstimator() {
  return require('../../main/brain/spine/costEstimator');
}

describe('costEstimator — pricing overrides (Phase 13.2)', () => {
  it('uses hardcoded PRICING when no override is set', () => {
    const { estimate, PRICING } = loadEstimator();
    const tokens = { prompt_tokens: 1_000_000, completion_tokens: 0 };
    const expected = PRICING['deepseek'].input; // 0.27
    expect(estimate('deepseek', tokens)).toBeCloseTo(expected, 10);
  });

  it('uses the override when one is set', () => {
    // Set override before loading module so the lazy Store reads it.
    _storeData = { aiPricing: { overrides: { deepseek: { input: 9.99, output: 19.99 } } } };
    const { estimate } = loadEstimator();
    const result = estimate('deepseek', { prompt_tokens: 1_000_000, completion_tokens: 0 });
    expect(result).toBeCloseTo(9.99, 10);
  });

  it('uses override for output tokens', () => {
    _storeData = { aiPricing: { overrides: { claude: { input: 1.00, output: 5.00 } } } };
    const { estimate } = loadEstimator();
    const result = estimate('claude', { prompt_tokens: 0, completion_tokens: 1_000_000 });
    expect(result).toBeCloseTo(5.00, 10);
  });

  it('falls back to PRICING when override has negative input', () => {
    _storeData = { aiPricing: { overrides: { chatgpt: { input: -1, output: 10 } } } };
    const { estimate, PRICING } = loadEstimator();
    const result = estimate('chatgpt', { prompt_tokens: 1_000_000, completion_tokens: 0 });
    expect(result).toBeCloseTo(PRICING['chatgpt'].input, 10);
  });

  it('falls back to PRICING when override has NaN input', () => {
    _storeData = { aiPricing: { overrides: { gemini: { input: NaN, output: 5 } } } };
    const { estimate, PRICING } = loadEstimator();
    const result = estimate('gemini', { prompt_tokens: 1_000_000, completion_tokens: 0 });
    expect(result).toBeCloseTo(PRICING['gemini'].input, 10);
  });

  it('falls back to PRICING when override has non-numeric values', () => {
    _storeData = { aiPricing: { overrides: { kimi: { input: 'free', output: 'free' } } } };
    const { estimate, PRICING } = loadEstimator();
    const result = estimate('kimi', { prompt_tokens: 1_000_000, completion_tokens: 0 });
    expect(result).toBeCloseTo(PRICING['kimi'].input, 10);
  });

  it('falls back to default provider when unknown key is used', () => {
    const { estimate, PRICING } = loadEstimator();
    // 'unknown-provider' is not in PRICING; should fall back to deepseek-v3
    const result = estimate('unknown-provider', {
      prompt_tokens: 1_000_000,
      completion_tokens: 0,
    });
    expect(result).toBeCloseTo(PRICING['deepseek-v3'].input, 10);
  });

  it('effectiveRate returns source=override when override is set', () => {
    _storeData = { aiPricing: { overrides: { qwen: { input: 0.10, output: 0.50 } } } };
    const { effectiveRate } = loadEstimator();
    const r = effectiveRate('qwen');
    expect(r.input).toBe(0.10);
    expect(r.output).toBe(0.50);
    expect(r.source).toBe('override');
  });

  it('effectiveRate returns source=default when no override is set', () => {
    const { effectiveRate, PRICING } = loadEstimator();
    const r = effectiveRate('ollama');
    expect(r.input).toBe(PRICING['ollama'].input);
    expect(r.source).toBe('default');
  });
});
