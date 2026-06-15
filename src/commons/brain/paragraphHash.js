/* eslint-disable no-bitwise */
/* eslint-disable no-plusplus */
/**
 * paragraphHash — deterministic FNV-style hash of a paragraph's trimmed
 * text. Used by:
 *   - MicroCardProposer (main): dedup gate per chapter
 *   - EPubView (renderer):     paragraph → DOM-element lookup so the
 *                              MicroCardChip can anchor near the source
 *                              paragraph instead of floating bottom-right
 *
 * Both sides MUST hash byte-identical strings, so this module is
 * deliberately in `commons/` rather than living in either process.
 */

function hashParagraph(text) {
  const s = (text || '').trim();
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

module.exports = { hashParagraph };
