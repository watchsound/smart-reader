// src/renderer/views/reading/forumAnchor.js
/**
 * Helpers for building a ForumAnchor in the renderer.
 *
 * `passageHash` uses FNV-1a (not crypto-grade) — anchor keys are local
 * lookups in a single-user app, not security tokens. Collisions on real user
 * text are negligible at this scale. Upgrade to SHA-256 (Web Crypto) if
 * collisions surface in practice.
 */

// eslint-disable-next-line no-bitwise
function fnv1aHex(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    // eslint-disable-next-line no-bitwise
    h ^= s.charCodeAt(i);
    // eslint-disable-next-line no-bitwise
    h = (h * 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function passageHash(text) {
  const normalized = (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return fnv1aHex(normalized);
}

function buildAnchor({
  bookId,
  chapterId,
  cfiRange,
  selectionText,
  passageText,
}) {
  return {
    bookId,
    chapterId: chapterId || null,
    cfiRange: cfiRange || null,
    selectionText: selectionText || null,
    pageTextHash: passageHash(selectionText || passageText || ''),
  };
}

module.exports = { buildAnchor, passageHash };
