// src/main/brain/spine/BrainContext.js
/**
 * BrainContext — canonical serializable snapshot of learner state.
 *
 * Each slice is a function `(userId, overrides) => Promise<object>` that
 * returns a small JSON-serializable object. Slices are composed by
 * `buildSlice(['activeQuest', 'mastery'], userId)`.
 *
 * Slices must be:
 *  - small (< 300 tokens each typical)
 *  - deterministic given inputs (sort + cap)
 *  - safe to call from main process
 */

const SLICES = {};

function registerSlice(name, fn) {
  SLICES[name] = fn;
}

async function buildSlice(sliceNames, userId, overrides = {}) {
  const out = {};
  for (const name of sliceNames) {
    const fn = SLICES[name];
    if (!fn) {
      out[name] = { error: `unknown slice: ${name}` };
      continue;
    }
    try {
      out[name] = await fn(userId, overrides[name]);
    } catch (e) {
      out[name] = { error: e.message };
    }
  }
  return out;
}

module.exports = { buildSlice, registerSlice, _slices: SLICES };
