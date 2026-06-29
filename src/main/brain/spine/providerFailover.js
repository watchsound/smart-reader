/**
 * providerFailover — Phase 15 (Reset & Deepen).
 *
 * Ordered fallback chain so a single provider error doesn't kill a brainCall.
 * Wraps meteredCall + meteredCallJson at the Spine layer; provider classes
 * stay dumb (one HTTP call each, no retry logic). Each attempt produces its
 * own ledger row (`attempt_n`, `failover_reason`, `error`) so the Economics
 * panel sees real spend even on failed attempts.
 *
 * Spec: Phase 15a Reset & Deepen — provider failover item 1.
 *
 * Policy:
 *   - 1 same-provider retry with 500ms backoff for transient errors.
 *   - Then walk the chain: DeepSeek → Kimi → ChatGPT (default).
 *   - Errors classified to FAILOVER (try next) vs FATAL (stop):
 *     - FAILOVER: network errors, 5xx, 429, 503, ECONNRESET, ETIMEDOUT.
 *     - FATAL: 4xx auth (401, 403, 404), schema/parse errors (caller retries).
 */

// Chain entries must match `AIProvider` enum values so they survive the
// trip through AIProviderManager.currentProviderName + a future
// getProviderByName() lookup. The enum is the single source of truth — see
// src/commons/model/DataTypes.js.
const { AIProvider } = require('../../../commons/model/DataTypes');

const DEFAULT_CHAIN = [
  AIProvider.DeepSeek,
  AIProvider.Kimi,
  AIProvider.ChatGPT,
];
const SAME_PROVIDER_RETRY_DELAY_MS = 500;

// Per-attempt hard timeout. None of the provider classes set their own
// HTTP timeout, so a stalled connection (network outage, firewall, missing
// API key that triggers a hung handshake) would otherwise leave the IPC
// handler awaiting forever. 60s is generous for normal calls but bounds
// the failure case so the renderer eventually sees an error.
const DEFAULT_FN_TIMEOUT_MS = 60000;

function withTimeout(promise, ms) {
  let timeoutId;
  const timeoutPromise = new Promise((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      const err = new Error(`Provider call timed out after ${ms}ms`);
      err.code = 'ETIMEDOUT';
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

const FAILOVER_NETWORK_CODES = new Set([
  'ECONNRESET', 'ETIMEDOUT', 'ENETUNREACH', 'EAI_AGAIN',
  'ECONNABORTED', 'EPIPE', 'ENOTFOUND',
]);

/**
 * Classify an error as 'transient' (same-provider retry first),
 * 'failover' (skip retry, go to next provider), or 'fatal' (stop).
 *
 * Pure function — extracted for unit-test isolation. Inputs: anything
 * with `.message`, `.code`, `.status`, `.response?.status`.
 */
function classifyError(err) {
  if (!err) return 'fatal';
  const code = err.code || (err.cause && err.cause.code);
  if (code && FAILOVER_NETWORK_CODES.has(code)) return 'transient';
  const status = err.status ?? err.response?.status ?? err.statusCode;
  if (status === 429) return 'transient';
  if (status === 503) return 'transient';
  if (status >= 500 && status < 600) return 'failover';
  if (status === 401 || status === 403 || status === 404) return 'fatal';
  if (status >= 400 && status < 500) return 'fatal';
  // Network-ish messages (axios sometimes loses .code).
  const msg = String(err.message || '').toLowerCase();
  if (msg.includes('timeout') || msg.includes('econn') ||
      msg.includes('network') || msg.includes('socket hang up')) return 'transient';
  if (msg.includes('rate limit') || msg.includes('quota')) return 'transient';
  if (msg.includes('5xx') || msg.includes('server error')) return 'failover';
  return 'fatal';
}

function sleep(ms) {
  return new Promise((res) => { setTimeout(res, ms); });
}

/**
 * Pure-fn picker for the next provider in the chain, skipping the current.
 * Returns null if no more providers to try.
 */
function nextProvider(current, chain) {
  const idx = chain.indexOf(current);
  if (idx < 0) return chain[0] || null;
  return chain[idx + 1] || null;
}

/**
 * Execute `fn(provider)` against each provider in the chain. Returns the
 * first successful result. Reports failures via `onAttemptFailed(provider,
 * err, attemptN, reason)` so callers can write per-attempt ledger rows.
 *
 * @param {object} args
 * @param {Array<string>} args.chain - ordered provider names
 * @param {Function} args.fn - async (provider) => result
 * @param {Function} [args.onAttemptFailed] - called per failed attempt
 * @returns {Promise<{ result, provider, attempts }>}
 */
async function executeWithFailover({
  chain = DEFAULT_CHAIN,
  fn,
  onAttemptFailed,
  timeoutMs = DEFAULT_FN_TIMEOUT_MS,
}) {
  if (!Array.isArray(chain) || chain.length === 0) {
    throw new Error('providerFailover: empty chain');
  }
  let lastErr = null;
  let attemptN = 0;
  const tried = [];

  for (let i = 0; i < chain.length; i += 1) {
    const provider = chain[i];
    tried.push(provider);

    // First attempt on this provider.
    attemptN += 1;
    try {
      const result = await withTimeout(fn(provider), timeoutMs);
      return { result, provider, attempts: attemptN, tried };
    } catch (err) {
      lastErr = err;
      const cls = classifyError(err);
      if (onAttemptFailed) {
        try { onAttemptFailed({ provider, error: err, attemptN, reason: cls }); }
        catch (_e) { /* never let observer throw */ }
      }
      if (cls === 'fatal') break;
      if (cls === 'transient') {
        // One same-provider retry with backoff before walking the chain.
        await sleep(SAME_PROVIDER_RETRY_DELAY_MS);
        attemptN += 1;
        try {
          const result = await withTimeout(fn(provider), timeoutMs);
          return { result, provider, attempts: attemptN, tried };
        } catch (err2) {
          lastErr = err2;
          const cls2 = classifyError(err2);
          if (onAttemptFailed) {
            try { onAttemptFailed({ provider, error: err2, attemptN, reason: cls2 }); }
            catch (_e) { /* never let observer throw */ }
          }
          if (cls2 === 'fatal') break;
          // Else fall through to next provider in chain.
        }
      }
      // cls === 'failover' (or transient retry also failed) → next provider.
    }
  }

  const failed = new Error(
    `providerFailover: exhausted chain [${tried.join(', ')}]: ${lastErr && lastErr.message}`,
  );
  failed.cause = lastErr;
  failed.tried = tried;
  failed.attempts = attemptN;
  throw failed;
}

/**
 * Build a failover chain rooted at `primaryName`. Iterates `defaultChain`
 * and appends each entry that the caller's `isAvailable(name)` predicate
 * accepts (typically `aiProviderManager.hasRegisteredProvider`). When no
 * fallback is registered the result is `[primaryName]`, which is the
 * pre-Phase-15a behavior (same-provider retry only).
 */
function buildChain(primaryName, defaultChain, isAvailable) {
  const chain = [primaryName];
  if (!Array.isArray(defaultChain)) return chain;
  for (const fallback of defaultChain) {
    if (fallback === primaryName) continue;
    if (isAvailable(fallback)) chain.push(fallback);
  }
  return chain;
}

module.exports = {
  executeWithFailover,
  classifyError,
  nextProvider,
  buildChain,
  DEFAULT_CHAIN,
  SAME_PROVIDER_RETRY_DELAY_MS,
  DEFAULT_FN_TIMEOUT_MS,
};
