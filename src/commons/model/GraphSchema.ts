/**
 * GraphSchema.ts
 *
 * Neo4j graph database schema for SmartReader progressive learning system.
 * This schema implements Graphiti-inspired bi-temporal patterns for tracking
 * learning progression over time.
 *
 * Key Design Principles:
 * 1. Bi-temporal model: Track both event time (when learning occurred) and
 *    record time (when we stored it) - inspired by Graphiti
 * 2. Note-centric: Notes are the center of learning, connecting to all entities
 * 3. Knowledge relationships: Rich semantic relationships between concepts
 * 4. Spaced repetition: Leitner system deeply integrated into graph structure
 */

// =============================================================================
// BASE TYPES - Common properties shared across nodes
// =============================================================================

/**
 * Bi-temporal timestamps (Graphiti-inspired)
 * Enables temporal queries like "what did I know at time X?"
 */
export interface BiTemporalProps {
  // When the learning event actually occurred
  eventTime: Date;
  // When this record was created in the system
  recordTime: Date;
  // When this version of the record became valid (for updates)
  validFrom: Date;
  // When this version stopped being valid (null = current)
  validTo: Date | null;
}

/**
 * Base properties for all graph nodes
 */
export interface BaseNodeProps {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
}

// =============================================================================
// NODE TYPES - Primary entities in the knowledge graph
// =============================================================================

/**
 * User node - represents a learner
 */
export interface UserNode extends BaseNodeProps {
  __label: 'User';
  email: string;
  name: string;
  readerLevel: 'elementary' | 'middle' | 'college';
  studyMode: 'general' | 'language' | 'math' | 'program';
  preferredProvider: string;
  preferredModel: string;
}

/**
 * Book node - represents an EPUB, PDF, or other document
 */
export interface BookNode extends BaseNodeProps {
  __label: 'Book';
  keyInStorage: string;
  name: string;
  subtitle: string | null;
  author: string | null;
  description: string | null;
  cover: string | null;
  format: 'epub' | 'pdf' | 'docx' | 'html';
  publisher: string | null;
  category: string | null;
  size: number;
  path: string;
  favorite: boolean;
  bookshelfId: number;
  // Embedding for semantic search (migrated from ChromaDB)
  embedding: number[] | null;
  embeddingModel: string | null;
}

/**
 * Chapter node - represents a chapter/section within a book
 */
export interface ChapterNode extends BaseNodeProps {
  __label: 'Chapter';
  title: string;
  index: number;
  cfi: string | null; // EPUB CFI location
  pageRange: { start: number; end: number } | null; // PDF page range
}

/**
 * Note node - THE CENTER OF LEARNING
 * Notes connect to everything: books, URLs, concepts, vocabulary, quizzes
 */
export interface NoteNode extends BaseNodeProps, BiTemporalProps {
  __label: 'Note';
  sourceType: 'book' | 'url' | 'chat' | 'note';
  sourceKey: string;
  title: string;
  chapter: string | null;
  chapterIndex: number | null;

  // Card content (up to 4 cards per note)
  cards: NoteCard[];

  // Location in source
  cfi: string | null; // EPUB location
  range: string | null;
  percentage: number | null;
  position: PDFPosition[] | null; // PDF position

  // Metadata
  emoji: string | null;
  color: string | null;
  tags: string[];
  rate: number; // 0-5 star rating
  hasQuiz: boolean;
  highlightOnly: boolean;
  highlightType: string | null;

  // Embedding for semantic search
  embedding: number[] | null;
  embeddingModel: string | null;
}

export interface NoteCard {
  id: number;
  text: string;
  html: string;
  image: string | null;
  overlap: 0 | 1 | 2 | 3; // 0: no-overlap, 1: central, 2: top, 3: bottom
  type: 'normal' | 'mindmap';
}

export interface PDFPosition {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
  pageNumber: number;
}

/**
 * Concept node - represents a knowledge concept/topic
 * Extracted from notes, books, and vocabulary
 */
export interface ConceptNode extends BaseNodeProps, BiTemporalProps {
  __label: 'Concept';
  name: string;
  description: string | null;
  category: string | null;

  // Mastery tracking
  masteryLevel: number; // 0-100
  exposureCount: number;
  lastReviewedAt: Date | null;

  // Embedding for semantic similarity
  embedding: number[] | null;
  embeddingModel: string | null;
}

/**
 * Vocabulary node - represents a word/term being learned
 */
export interface VocabularyNode extends BaseNodeProps, BiTemporalProps {
  __label: 'Vocabulary';
  word: string;
  definition: string;
  relatedWords: string | null;
  example: string | null;
  setId: number;

  // Leitner system fields (denormalized for quick access)
  leitnerBox: number; // 1-5
  leitnerNextReview: Date | null;
  leitnerFullyLearned: boolean;
  leitnerSkips: number;
  leitnerFlips: number;
  leitnerScore: number;
}

/**
 * URL node - represents a web page/article
 */
export interface URLNode extends BaseNodeProps {
  __label: 'URL';
  url: string;
  title: string;
  domain: string;
  lastVisited: Date;
  visitCount: number;
  isBookmarked: boolean;
  bookmarkFolderId: number | null;

  // Cached content for offline access
  contentHash: string | null;

  // Embedding for semantic search
  embedding: number[] | null;
  embeddingModel: string | null;
}

/**
 * Chat node - represents a conversation with AI
 */
export interface ChatNode extends BaseNodeProps {
  __label: 'Chat';
  description: string;
  totalTokens: number;
  pinned: boolean;
  autoDelete: boolean;
  sessionType: 'general' | 'in-context' | 'learn-about';

  // Context reference (what the chat is about)
  contextType: 'book' | 'url' | 'note' | null;
  contextKey: string | null;
}

/**
 * Message node - represents a single message in a chat
 */
export interface MessageNode extends BaseNodeProps, BiTemporalProps {
  __label: 'Message';
  role: 'system' | 'user' | 'assistant';
  content: string;
  tokenCount: number;

  // For agentic AI - tool calls and results
  toolCalls: ToolCall[] | null;
  toolResults: ToolResult[] | null;

  // Embedding for retrieval
  embedding: number[] | null;
  embeddingModel: string | null;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
  error: string | null;
}

/**
 * Quiz node - represents a quiz/assessment
 */
export interface QuizNode extends BaseNodeProps {
  __label: 'Quiz';
  title: string;
  quizType: 'scored_quiz' | 'instant_result_quiz';
  questionCount: number;
  totalScore: number | null;
  passedAt: Date | null;
}

/**
 * QuizProblem node - represents a single quiz question
 */
export interface QuizProblemNode extends BaseNodeProps {
  __label: 'QuizProblem';
  questionType: 'radiogroup' | 'boolean' | 'checkbox';
  question: string;
  choices: QuizChoice[];
  correctAnswer: string | string[];
  explanation: string | null;
  difficulty: 'easy' | 'medium' | 'hard';

  // Performance tracking
  timesAsked: number;
  timesCorrect: number;
  lastAskedAt: Date | null;
}

export interface QuizChoice {
  value: string;
  text: string;
}

/**
 * MoodBoard node - represents a visual brainstorming board
 */
export interface MoodBoardNode extends BaseNodeProps {
  __label: 'MoodBoard';
  name: string;
  description: string | null;
  gridLayout: string; // JSON serialized layout
  diagram: string; // JSON serialized diagram
  pinned: boolean;
}

/**
 * LearningSession node - episodic memory (Graphiti-inspired)
 * Tracks a focused learning session
 */
export interface LearningSessionNode extends BaseNodeProps, BiTemporalProps {
  __label: 'LearningSession';
  startTime: Date;
  endTime: Date | null;
  duration: number; // seconds
  focusScore: number; // 0-1
  notesCreated: number;
  conceptsReviewed: number;
  wordsLearned: number;

  // What was the main activity?
  activityType: 'reading' | 'reviewing' | 'quizzing' | 'browsing' | 'chatting';
  primaryResourceType: 'book' | 'url' | 'note' | null;
  primaryResourceId: string | null;
}

/**
 * Prompt node - saved AI prompt templates
 */
export interface PromptNode extends BaseNodeProps {
  __label: 'Prompt';
  title: string;
  content: string;
  category: string | null;
  usageCount: number;
  lastUsedAt: Date | null;
}

// =============================================================================
// RELATIONSHIP TYPES - Edges connecting nodes
// =============================================================================

/**
 * Base relationship properties
 */
export interface BaseRelationshipProps {
  createdAt: Date;
  weight: number; // 0-1, strength of relationship
}

/**
 * User relationships
 */
export interface OwnsRelationship extends BaseRelationshipProps {
  __type: 'OWNS';
}

/**
 * Book/Chapter relationships
 */
export interface ContainsChapterRelationship extends BaseRelationshipProps {
  __type: 'CONTAINS_CHAPTER';
}

/**
 * Note relationships
 */
export interface AnnotatesRelationship extends BaseRelationshipProps {
  __type: 'ANNOTATES';
  // Where in the source this annotation appears
  cfi: string | null;
  pageNumber: number | null;
  percentage: number | null;
}

export interface MentionsConceptRelationship extends BaseRelationshipProps {
  __type: 'MENTIONS_CONCEPT';
  frequency: number; // How many times mentioned
  importance: number; // 0-1, contextual importance
}

export interface RelatedToRelationship extends BaseRelationshipProps {
  __type: 'RELATED_TO';
  relationshipType: 'similar' | 'prerequisite' | 'extends' | 'contrasts' | 'example_of';
  confidence: number; // 0-1, how confident is this relationship
}

export interface SimilarToRelationship extends BaseRelationshipProps {
  __type: 'SIMILAR_TO';
  similarity: number; // 0-1, semantic similarity score
  // Which embedding model computed this
  embeddingModel: string;
}

/**
 * Learning relationships
 */
export interface LearnedInRelationship extends BaseRelationshipProps, BiTemporalProps {
  __type: 'LEARNED_IN';
  // Initial exposure vs review
  interactionType: 'first_exposure' | 'review' | 'quiz';
  // How well was it learned in this session?
  comprehensionScore: number | null; // 0-1
}

export interface ReviewedRelationship extends BaseRelationshipProps, BiTemporalProps {
  __type: 'REVIEWED';
  outcome: 'correct' | 'incorrect' | 'skipped';
  responseTime: number | null; // milliseconds
  leitnerBoxBefore: number;
  leitnerBoxAfter: number;
}

export interface RequiresRelationship extends BaseRelationshipProps {
  __type: 'REQUIRES';
  // Prerequisite concepts must be learned first
  importance: 'essential' | 'helpful' | 'optional';
}

/**
 * Content relationships
 */
export interface PartOfRelationship extends BaseRelationshipProps {
  __type: 'PART_OF';
  orderIndex: number;
}

export interface ReferencesRelationship extends BaseRelationshipProps {
  __type: 'REFERENCES';
  referenceType: 'citation' | 'link' | 'mention';
}

export interface DerivedFromRelationship extends BaseRelationshipProps {
  __type: 'DERIVED_FROM';
  derivationType: 'summary' | 'translation' | 'paraphrase' | 'quiz_generation';
}

/**
 * Chat relationships
 */
export interface HasMessageRelationship extends BaseRelationshipProps {
  __type: 'HAS_MESSAGE';
  orderIndex: number;
}

export interface DiscussesRelationship extends BaseRelationshipProps {
  __type: 'DISCUSSES';
  relevanceScore: number; // 0-1
}

export interface FollowsRelationship extends BaseRelationshipProps {
  __type: 'FOLLOWS';
  // For message threading
}

/**
 * MoodBoard relationships
 */
export interface DisplaysOnRelationship extends BaseRelationshipProps {
  __type: 'DISPLAYS_ON';
  x: number;
  y: number;
  width: number;
  height: number;
}

// =============================================================================
// UNION TYPES - For type safety when working with graph
// =============================================================================

export type GraphNode =
  | UserNode
  | BookNode
  | ChapterNode
  | NoteNode
  | ConceptNode
  | VocabularyNode
  | URLNode
  | ChatNode
  | MessageNode
  | QuizNode
  | QuizProblemNode
  | MoodBoardNode
  | LearningSessionNode
  | PromptNode;

export type GraphRelationship =
  | OwnsRelationship
  | ContainsChapterRelationship
  | AnnotatesRelationship
  | MentionsConceptRelationship
  | RelatedToRelationship
  | SimilarToRelationship
  | LearnedInRelationship
  | ReviewedRelationship
  | RequiresRelationship
  | PartOfRelationship
  | ReferencesRelationship
  | DerivedFromRelationship
  | HasMessageRelationship
  | DiscussesRelationship
  | FollowsRelationship
  | DisplaysOnRelationship;

export type NodeLabel = GraphNode['__label'];
export type RelationshipType = GraphRelationship['__type'];

// =============================================================================
// QUERY HELPER TYPES - For typed query building
// =============================================================================

/**
 * Learning path query - find path from current knowledge to target concept
 */
export interface LearningPathQuery {
  userId: number;
  targetConceptId: string;
  maxDepth?: number;
  includeReviews?: boolean;
}

export interface LearningPathResult {
  path: Array<{
    concept: ConceptNode;
    relationship: RequiresRelationship;
  }>;
  estimatedTime: number; // minutes
  prerequisitesMastered: number;
  prerequisitesTotal: number;
}

/**
 * Similar content query - find semantically similar content
 */
export interface SimilarContentQuery {
  embedding: number[];
  nodeTypes: NodeLabel[];
  limit?: number;
  minSimilarity?: number;
}

/**
 * Temporal knowledge query - what did user know at time X?
 */
export interface TemporalKnowledgeQuery {
  userId: number;
  asOfDate: Date;
  conceptIds?: string[];
}

export interface TemporalKnowledgeResult {
  concepts: Array<{
    concept: ConceptNode;
    masteryAtTime: number;
    lastReviewBeforeTime: Date | null;
  }>;
}

/**
 * Spaced repetition query - what needs review?
 */
export interface SpacedRepetitionQuery {
  userId: number;
  asOfDate: Date;
  itemTypes: ('note' | 'vocabulary')[];
  limit?: number;
}

export interface SpacedRepetitionResult {
  dueItems: Array<{
    itemType: 'note' | 'vocabulary';
    itemId: string;
    leitnerBox: number;
    overdueDays: number;
    lastReviewed: Date | null;
  }>;
  totalDue: number;
}

// =============================================================================
// CYPHER QUERY TEMPLATES - For reference during implementation
// =============================================================================

/**
 * Example Cypher queries for common operations
 * These are NOT executable code, just documentation for GraphManager
 */
export const CypherTemplates = {
  // Create a note with relationships
  CREATE_NOTE_WITH_RELATIONSHIPS: `
    MATCH (u:User {id: $userId})
    CREATE (n:Note $noteProps)
    CREATE (u)-[:OWNS]->(n)
    WITH n
    MATCH (b:Book {id: $sourceKey})
    WHERE $sourceType = 'book'
    CREATE (n)-[:ANNOTATES {cfi: $cfi, percentage: $percentage}]->(b)
    RETURN n
  `,

  // Find similar notes using vector similarity
  FIND_SIMILAR_NOTES: `
    MATCH (n:Note)
    WHERE n.embedding IS NOT NULL
    WITH n, gds.similarity.cosine(n.embedding, $queryEmbedding) AS similarity
    WHERE similarity >= $minSimilarity
    RETURN n, similarity
    ORDER BY similarity DESC
    LIMIT $limit
  `,

  // Get learning path to concept
  GET_LEARNING_PATH: `
    MATCH path = shortestPath(
      (start:Concept)-[:REQUIRES*]->(target:Concept {id: $targetId})
    )
    WHERE ALL(c IN nodes(path) WHERE
      EXISTS((u:User {id: $userId})-[:LEARNED_IN]->(:LearningSession)-[:REVIEWED]->(c))
    )
    RETURN path
  `,

  // Spaced repetition due items
  GET_DUE_REVIEW_ITEMS: `
    MATCH (u:User {id: $userId})-[:OWNS]->(item)
    WHERE (item:Note OR item:Vocabulary)
      AND item.leitnerNextReview <= $asOfDate
      AND item.leitnerFullyLearned = false
    RETURN item
    ORDER BY item.leitnerNextReview ASC
    LIMIT $limit
  `,

  // Temporal knowledge state
  GET_KNOWLEDGE_AT_TIME: `
    MATCH (u:User {id: $userId})-[:LEARNED_IN]->(s:LearningSession)-[:REVIEWED]->(c:Concept)
    WHERE s.eventTime <= $asOfDate
    WITH c, MAX(s.eventTime) AS lastReview
    RETURN c, lastReview, c.masteryLevel
  `,
} as const;

// =============================================================================
// INDEX DEFINITIONS - For GraphManager to create
// =============================================================================

export const GraphIndexes = {
  // Unique constraints
  UNIQUE_USER_ID: 'CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE',
  UNIQUE_BOOK_ID: 'CREATE CONSTRAINT book_id_unique IF NOT EXISTS FOR (b:Book) REQUIRE b.id IS UNIQUE',
  UNIQUE_NOTE_ID: 'CREATE CONSTRAINT note_id_unique IF NOT EXISTS FOR (n:Note) REQUIRE n.id IS UNIQUE',
  UNIQUE_CONCEPT_ID: 'CREATE CONSTRAINT concept_id_unique IF NOT EXISTS FOR (c:Concept) REQUIRE c.id IS UNIQUE',
  UNIQUE_VOCABULARY_ID: 'CREATE CONSTRAINT vocabulary_id_unique IF NOT EXISTS FOR (v:Vocabulary) REQUIRE v.id IS UNIQUE',
  UNIQUE_URL_ID: 'CREATE CONSTRAINT url_id_unique IF NOT EXISTS FOR (u:URL) REQUIRE u.id IS UNIQUE',
  UNIQUE_CHAT_ID: 'CREATE CONSTRAINT chat_id_unique IF NOT EXISTS FOR (c:Chat) REQUIRE c.id IS UNIQUE',

  // Search indexes
  INDEX_NOTE_SOURCE: 'CREATE INDEX note_source IF NOT EXISTS FOR (n:Note) ON (n.sourceType, n.sourceKey)',
  INDEX_NOTE_TAGS: 'CREATE INDEX note_tags IF NOT EXISTS FOR (n:Note) ON (n.tags)',
  INDEX_VOCABULARY_WORD: 'CREATE INDEX vocabulary_word IF NOT EXISTS FOR (v:Vocabulary) ON (v.word)',
  INDEX_CONCEPT_NAME: 'CREATE INDEX concept_name IF NOT EXISTS FOR (c:Concept) ON (c.name)',
  INDEX_URL_DOMAIN: 'CREATE INDEX url_domain IF NOT EXISTS FOR (u:URL) ON (u.domain)',

  // Temporal indexes for bi-temporal queries
  INDEX_NOTE_EVENT_TIME: 'CREATE INDEX note_event_time IF NOT EXISTS FOR (n:Note) ON (n.eventTime)',
  INDEX_NOTE_VALID_FROM: 'CREATE INDEX note_valid_from IF NOT EXISTS FOR (n:Note) ON (n.validFrom)',
  INDEX_SESSION_EVENT_TIME: 'CREATE INDEX session_event_time IF NOT EXISTS FOR (s:LearningSession) ON (s.eventTime)',

  // Spaced repetition indexes
  INDEX_LEITNER_REVIEW: 'CREATE INDEX leitner_review IF NOT EXISTS FOR (n) ON (n.leitnerNextReview) WHERE n:Note OR n:Vocabulary',

  // Full-text search indexes
  FULLTEXT_NOTE_CONTENT: 'CREATE FULLTEXT INDEX note_content IF NOT EXISTS FOR (n:Note) ON EACH [n.title, n.cards]',
  FULLTEXT_VOCABULARY: 'CREATE FULLTEXT INDEX vocabulary_search IF NOT EXISTS FOR (v:Vocabulary) ON EACH [v.word, v.definition, v.example]',
} as const;

// =============================================================================
// MIGRATION MAPPING - SQLite/ChromaDB to Neo4j
// =============================================================================

export const MigrationMapping = {
  // SQLite table -> Neo4j node type
  tables: {
    user: 'User',
    book: 'Book',
    note: 'Note',
    vocabulary: 'Vocabulary',
    chat: 'Chat',
    message: 'Message',
    quiz_problem: 'QuizProblem',
    moodboard: 'MoodBoard',
    prompt: 'Prompt',
    leitner_item: null, // Merged into Note/Vocabulary nodes
    bookmark: 'URL', // Bookmarks become URL nodes with isBookmarked=true
  },

  // ChromaDB collection -> Neo4j embedding property
  chromaCollections: {
    my_collection: {
      // ID format: {type}_{sourceKey}_{uniqueId}
      // Maps to embedding property on respective node types
      entityMapping: {
        epub: 'Book',
        pdf: 'Book',
        note: 'Note',
        bookmark: 'URL',
        message: 'Message',
      },
    },
    my_temp_collection: {
      // Ephemeral, not migrated
    },
  },
} as const;
