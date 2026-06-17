// src/main/brain/spine/meteredCallJson.js
const CallLedgerStore = require('../../db/CallLedgerStore');
const costEstimator = require('./costEstimator');
const {
  instanceInMain: aiProviderManager,
} = require('../../../commons/service/AIProviderManager');

function summarize(out) {
  if (out == null) return null;
  const s = typeof out === 'string' ? out : JSON.stringify(out);
  return s.length > 500 ? s.slice(0, 500) : s;
}

async function meteredCallJson(prompt, schema, options = {}) {
  const label = options.legacyLabel || 'unknown';
  if (!aiProviderManager?.currentProvider) {
    throw new Error('[meteredCallJson] no AI provider configured');
  }
  const provider = aiProviderManager.currentProvider;
  const providerName = provider.name || aiProviderManager.currentProviderName || 'unknown';

  const t0 = Date.now();
  // The manager's existing JSON method handles schema injection per provider.
  // Some providers ignore the schema arg; that's fine — we still get JSON back.
  const output = await aiProviderManager.generateContentWithJson(prompt, true, schema);
  const duration_ms = Date.now() - t0;

  const prompt_tokens = costEstimator.estimateTokens(prompt);
  const completion_tokens = costEstimator.estimateTokens(output);
  const cost_usd = costEstimator.estimate(providerName, { prompt_tokens, completion_tokens });

  const callId = CallLedgerStore.record({
    intent: `legacy:${label}`,
    ts: Date.now(),
    provider: providerName,
    context_keys: [],
    prompt_tokens,
    completion_tokens,
    cost_usd,
    cache_hit: false,
    cache_key: null,
    duration_ms,
    trigger_id: options.triggerId || null,
    output_summary: summarize(output),
    output_json: output && typeof output === 'object' ? output : null,
  });
  return { output, callId };
}

module.exports = meteredCallJson;
