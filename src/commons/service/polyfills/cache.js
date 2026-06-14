/* eslint-disable import/prefer-default-export */
/**
 * Prompt-cache polyfill (Phase 1).
 *
 * Wraps a provider call with a local hash-keyed cache so that repeated
 * (prefix, suffix) pairs reuse the prior response. This does NOT reduce
 * latency for first-time requests on providers that lack native caching —
 * it only saves cost on repeated identical contexts (e.g., asking 5 tutor
 * questions about the same chapter where the prefix is the cached learner
 * context).
 *
 * For providers that DO support native caching (Claude, GPT, Gemini, Kimi,
 * DeepSeek per their capabilities()), the polyfill defers to a
 * native-cache method when one is exposed — currently TODO since providers
 * don't expose `generateContentCached(prefix, suffix)` yet.
 *
 * Cache key = sha-like hash of (prefix + provider model). The suffix is
 * NOT part of the key — it's the variable user message that should produce
 * a different response per turn. So in tutor mode, cache hits only happen
 * when the SAME exact user message is sent twice in the same session,
 * which is rare. The real value comes when providers add native caching
 * for the prefix portion specifically.
 *
 * TODO: when providers expose `generateContentCached(prefix, suffix)`,
 * route there for native caching benefits (10× cost reduction, 3-5× latency
 * reduction on Anthropic).
 */

const cache = new Map();

// Soft cap on entries — older entries evicted on insert overflow.
const MAX_ENTRIES = 200;
// Default TTL — 15 minutes is enough for one study session.
const DEFAULT_TTL_MS = 15 * 60 * 1000;

/**
 * Deterministic 53-bit string hash (cyrb53-style). Sufficient for cache
 * key collision avoidance over the small key space this cache sees.
 */
function hashString(s) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function keyFor(provider, prefix, suffix) {
  const modelTag = (provider && provider.model) || 'no-model';
  // Include suffix in key so different user turns get different cache slots.
  // The cost benefit of "prefix-only" caching is unlocked when providers
  // expose native API-side caching — see TODO above.
  return `${modelTag}::${hashString(prefix)}::${hashString(suffix)}`;
}

function evictIfFull() {
  if (cache.size < MAX_ENTRIES) return;
  // Map preserves insertion order — drop the oldest entry.
  const oldestKey = cache.keys().next().value;
  if (oldestKey !== undefined) cache.delete(oldestKey);
}

/**
 * Call provider.generateContent with caching of the (prefix, suffix) pair.
 *
 * @param {AIProviderInterface} provider
 * @param {string} prefix — stable across many calls (e.g., system prompt + tutor context)
 * @param {string} suffix — variable per call (e.g., the user's message)
 * @param {Object} [options]
 * @param {number} [options.ttlMs=DEFAULT_TTL_MS]
 * @param {boolean} [options.bypassCache=false]
 * @returns {Promise<string>}
 */
export async function cachedCall(provider, prefix, suffix, options = {}) {
  if (!provider || typeof provider.generateContent !== 'function') {
    throw new Error('[polyfill:cachedCall] provider missing generateContent');
  }
  const { ttlMs = DEFAULT_TTL_MS, bypassCache = false } = options;

  // TODO native branch: if provider.supports('promptCaching') and exposes
  // a `generateContentCached(prefix, suffix)` method, defer to it for
  // native API-side caching benefits.
  // if (provider.supports?.('promptCaching') &&
  //     typeof provider.generateContentCached === 'function') {
  //   return provider.generateContentCached(prefix, suffix);
  // }

  const key = keyFor(provider, prefix, suffix);
  if (!bypassCache) {
    const entry = cache.get(key);
    if (entry && Date.now() - entry.storedAt < ttlMs) {
      // Refresh recency by re-inserting (Map preserves insertion order).
      cache.delete(key);
      cache.set(key, entry);
      return entry.response;
    }
  }
  const response = await provider.generateContent(prefix + suffix);
  evictIfFull();
  cache.set(key, { response, storedAt: Date.now() });
  return response;
}

/** Clear all cached entries. Useful when the prefix is known to have changed. */
export function clearCache() {
  cache.clear();
}

/** Inspect cache size — for telemetry / debugging. */
export function cacheStats() {
  return { size: cache.size, max: MAX_ENTRIES };
}
