/**
 * Data Skills - Interact with local data stores
 *
 * These skills operate on local data: notes, books, bookmarks,
 * knowledge graph (Neo4j), and vector search (ChromaDB).
 *
 * Existing Skills:
 * - SearchNotesSkill: Search notes by keyword or semantic similarity
 * - GraphQuerySkill: Query Neo4j knowledge graph
 * - CreateNoteSkill: Create notes with AI enhancement
 *
 * New Skills:
 * - CreateVocabularySkill: Save vocabulary cards (persistence only)
 * - CreateQuizSkill: Save generated quiz problems
 * - SearchVocabularySkill: Search vocabulary cards
 * - GetLeitnerDueSkill: Get items due for Leitner review
 */

const SearchNotesSkill = require('./SearchNotesSkill');
const GraphQuerySkill = require('./GraphQuerySkill');
const CreateNoteSkill = require('./CreateNoteSkill');

// New Data Skills
const CreateVocabularySkill = require('./CreateVocabularySkill');
const CreateQuizSkill = require('./CreateQuizSkill');
const SearchVocabularySkill = require('./SearchVocabularySkill');
const GetLeitnerDueSkill = require('./GetLeitnerDueSkill');

module.exports = {
  // Existing skills
  SearchNotesSkill,
  GraphQuerySkill,
  CreateNoteSkill,

  // New skills
  CreateVocabularySkill,
  CreateQuizSkill,
  SearchVocabularySkill,
  GetLeitnerDueSkill,
};
