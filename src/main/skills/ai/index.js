/**
 * AI Skills - Powered by LLM providers
 *
 * These skills use the AI provider to generate responses.
 * They respect user settings like reader level and study mode.
 *
 * Existing Skills:
 * - SummarizeSkill: Generate concise summaries
 * - GrammarCheckSkill: Check grammar with optional comparison and exercises
 * - VocabularySkill: Define words with examples
 * - ConceptExtractSkill: Extract concepts for knowledge graph
 * - ExplainSkill: Explain topics with analogies
 *
 * New Skills:
 * - QuizGenerateSkill: Generate quiz questions from text
 * - TranslateSkill: Multi-step translation learning
 * - MindmapSkill: Generate mindmap structure
 * - TextSimplifySkill: Simplify text for reading levels
 * - SmartSummarySkill: Vocabulary-constrained summaries
 * - AnnotateSkill: Annotate grammatical elements
 * - AnalyzeStructureSkill: 5W analysis (Who, What, When, Where, Why)
 * - AnswerVerifySkill: LLM-based STEM answer verification
 */

const SummarizeSkill = require('./SummarizeSkill');
const GrammarCheckSkill = require('./GrammarCheckSkill');
const VocabularySkill = require('./VocabularySkill');
const ConceptExtractSkill = require('./ConceptExtractSkill');
const ExplainSkill = require('./ExplainSkill');

// New AI Skills
const QuizGenerateSkill = require('./QuizGenerateSkill');
const TranslateSkill = require('./TranslateSkill');
const MindmapSkill = require('./MindmapSkill');
const TextSimplifySkill = require('./TextSimplifySkill');
const SmartSummarySkill = require('./SmartSummarySkill');
const AnnotateSkill = require('./AnnotateSkill');
const AnalyzeStructureSkill = require('./AnalyzeStructureSkill');
const AnswerVerifySkill = require('./AnswerVerifySkill');

module.exports = {
  // Existing skills
  SummarizeSkill,
  GrammarCheckSkill,
  VocabularySkill,
  ConceptExtractSkill,
  ExplainSkill,

  // New skills
  QuizGenerateSkill,
  TranslateSkill,
  MindmapSkill,
  TextSimplifySkill,
  SmartSummarySkill,
  AnnotateSkill,
  AnalyzeStructureSkill,
  AnswerVerifySkill,
};
