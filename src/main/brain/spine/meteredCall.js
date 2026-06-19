// src/main/brain/spine/meteredCall.js
/**
 * meteredCall — passthrough spine entry for legacy / non-Brain LLM calls.
 *
 * Records cost telemetry to the Call Ledger. Does NOT inject BrainContext.
 * Intent tag is `legacy:<label>` so Economics Panel can group legacy traffic.
 *
 * Phase 15a: wrapped in providerFailover.executeWithFailover so transient
 * errors (429, 5xx, ECONNRESET, ETIMEDOUT) auto-retry the same provider.
 * Cross-provider chain stubbed — extends once AIProviderManager exposes
 * name-based instantiation. Each failed attempt produces its own ledger row.
 */
const CallLedgerStore = require('../../db/CallLedgerStore');
const costEstimator = require('./costEstimator');
const { executeWithFailover } = require('./providerFailover');
const {
  instanceInMain: aiProviderManager,
} = require('../../../commons/service/AIProviderManager');

function summarize(out) {
  if (out == null) return null;
  const s = typeof out === 'string' ? out : JSON.stringify(out);
  return s.length > 500 ? s.slice(0, 500) : s;
}

async function meteredCall(provider, prompt, options = {}) {
  if (!provider) {
    throw new Error('[meteredCall] no provider passed — caller must check aiProviderManager.currentProvider');
  }
  const label = options.legacyLabel || 'unknown';
  const intent = `legacy:${label}`;
  // provider.name is set by AIProviderManager.setup; fall back to
  // currentProviderName when callers pass an out-of-band instance, and
  // only land on 'unknown' as a last resort.
  const providerName =
    provider?.name || aiProviderManager.currentProviderName || 'unknown';
  const prompt_tokens = costEstimator.estimateTokens(prompt);

  const onAttemptFailed = ({ provider: p, error, attemptN, reason }) => {
    try {
      CallLedgerStore.record({
        intent,
        ts: Date.now(),
        provider: p,
        context_keys: [],
        prompt_tokens,
        completion_tokens: 0,
        cost_usd: 0,
        cache_hit: false,
        cache_key: null,
        duration_ms: null,
        trigger_id: options.triggerId || null,
        output_summary: null,
        output_json: null,
        attempt_n: attemptN,
        failover_reason: reason,
        error: String((error && error.message) || error).slice(0, 500),
      });
    } catch (_e) { /* never let ledger failure mask call error */ }
  };

  const t0 = Date.now();
  const { result: output, attempts } = await executeWithFailover({
    chain: [providerName],
    fn: async (_name) => provider.generateContent(prompt),
    onAttemptFailed,
  });
  const duration_ms = Date.now() - t0;
  const completion_tokens = costEstimator.estimateTokens(output);
  const cost_usd = costEstimator.estimate(
    providerName,
    { prompt_tokens, completion_tokens },
  );
  const callId = CallLedgerStore.record({
    intent,
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
    output_json: typeof output === 'object' ? output : null,
    attempt_n: attempts,
    failover_reason: null,
    error: null,
  });
  return { output, callId };
}

module.exports = meteredCall;
