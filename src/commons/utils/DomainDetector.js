/**
 * DomainDetector — classify a piece of source content into a domain
 * (see `LearningDomain` in src/commons/model/LearningPointDomains.ts).
 *
 * Two-tier design:
 *   1) Heuristic pass — synchronous regex/keyword classification. Resolves
 *      the vast majority of unambiguous cases (math has LaTeX, code has
 *      `function`/`def`, vocab is short with definition-words, etc.).
 *      Returns null when no signal is strong enough.
 *   2) AI fallback (opt-in) — single LLM call asking for a one-word domain
 *      label. Only worth invoking when heuristic returns null AND the content
 *      is long enough to justify the cost.
 *
 * Designed to live in /commons/ so both main and renderer can call it. The
 * AI fallback requires the caller to pass an AIProviderManager-like object
 * (the detector itself does not import the provider singleton — keeps the
 * module side-effect-free and testable).
 *
 * NOTE on writability: DOMAIN_LABELS below is the SUPERSET of domains the
 * detector knows how to recognize. Not all of these are accepted by the
 * LIVE LearningPointService for writes (see LIVE_WRITABLE_DOMAINS in
 * LearningPointDomains.ts). Callers persisting the detected domain to the
 * live path must coerce unsupported values (e.g. 'physics' → 'knowledge' or
 * 'math') before submission.
 */

/**
 * Superset of recognized domain labels. Matches LearningDomain in
 * LearningPointDomains.ts. Includes 'reading' for live-service compatibility.
 */
export const DOMAIN_LABELS = Object.freeze([
  'vocabulary',
  'math',
  'physics',
  'chemistry',
  'biology',
  'language',
  'programming',
  'knowledge',
  'skill',
  'history',
  'geography',
  'reading',
  'custom',
]);

const DEFAULT_DOMAIN = 'knowledge';

// -----------------------------------------------------------------------------
// Heuristic signal detectors. Each returns a score 0..1 for its domain.
// -----------------------------------------------------------------------------

const RE_LATEX =
  /\\(?:frac|sum|int|sqrt|alpha|beta|gamma|delta|theta|pi|infty|prod|lim|partial|cdot|times|leq|geq|neq|approx|equiv|forall|exists|in|notin|subset|cup|cap|mathbb|mathcal)\b|\$\$[^$]+\$\$|\$[^$\n]+\$/i;
const RE_CODE_FENCE = /```[\s\S]+?```/;
const RE_CODE_KEYWORD =
  /\b(?:function|def|class|import|return|console\.log|public\s+(?:static|class)|<\/?[a-z]+>|=>|sudo\s|npm\s+|pip\s+install|git\s+|SELECT\s+|FROM\s+|WHERE\s+)\b/;
const RE_CHEMISTRY =
  /\b(?:H2O|CO2|NaCl|HCl|H2SO4|NH3|CH4|O2|N2|H2)\b|\b(?:[A-Z][a-z]?\d*){2,}\b|\bp[Hh]\s*[=<>]/;
const RE_PHYSICS_UNITS =
  /\b\d+\s*(?:m\/s\^?2|m\/s|km\/h|kg|N\b|J\b|W\b|Hz|°C|Pa|V|A|Ω|ohm)\b/;
const RE_VOCAB_DEFN =
  /\b(?:means|refers to|definition|synonym|antonym|pronounced|noun|verb|adjective|adverb)\b/i;
const RE_LANGUAGE_BILINGUAL =
  /[\u4e00-\u9fff].*[a-zA-Z]|[a-zA-Z].*[\u4e00-\u9fff]/; // CJK + Latin in same text
const RE_HISTORY =
  /\b(?:century|BCE|AD|war|empire|revolution|treaty|dynasty|emperor|president)\b/i;
const RE_GEOGRAPHY =
  /\b(?:continent|country|river|mountain|capital|latitude|longitude|hemisphere|ocean)\b/i;
const RE_SKILL =
  /\b(?:step\s*\d+|first[,]?\s+then|how\s+to|procedure|technique|practice|exercise)\b/i;

function scoreMath(text) {
  if (RE_LATEX.test(text)) return 0.9;
  // Numeric expressions with operators — weak signal
  if (/\d+\s*[+\-*/=]\s*\d+/.test(text) && text.length < 200) return 0.4;
  return 0;
}

function scoreProgramming(text) {
  if (RE_CODE_FENCE.test(text)) return 0.95;
  if (RE_CODE_KEYWORD.test(text)) return 0.6;
  return 0;
}

function scoreChemistry(text) {
  return RE_CHEMISTRY.test(text) ? 0.7 : 0;
}

function scorePhysics(text) {
  return RE_PHYSICS_UNITS.test(text) ? 0.7 : 0;
}

function scoreVocabulary(text) {
  // Short text + definition vocabulary words = likely a dictionary entry.
  if (text.length < 300 && RE_VOCAB_DEFN.test(text)) return 0.6;
  return 0;
}

function scoreLanguagePattern(text) {
  // Mixed-script content with grammar-pattern markers.
  if (RE_LANGUAGE_BILINGUAL.test(text)) {
    if (/\b(?:grammar|pattern|conjugation|tense|particle)\b/i.test(text))
      return 0.7;
    return 0.3;
  }
  return 0;
}

function scoreHistory(text) {
  return RE_HISTORY.test(text) ? 0.5 : 0;
}

function scoreGeography(text) {
  return RE_GEOGRAPHY.test(text) ? 0.5 : 0;
}

function scoreSkill(text) {
  return RE_SKILL.test(text) ? 0.5 : 0;
}

function scoreReading(text) {
  if (!text) return 0;
  // Long-form prose with multiple sentence terminators — a reading passage
  // (multi-paragraph excerpt), distinct from a short fact/concept that
  // belongs in 'knowledge'. Score is set so any specialty domain (math,
  // code, chemistry, history, ...) wins over reading via insertion-order
  // tie-break, but reading still catches long prose that no specialty
  // signal claims. For SmartReader specifically this is the most common
  // expected output.
  if (text.length < 400) return 0;
  const sentenceTerminators = (text.match(/[.!?。！？]\s+/g) || []).length;
  if (sentenceTerminators < 3) return 0;
  return 0.5;
}

/**
 * Run heuristic classifiers. Returns null when no domain scores above the
 * confidence threshold (caller may then escalate to AI).
 */
export function detectDomainHeuristic(
  text,
  { confidenceThreshold = 0.5 } = {},
) {
  if (!text || typeof text !== 'string' || text.trim().length === 0)
    return null;

  // Insertion order matters: the reduce below uses strict `>`, so equal
  // scores resolve to the first-inserted domain. Specialty signals are
  // listed before 'reading' so they win ties — 'reading' is the prose
  // catch-all and should never displace a more-specific match.
  const scores = {
    math: scoreMath(text),
    programming: scoreProgramming(text),
    chemistry: scoreChemistry(text),
    physics: scorePhysics(text),
    vocabulary: scoreVocabulary(text),
    language: scoreLanguagePattern(text),
    history: scoreHistory(text),
    geography: scoreGeography(text),
    skill: scoreSkill(text),
    reading: scoreReading(text),
  };

  const { bestDomain, bestScore } = Object.entries(scores).reduce(
    (acc, [domain, score]) =>
      score > acc.bestScore ? { bestDomain: domain, bestScore: score } : acc,
    { bestDomain: null, bestScore: 0 },
  );
  if (bestScore >= confidenceThreshold) {
    return { domain: bestDomain, confidence: bestScore, source: 'heuristic' };
  }
  return null;
}

/**
 * AI-assisted classification — single short prompt asking for a one-word
 * domain label. Only call this when the heuristic returned null AND the
 * caller has decided the content warrants the API cost.
 *
 * @param {string} text
 * @param {Object} provider — AIProviderInterface instance (must have generateContent)
 * @returns {Promise<{ domain: string, confidence: number, source: 'ai' }|null>}
 */
export async function detectDomainWithAI(text, provider) {
  if (!text || !provider || typeof provider.generateContent !== 'function') {
    return null;
  }
  const labelList = DOMAIN_LABELS.join(', ');
  const prompt = `Classify the following text into exactly ONE of these domains: ${labelList}.
Reply with the single domain word only, no punctuation, no explanation.

TEXT:
"""
${text.slice(0, 2000)}
"""

DOMAIN:`;
  try {
    const raw = await provider.generateContent(prompt);
    const cleaned = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, '');
    if (DOMAIN_LABELS.includes(cleaned)) {
      return { domain: cleaned, confidence: 0.7, source: 'ai' };
    }
    return null;
  } catch (_err) {
    return null;
  }
}

/**
 * Top-level convenience: heuristic first, optional AI fallback, default
 * to 'knowledge' if nothing classifies.
 *
 * @param {string} text
 * @param {Object} [options]
 * @param {Object} [options.provider] — pass to enable AI fallback
 * @param {number} [options.confidenceThreshold=0.5]
 * @param {number} [options.minLengthForAI=200] — skip AI for very short text
 * @returns {Promise<{ domain: string, confidence: number, source: string }>}
 */
export async function detectDomain(text, options = {}) {
  const { provider, confidenceThreshold = 0.5, minLengthForAI = 200 } = options;
  const heuristic = detectDomainHeuristic(text, { confidenceThreshold });
  if (heuristic) return heuristic;

  if (provider && text && text.length >= minLengthForAI) {
    const ai = await detectDomainWithAI(text, provider);
    if (ai) return ai;
  }
  return { domain: DEFAULT_DOMAIN, confidence: 0.0, source: 'default' };
}
