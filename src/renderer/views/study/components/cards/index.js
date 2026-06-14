/**
 * Per-domain study card components (Phase 3c).
 *
 * The router is the public entry point; individual cards are exposed for
 * direct use (e.g. in previews or settings) but most callers should just
 * use `StudyCardRouter` and let it pick.
 */

export {
  default as StudyCardRouter,
  pickCardComponent,
} from './StudyCardRouter';
export { default as CardShell, DOMAIN_COLORS } from './CardShell';
export { default as GenericCard } from './GenericCard';
export { default as VocabCard } from './VocabCard';
export { default as MathCard } from './MathCard';
export { default as CodeCard } from './CodeCard';
export { default as KnowledgeCard } from './KnowledgeCard';
