function normalize(s) {
  return (s || '').trim().toLowerCase();
}

function skeletonForWord(word) {
  if (!word) return '';
  return word[0] + '_'.repeat(Math.max(0, word.length - 1));
}

function buildHint(expected) {
  return expected
    .split(/(\s+)/)
    .map((part) => (/\s+/.test(part) ? part : skeletonForWord(part)))
    .join('');
}

export function commitMaskAttempt(attempt, expected) {
  const a = normalize(attempt);
  const e = normalize(expected);
  if (a === e) return { ok: true, hint: null };
  if (!a) return { ok: false, hint: null };
  return { ok: false, hint: buildHint(expected) };
}

export default { commitMaskAttempt };
