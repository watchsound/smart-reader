// src/commons/model/forumTypes.js
/**
 * @typedef {Object} ForumAnchor
 * @property {number} bookId
 * @property {string|null} chapterId
 * @property {string|null} cfiRange      - null for whole-page discussion
 * @property {string|null} selectionText - null for whole-page discussion
 * @property {string} pageTextHash       - hash of normalized passage; primary key when cfiRange null
 */

/**
 * @typedef {Object} ForumTurn
 * @property {'moderator'|'skeptic'|'synthesizer'|'novice'|'user'} persona
 * @property {string} content
 * @property {number} ts
 * @property {('moderator'|'skeptic'|'synthesizer'|'novice')|null} [addressedTo]
 * @property {number} [cost_usd]   - only on user turns: cost of the reply call this user turn triggered
 */

/**
 * @typedef {Object} ForumDiscussion
 * @property {number} id
 * @property {number} bookId
 * @property {string|null} chapterId
 * @property {string|null} cfiRange
 * @property {string} pageTextHash
 * @property {string|null} selectionText
 * @property {ForumTurn[]} turns
 * @property {number} seedCostUsd
 * @property {number} createdAt
 * @property {number} lastReplyAt
 */

const PERSONA_IDS = ['moderator', 'skeptic', 'synthesizer', 'novice'];
const ALL_TURN_PERSONAS = [...PERSONA_IDS, 'user'];

function isPersonaId(s) {
  return PERSONA_IDS.includes(s);
}

function isTurnPersona(s) {
  return ALL_TURN_PERSONAS.includes(s);
}

module.exports = { PERSONA_IDS, ALL_TURN_PERSONAS, isPersonaId, isTurnPersona };
