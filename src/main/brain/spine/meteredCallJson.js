// src/main/brain/spine/meteredCallJson.js
const CallLedgerStore = require('../../db/CallLedgerStore');
const costEstimator = require('./costEstimator');
const {
  instanceInMain: aiProviderManager,
} = require('../../../commons/service/AIProviderManager');
const {
  executeWithFailover,
  classifyError,
  buildChain,
  DEFAULT_CHAIN,
} = require('./providerFailover');

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

  // Phase 15: JSON path now matches meteredCall — cross-provider failover
  // via the AIProviderManager registry. Schema/parse errors remain
  // 'fatal' per classifyError because the structured-output polyfill
  // already handles same-prompt retry; switching providers can't rescue
  // a broken prompt.
  const chain = buildChain(providerName, DEFAULT_CHAIN, (n) =>
    aiProviderManager.hasRegisteredProvider(n),
  );

  const t0 = Date.now();
  const {
    result: output,
    attempts,
    provider: usedName,
  } = await executeWithFailover({
    chain,
    fn: async (name) => {
      const p =
        name === providerName
          ? provider
          : aiProviderManager.getProviderByName(name);
      if (!p) {
        throw new Error(`providerFailover: no provider registered for ${name}`);
      }
      // Pass the fallback as an override so generateContentWithJson
      // routes through it without touching aiProviderManager.currentProvider.
      return aiProviderManager.generateContentWithJson(prompt, true, schema, p);
    },
    onAttemptFailed,
  });
  const duration_ms = Date.now() - t0;

  const completion_tokens = costEstimator.estimateTokens(output);
  // Bill against the provider that actually succeeded — failing over from
  // cheap to expensive must show up truthfully in Economics.
  const cost_usd = costEstimator.estimate(usedName, { prompt_tokens, completion_tokens });

  const callId = CallLedgerStore.record({
    intent,
    ts: Date.now(),
    provider: usedName,
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
  return { output, callId, cost_usd };
}

// classifyError isn't called here directly — exported via providerFailover —
// but referenced so eslint doesn't flag the import.
void classifyError;

module.exports = meteredCallJson;
