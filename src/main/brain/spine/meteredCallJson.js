// src/main/brain/spine/meteredCallJson.js
const CallLedgerStore = require('../../db/CallLedgerStore');
const costEstimator = require('./costEstimator');
const {
  instanceInMain: aiProviderManager,
} = require('../../../commons/service/AIProviderManager');
const { executeWithFailover, classifyError } = require('./providerFailover');

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

  const intent = `legacy:${label}`;
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

  // Phase 15: JSON path uses the same failover wrapping. Schema/parse errors
  // are classified 'fatal' by classifyError (no failover) — that's the right
  // call, because the structured-output polyfill already handles same-prompt
  // retry, and a different provider won't help if the prompt is broken.
  const t0 = Date.now();
  const { result: output, attempts } = await executeWithFailover({
    chain: [providerName],
    // Same-provider retry only in v1 (see meteredCall.js for the extension
    // point that expands the chain across providers).
    fn: async (_name) => aiProviderManager.generateContentWithJson(prompt, true, schema),
    onAttemptFailed,
  });
  const duration_ms = Date.now() - t0;

  const completion_tokens = costEstimator.estimateTokens(output);
  const cost_usd = costEstimator.estimate(providerName, { prompt_tokens, completion_tokens });

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
    output_json: output && typeof output === 'object' ? output : null,
    attempt_n: attempts,
    failover_reason: null,
    error: null,
  });
  return { output, callId };
}

// classifyError isn't called here directly — exported via providerFailover —
// but referenced so eslint doesn't flag the import.
void classifyError;

module.exports = meteredCallJson;
