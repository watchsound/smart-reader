/* eslint-disable prettier/prettier */
/**
 * Effect registries for the Impress presentation feature.
 * See docs/superpowers/specs/2026-06-14-impress-rich-effects-design.md
 */

/**
 * @typedef {Object} EffectDescriptor
 * @property {string} name
 * @property {('layout'|'typography'|'background'|'transition')} track
 * @property {boolean} requiresWebGL
 * @property {string[]} mood
 * @property {string[]} roles
 * @property {(ctx: EffectContext) => (() => void)} [apply]
 * @property {(slideIndex: number, total: number) => string} [generate]
 */

/**
 * @typedef {Object} EffectContext
 * @property {HTMLElement} slideEl
 * @property {Document} doc
 * @property {Object} slideData
 * @property {Object} deck
 * @property {Object|null} scene
 */

/** @type {Map<string, EffectDescriptor>} */
const layouts = new Map();
/** @type {Map<string, EffectDescriptor>} */
const typography = new Map();
/** @type {Map<string, EffectDescriptor>} */
const backgrounds = new Map();
/** @type {Map<string, EffectDescriptor>} */
const transitions = new Map();

const registries = { layout: layouts, typography, background: backgrounds, transition: transitions };

/**
 * Register an effect descriptor under its track.
 * @param {EffectDescriptor} descriptor
 */
function register(descriptor) {
  if (!descriptor || !descriptor.name || !descriptor.track) {
    throw new Error('register(): descriptor must have name and track');
  }
  const reg = registries[descriptor.track];
  if (!reg) throw new Error(`register(): unknown track "${descriptor.track}"`);
  reg.set(descriptor.name, descriptor);
}

/**
 * Look up an effect by track + name. Returns null if not found.
 * @param {string} track
 * @param {string} name
 * @returns {EffectDescriptor|null}
 */
function lookup(track, name) {
  const reg = registries[track];
  if (!reg) return null;
  return reg.get(name) || null;
}

/**
 * List all registered effect names for a track.
 * @param {string} track
 * @returns {string[]}
 */
function listNames(track) {
  const reg = registries[track];
  return reg ? Array.from(reg.keys()) : [];
}

module.exports = { register, lookup, listNames };
