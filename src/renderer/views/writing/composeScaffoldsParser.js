// Parser for the langstudyComposeScaffoldsPrompt LLM response.
// Validates shape so a malformed return doesn't crash the renderer.

export function parseComposeScaffolds(input) {
  let obj = input;
  if (typeof obj === 'string') {
    obj = JSON.parse(obj);
  }
  if (!obj || typeof obj !== 'object') {
    throw new Error(`parseComposeScaffolds: expected object, got ${typeof obj}`);
  }
  const gists = Array.isArray(obj.gists)
    ? obj.gists.filter((g) => typeof g === 'string' && g.trim().length > 0)
    : [];
  const phrases = Array.isArray(obj.phrases)
    ? obj.phrases.filter((p) => typeof p === 'string' && p.trim().length > 0)
    : [];
  const translation =
    typeof obj.translation === 'string' ? obj.translation : '';
  return { gists, phrases, translation };
}

export default { parseComposeScaffolds };
