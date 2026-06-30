/**
 * LearningPointDomains.ts — formal type contract for the `extras` JSON
 * column on the `learning_point` table.
 *
 * The schema has a `domain_type` enum and an `extras` TEXT(JSON) column.
 * What it lacked was a documented contract for what `extras` should contain
 * *per domain* — this file fills that gap. With these types, downstream
 * features (per-domain card components, domain-aware extractors,
 * domain-aware AI prompts) can be written against a stable shape instead
 * of hand-rolling JSON shapes.
 *
 * Backwards-compatible: `extras` may still be any shape on legacy rows.
 *
 * ============================================================================
 * IMPORTANT — DOMAIN_TYPES is fragmented across the codebase (pre-existing).
 * ============================================================================
 *
 * Five places define a DOMAIN_TYPES-like list with DIFFERENT sets:
 *
 *   src/main/utils/LearningPointService.js     LIVE  — Neo4j path used by IPC
 *     Values: vocabulary, knowledge, math, reading, language, skill          (6)
 *
 *   src/main/db/LearningPointManager.js        LEGACY — SQLite, used by tests only
 *     Values: vocabulary, math, physics, chemistry, biology, language,
 *             programming, knowledge, skill, history, geography, custom    (12)
 *
 *   src/renderer/api/brainApi.js               Learner profile DOMAIN_TYPES
 *     Values: vocabulary, math, language, knowledge, skill, programming,
 *             science, history                                              (8)
 *
 *   src/main/skills/learning/DomainDetectionSkill.js
 *     Values: vocabulary, math, language, knowledge, skill                  (5)
 *
 *   THIS FILE (LearningPointExtrasByDomain)                                (13)
 *     SUPERSET of the SQLite legacy enum + 'reading' from the live service.
 *
 * What this file represents:
 *   - The TYPE UNION is intentionally a superset so per-domain types and
 *     extras shapes are available for any domain that exists anywhere in
 *     the codebase. This file does NOT validate writes — it only declares
 *     shapes.
 *   - `LIVE_WRITABLE_DOMAINS` (exported below) is the subset that the LIVE
 *     LearningPointService.add() will accept today. Callers writing through
 *     the live IPC path MUST coerce to one of these values before write, or
 *     the call will fail validation.
 *   - Unifying the five enums into a single source is a Phase 3b+ task and
 *     out of scope for the typing layer.
 */

/**
 * Union of all domain identifiers used anywhere in the codebase. SUPERSET —
 * not all values are currently writable via the live service (see
 * LIVE_WRITABLE_DOMAINS below).
 */
export type LearningDomain =
  | 'vocabulary'
  | 'math'
  | 'physics'
  | 'chemistry'
  | 'biology'
  | 'language'
  | 'programming'
  | 'knowledge'
  | 'skill'
  | 'history'
  | 'geography'
  | 'reading'
  | 'custom';

/**
 * The subset of LearningDomain values that the LIVE LearningPointService
 * (src/main/utils/LearningPointService.js) accepts as `domainType` on
 * add()/update(). Callers writing learning points through the live IPC
 * path should validate / coerce against this set before submission.
 *
 * Keep in sync with `DOMAIN_TYPES` in LearningPointService.js.
 */
export const LIVE_WRITABLE_DOMAINS: ReadonlyArray<LearningDomain> = [
  'vocabulary',
  'knowledge',
  'math',
  'reading',
  'language',
  'skill',
];

// =============================================================================
// Per-domain extras shapes
// =============================================================================

/** Vocabulary: a word/phrase + its glosses, usage, audio. */
export interface VocabularyExtras {
  ipa?: string;
  partOfSpeech?: string;
  examples?: string[];
  collocations?: string[];
  audioUri?: string;
  /** Translations keyed by language code (e.g. { zh: '苹果' }). */
  translations?: Record<string, string>;
}

/** Common shape for math, physics, chemistry, biology — formal definitions. */
export interface FormalConceptExtras {
  /** Primary definition in LaTeX (or plain text if no math). */
  definitionLatex?: string;
  /** Worked example demonstrating the concept. */
  workedExampleLatex?: string;
  /** Concept IDs (foreign keys) the learner should know first. */
  prerequisites?: string[];
  /** Related practice problems (front-only stubs). */
  similarProblems?: Array<{ promptLatex: string; solutionLatex?: string }>;
  /** Frequent pitfalls — drives micro-card hint generation. */
  commonMistakes?: string[];
  /** Optional unit (e.g. 'm/s', 'mol/L') for physics/chemistry. */
  units?: string;
}

export interface ProgrammingExtras {
  language: string; // e.g. 'javascript', 'python'
  snippet: string;
  expectedOutput?: string;
  variations?: Array<{ snippet: string; note?: string }>;
  gotchas?: string[];
  runnable?: boolean;
  /** Library/runtime version, if behaviour depends on it. */
  versionContext?: string;
}

/** Language patterns (grammar / sentence structure), NOT vocab words. */
export interface LanguagePatternExtras {
  sourceLang: string; // BCP-47 (e.g. 'zh-Hans')
  targetLang: string; // BCP-47 (e.g. 'en-US')
  pattern: string; // The grammar/structure rule
  examples?: Array<{ source: string; target: string; note?: string }>;
  commonErrors?: string[];

  // Added 2026-06-30 for Translate Page Path A/B weakness capture.
  // Closed enum — see src/renderer/views/translate/buckets.js.
  bucket?:
    | 'tense'
    | 'word-order'
    | 'article-number'
    | 'preposition-collocation'
    | 'connector-cohesion'
    | 'idiom-register';
  /** The user's English fragment that triggered the weakness. */
  learnerAttempt?: string;
  /** The model's English fragment that the learner's attempt is being compared against. */
  modelTarget?: string;
  /** 1-2 sentence AI explanation of why the model phrasing is stronger. */
  reason?: string;
  /** Which Path A scaffold buttons the user revealed before composing. */
  hintsUsed?: { svo?: boolean; tense?: boolean; vocabulary?: boolean };
}

export interface KnowledgeExtras {
  sources?: Array<{ title: string; url?: string; cite?: string }>;
  relatedConcepts?: string[]; // concept IDs
  evidence?: string[];
  dates?: string[]; // ISO dates relevant to the fact
  locations?: string[]; // place names
}

export interface SkillExtras {
  steps?: string[];
  triggerConditions?: string[];
  practiceScenarios?: string[];
}

/** Discriminated-union helper for callers that want exhaustive handling. */
export type LearningPointExtrasByDomain = {
  vocabulary: VocabularyExtras;
  math: FormalConceptExtras;
  physics: FormalConceptExtras;
  chemistry: FormalConceptExtras;
  biology: FormalConceptExtras;
  programming: ProgrammingExtras;
  language: LanguagePatternExtras;
  knowledge: KnowledgeExtras;
  history: KnowledgeExtras;
  geography: KnowledgeExtras;
  /**
   * 'reading' is a live-service-only domain — represents general reading
   * comprehension excerpts that don't fit any other category. Shape mirrors
   * KnowledgeExtras for now.
   */
  reading: KnowledgeExtras;
  skill: SkillExtras;
  custom: Record<string, unknown>;
};

/** Generic accessor type: pick the extras shape for a given domain. */
export type ExtrasFor<D extends LearningDomain> =
  LearningPointExtrasByDomain[D];

/** Domains whose extras share the FormalConceptExtras shape. */
export const FORMAL_CONCEPT_DOMAINS: ReadonlyArray<LearningDomain> = [
  'math',
  'physics',
  'chemistry',
  'biology',
];

/** Domains whose extras share the KnowledgeExtras shape. */
export const KNOWLEDGE_LIKE_DOMAINS: ReadonlyArray<LearningDomain> = [
  'knowledge',
  'history',
  'geography',
  'reading',
];

/** Empty default for each domain — used by helpers when a row lacks extras. */
export function emptyExtrasFor<D extends LearningDomain>(
  domain: D,
): ExtrasFor<D> {
  switch (domain) {
    case 'vocabulary':
      return {} as ExtrasFor<D>;
    case 'math':
    case 'physics':
    case 'chemistry':
    case 'biology':
      return {} as ExtrasFor<D>;
    case 'programming':
      return { language: '', snippet: '' } as unknown as ExtrasFor<D>;
    case 'language':
      return {
        sourceLang: '',
        targetLang: '',
        pattern: '',
      } as unknown as ExtrasFor<D>;
    case 'knowledge':
    case 'history':
    case 'geography':
    case 'reading':
    case 'skill':
    case 'custom':
    default:
      return {} as ExtrasFor<D>;
  }
}
