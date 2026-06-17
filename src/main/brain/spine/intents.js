// src/main/brain/spine/intents.js
/**
 * Intent Registry — maps a declared intent name to a profile used by `brainCall`.
 *
 * Profile shape:
 *   {
 *     label:              string,                              — human label for Rationale Card
 *     contextSlices:      string[],                            — slice names consumed from BrainContext
 *     costCeilingTokens:  number,                              — prompt-size soft ceiling
 *     cachePolicy:        'content-hash' | 'session' | 'none',
 *     schema?:            object                                — JSON schema for structured output
 *   }
 */

const INTENTS = {};

function register(name, profile) {
  if (!name || typeof name !== 'string') {
    throw new Error('intents.register: name required');
  }
  if (!profile || !Array.isArray(profile.contextSlices)) {
    throw new Error(`intents.register(${name}): profile.contextSlices required`);
  }
  if (!Number.isFinite(profile.costCeilingTokens)) {
    throw new Error(`intents.register(${name}): profile.costCeilingTokens required`);
  }
  if (!['content-hash', 'session', 'none'].includes(profile.cachePolicy)) {
    throw new Error(`intents.register(${name}): invalid cachePolicy`);
  }
  INTENTS[name] = Object.freeze({ ...profile });
}

function resolve(name) {
  const p = INTENTS[name];
  if (!p) throw new Error(`unknown intent: ${name}`);
  return p;
}

function list() {
  return Object.keys(INTENTS).sort();
}

// Seed registration runs on first require of this module.
// Done as a side-effect import to keep the registry a single source of truth.
let seedsLoaded = false;
function ensureSeeds() {
  if (!seedsLoaded) {
    seedsLoaded = true;
    require('./seedIntents'); // eslint-disable-line global-require
  }
}
function resolveWithSeeds(name) { ensureSeeds(); return resolve(name); }
function listWithSeeds() { ensureSeeds(); return list(); }

module.exports = { register, resolve: resolveWithSeeds, list: listWithSeeds };
