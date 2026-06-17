// src/main/brain/spine/meteredCall.js
/**
 * meteredCall — passthrough spine entry for legacy / non-Brain LLM calls.
 *
 * Records cost telemetry to the Call Ledger. Does NOT inject BrainContext.
 * Intent tag is `legacy:<label>` so Economics Panel can group legacy traffic.
 */
const CallLedgerStore = require('../../db/CallLedgerStore');
const costEstimator = require('./costEstimator');

function summarize(out) {
  if (out == null) return null;
  const s = typeof out === 'string' ? out : JSON.stringify(out);
  return s.length > 500 ? s.slice(0, 500) : s;
}

async function meteredCall(provider, prompt, options = {}) {
  const label = options.legacyLabel || 'unknown';
  const t0 = Date.now();
  const output = await provider.generateContent(prompt);
  const duration_ms = Date.now() - t0;
  const prompt_tokens = costEstimator.estimateTokens(prompt);
  const completion_tokens = costEstimator.estimateTokens(output);
  const cost_usd = costEstimator.estimate(
    provider?.name || 'unknown',
    { prompt_tokens, completion_tokens },
  );
  const callId = CallLedgerStore.record({
    intent: `legacy:${label}`,
    ts: Date.now(),
    provider: provider?.name || 'unknown',
    context_keys: [],
    prompt_tokens,
    completion_tokens,
    cost_usd,
    cache_hit: false,
    cache_key: null,
    duration_ms,
    trigger_id: options.triggerId || null,
    output_summary: summarize(output),
    output_json: typeof output === 'object' ? output : null,
  });
  return { output, callId };
}

module.exports = meteredCall;
