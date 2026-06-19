// src/main/brain/spine/costEstimator.js
/**
 * Cost estimator for Brain Spine LLM calls.
 *
 * Pricing in USD per 1M tokens (2026 baseline). Open-source-first:
 * DeepSeek / Qwen / Kimi defaults; frontier providers are opt-in upgrades.
 *
 * Refresh quarterly. Raw token counts are stored on the ledger so historical
 * costs can be recomputed when this table is updated.
 *
 * Phase 13.2: per-provider pricing overrides are read from electron-store
 * (`aiPricing.overrides`). Override takes precedence over PRICING; invalid
 * overrides (negative, NaN, missing fields) silently fall back to PRICING.
 */

const PRICING = {
  'deepseek-v3':       { input: 0.27, output: 1.10 },
  'deepseek-chat':     { input: 0.14, output: 0.28 },
  'qwen-max':          { input: 1.60, output: 6.40 },
  'qwen-plus':         { input: 0.40, output: 1.20 },
  'kimi':              { input: 0.30, output: 1.50 },
  'baidu-qianfan':     { input: 0.50, output: 1.50 },
  'doubao':            { input: 0.30, output: 0.80 },
  'ollama-local':      { input: 0,    output: 0    },
  // Frontier (opt-in upgrades):
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'claude-opus-4-7':   { input: 15.00, output: 75.00 },
  'gpt-4o':            { input: 2.50, output: 10.00 },
  'gemini-pro':        { input: 1.25, output: 5.00 },
  // Coarse AIProvider enum aliases — point each at a representative model.
  // When the spine knows the specific model (e.g. claude-opus-4-7), it should
  // pass the fine key; the coarse alias is the fallback when only the
  // AIProviderManager.currentProviderName (a coarse enum) is available.
  'chatgpt':           { input: 2.50, output: 10.00 },  // → gpt-4o tier
  'gemini':            { input: 1.25, output: 5.00 },   // → gemini-pro tier
  'claude':            { input: 3.00, output: 15.00 },  // → claude-sonnet-4-6 tier (cheaper, more common)
  'baidu':             { input: 0.50, output: 1.50 },   // → baidu-qianfan tier
  'qwen':              { input: 0.40, output: 1.20 },   // → qwen-plus tier (mid)
  'ollama':            { input: 0,    output: 0    },   // local — zero marginal cost
  'deepseek':          { input: 0.27, output: 1.10 },   // → deepseek-v3 tier
};

const DEFAULT_PROVIDER_NAME = 'deepseek-v3';

// Lazy-init electron-store so test environments that mock the module can
// inject their fake before the first estimate() call.
let _store;
function _getStore() {
  if (!_store) {
    const Store = require('electron-store');
    _store = new Store();
  }
  return _store;
}

/**
 * Read the stored override for `providerKey`.
 * Returns null if no override exists or the stored value is invalid.
 * @param {string} providerKey
 * @returns {{ input: number, output: number } | null}
 */
function getOverride(providerKey) {
  let all;
  try {
    all = _getStore().get('aiPricing.overrides') || {};
  } catch (_) {
    return null; // electron-store not available (e.g. unit-test env)
  }
  const row = all[providerKey];
  if (!row) return null;
  if (
    typeof row.input === 'number' && row.input >= 0 && Number.isFinite(row.input) &&
    typeof row.output === 'number' && row.output >= 0 && Number.isFinite(row.output)
  ) return row;
  return null;
}

function estimate(providerName, { prompt_tokens = 0, completion_tokens = 0 }) {
  const key = providerName?.toLowerCase?.() || DEFAULT_PROVIDER_NAME;
  const row = getOverride(key) || PRICING[key] || PRICING[DEFAULT_PROVIDER_NAME];
  return (prompt_tokens * row.input + completion_tokens * row.output) / 1e6;
}

function estimateTokens(text) {
  if (!text) return 0;
  const s = typeof text === 'string' ? text : JSON.stringify(text);
  // CJK characters (Hiragana, Katakana, CJK Ideographs, Hangul) tokenize as
  // ~1 token each in BPE — the /4 Latin heuristic under-counts them by ~4×.
  const cjkCount = (s.match(/[\u3040-\u9fff\uf900-\ufaff\uac00-\ud7af]/g) || []).length;
  const nonCjkLen = s.length - cjkCount;
  return Math.ceil(cjkCount + nonCjkLen / 4);
}

/**
 * Returns the effective rate for a provider, plus whether it comes from an
 * override or from the hardcoded PRICING table.
 * Convenience for the Settings UI.
 * @param {string} providerName
 * @returns {{ input: number, output: number, source: 'override' | 'default' }}
 */
function effectiveRate(providerName) {
  const key = providerName?.toLowerCase?.() || DEFAULT_PROVIDER_NAME;
  const override = getOverride(key);
  if (override) return { ...override, source: 'override' };
  const def = PRICING[key] || PRICING[DEFAULT_PROVIDER_NAME];
  return { ...def, source: 'default' };
}

module.exports = { estimate, estimateTokens, effectiveRate, PRICING };
