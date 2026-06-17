// src/main/brain/spine/brainCall.js
/**
 * brainCall — primary spine entry.
 *
 * Builds the BrainContext slice for the declared intent, dispatches via the
 * active provider (using structured-output polyfill when a schema is given),
 * records the call to the brain_call_ledger.
 *
 * @param {string} intent — registered intent name (see intents.js)
 * @param {string} input — task-specific prompt text
 * @param {Object} [options]
 * @param {number} [options.userId=1]
 * @param {string} [options.triggerId]
 * @param {Object} [options.contextOverrides] — { sliceName: overrideObj, ... }
 * @param {Object} [options.schema] — overrides profile.schema for this call
 * @returns {Promise<{ output, callId, cacheHit }>}
 */

const crypto = require('crypto');
const intents = require('./intents');
const BrainContext = require('./BrainContext');
const assemble = require('./promptAssembler');
const CallLedgerStore = require('../../db/CallLedgerStore');
const costEstimator = require('./costEstimator');
const {
  instanceInMain: aiProviderManager,
} = require('../../../commons/service/AIProviderManager');
const {
  getStructured,
} = require('../../../commons/service/polyfills/structuredOutput');

function hashContent(s) {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 32);
}

function summarize(out) {
  if (out == null) return null;
  const s = typeof out === 'string' ? out : JSON.stringify(out);
  return s.length > 500 ? s.slice(0, 500) : s;
}

function providerName() {
  const p = aiProviderManager?.currentProvider;
  if (p && typeof p.name === 'string') return p.name;
  if (aiProviderManager?.currentProviderName) return aiProviderManager.currentProviderName;
  return 'unknown';
}

async function brainCall(intent, input, options = {}) {
  const userId = options.userId || 1;
  const profile = intents.resolve(intent);
  const context = await BrainContext.buildSlice(
    profile.contextSlices, userId, options.contextOverrides || {},
  );
  const prompt = assemble({
    userInput: input,
    context,
    profileLabel: profile.label,
  });

  // Soft ceiling — log only; never block the call
  const promptTokens = costEstimator.estimateTokens(prompt);
  if (promptTokens > profile.costCeilingTokens) {
    console.warn(
      `[brainCall] ${intent}: prompt ${promptTokens} tok exceeds ceiling ${profile.costCeilingTokens}`,
    );
  }

  // Cache lookup.
  // Only 'content-hash' policy is implemented in Phase 9a. The 'session' and
  // 'none' policies both fall through to uncached behavior (every call is fresh).
  // Session-scoped caching is reserved for Phase 10 Director Mode when call
  // sequences within an LLM-driven session need shared output cache.
  let cacheKey = null;
  if (profile.cachePolicy === 'content-hash') {
    cacheKey = hashContent(prompt);
    const hit = CallLedgerStore.findCacheHit(intent, cacheKey);
    if (hit) {
      const callId = CallLedgerStore.recordCacheHit({
        intent, cacheKey, triggerId: options.triggerId || null,
      });
      return { output: hit.output_json, callId, cacheHit: true };
    }
  }

  // Live dispatch — schema from options overrides profile.schema
  const provider = aiProviderManager.currentProvider;
  if (!provider) {
    throw new Error('[brainCall] no AI provider configured — set one in Settings');
  }
  const dispatchSchema = options.schema || profile.schema;
  const t0 = Date.now();
  const output = dispatchSchema
    ? await getStructured(provider, prompt, dispatchSchema)
    : await provider.generateContent(prompt);
  const duration_ms = Date.now() - t0;
  const completion_tokens = costEstimator.estimateTokens(output);
  const cost_usd = costEstimator.estimate(providerName(), {
    prompt_tokens: promptTokens, completion_tokens,
  });

  const callId = CallLedgerStore.record({
    intent,
    ts: Date.now(),
    provider: providerName(),
    context_keys: Object.keys(context),
    prompt_tokens: promptTokens,
    completion_tokens,
    cost_usd,
    cache_hit: false,
    cache_key: cacheKey,
    duration_ms,
    trigger_id: options.triggerId || null,
    output_summary: summarize(output),
    output_json: output,
  });
  return { output, callId, cacheHit: false };
}

module.exports = brainCall;
