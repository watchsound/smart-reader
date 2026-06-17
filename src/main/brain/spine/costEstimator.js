// src/main/brain/spine/costEstimator.js
/**
 * Cost estimator for Brain Spine LLM calls.
 *
 * Pricing in USD per 1M tokens (2026 baseline). Open-source-first:
 * DeepSeek / Qwen / Kimi defaults; frontier providers are opt-in upgrades.
 *
 * Refresh quarterly. Raw token counts are stored on the ledger so historical
 * costs can be recomputed when this table is updated.
 */

const PRICING = {
  'deepseek-v3':       { input: 0.27, output: 1.10 },
  'deepseek-chat':     { input: 0.14, output: 0.28 },
  'qwen-max':          { input: 1.60, output: 6.40 },
  'qwen-plus':         { input: 0.40, output: 1.20 },
  'kimi':              { input: 0.30, output: 1.50 },
  'baidu-qianfan':     { input: 0.50, output: 1.50 },
  'ollama-local':      { input: 0,    output: 0    },
  // Frontier (opt-in upgrades):
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'claude-opus-4-7':   { input: 15.00, output: 75.00 },
  'gpt-4o':            { input: 2.50, output: 10.00 },
  'gemini-pro':        { input: 1.25, output: 5.00 },
};

const DEFAULT_PROVIDER_NAME = 'deepseek-v3';

function estimate(providerName, { prompt_tokens = 0, completion_tokens = 0 }) {
  const key = providerName?.toLowerCase?.() || DEFAULT_PROVIDER_NAME;
  const row = PRICING[key] || PRICING[DEFAULT_PROVIDER_NAME];
  return (prompt_tokens * row.input + completion_tokens * row.output) / 1e6;
}

function estimateTokens(text) {
  if (!text) return 0;
  const s = typeof text === 'string' ? text : JSON.stringify(text);
  return Math.ceil(s.length / 4);
}

module.exports = { estimate, estimateTokens, PRICING };
