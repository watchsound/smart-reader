/**
 * GraphSchema.test.ts
 *
 * Type tests and validation for the GraphSchema TypeScript definitions.
 * Tests ensure:
 * - Type correctness and compile-time safety
 * - Data structure validation
 * - Bi-temporal model consistency
 * - Relationship constraints
 */

import {
  // Node types
  UserNode,
  BookNode,
  ChapterNode,
  NoteNode,
  ConceptNode,
  VocabularyNode,
  URLNode,
  ChatNode,
  MessageNode,
  QuizNode,
  QuizProblemNode,
  MoodBoardNode,
  LearningSessionNode,
  PromptNode,
  // Relationship types
  OwnsRelationship,
  AnnotatesRelationship,
  MentionsConceptRelationship,
  RelatedToRelationship,
  SimilarToRelationship,
  LearnedInRelationship,
  ReviewedRelationship,
  RequiresRelationship,
  // Union types
  GraphNode,
  GraphRelationship,
  NodeLabel,
  RelationshipType,
  // Helper interfaces
  BiTemporalProps,
  BaseNodeProps,
  NoteCard,
  PDFPosition,
  ToolCall,
  ToolResult,
  QuizChoice,
  // Query types
  LearningPathQuery,
  LearningPathResult,
  SimilarContentQuery,
  TemporalKnowledgeQuery,
  SpacedRepetitionQuery,
  SpacedRepetitionResult,
  // Constants
  GraphIndexes,
  MigrationMapping,
} from '../../commons/model/GraphSchema';

describe('GraphSchema Type Definitions', () => {
  // ===========================================================================
  // BASE TYPES TESTS
  // ===========================================================================

  describe('BiTemporalProps', () => {
    test('should have correct temporal properties', () => {
      const biTemporal: BiTemporalProps = {
        eventTime: new Date('2024-01-15T10:00:00Z'),
        recordTime: new Date('2024-01-15T10:05:00Z'),
        validFrom: new Date('2024-01-15T10:05:00Z'),
        validTo: null,
      };

      expect(biTemporal.eventTime).toBeInstanceOf(Date);
      expect(biTemporal.recordTime).toBeInstanceOf(Date);
      expect(biTemporal.validFrom).toBeInstanceOf(Date);
      expect(biTemporal.validTo).toBeNull();
    });

    test('should allow non-null validTo for historical records', () => {
      const historicalRecord: BiTemporalProps = {
        eventTime: new Date('2024-01-01'),
        recordTime: new Date('2024-01-01'),
        validFrom: new Date('2024-01-01'),
        validTo: new Date('2024-01-15'), // Record superseded
      };

      expect(historicalRecord.validTo).toBeInstanceOf(Date);
    });
  });

  describe('BaseNodeProps', () => {
    test('should have required base properties', () => {
      const baseNode: BaseNodeProps = {
        id: 'node-001',
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 1,
      };

      expect(baseNode.id).toBe('node-001');
      expect(baseNode.userId).toBe(1);
    });
  });

  // ===========================================================================
  // NODE TYPE TESTS
  // ===========================================================================

  describe('UserNode', () => {
    test('should have all user properties', () => {
      const user: UserNode = {
        __label: 'User',
        id: 'user-001',
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 1,
        email: 'test@example.com',
        name: 'Test User',
        readerLevel: 'middle',
        studyMode: 'general',
        preferredProvider: 'chatGPT',
        preferredModel: 'gpt-4o-mini',
      };

      expect(user.__label).toBe('User');
      expect(user.readerLevel).toBe('middle');
      expect(['elementary', 'middle', 'college']).toContain(user.readerLevel);
      expect(['general', 'language', 'math', 'program']).toContain(user.studyMode);
    });
  });

  describe('BookNode', () => {
    test('should have all book properties', () => {
      const book: BookNode = {
        __label: 'Book',
        id: 'book-001',
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 1,
        keyInStorage: 'storage-key-001',
        name: 'Test Book',
        subtitle: 'A Subtitle',
        author: 'Test Author',
        description: 'Book description',
        cover: 'base64-image-data',
        format: 'epub',
        publisher: 'Test Publisher',
        category: 'Fiction',
        size: 1024000,
        path: '/path/to/book.epub',
        favorite: true,
        bookshelfId: 1,
        embedding: [0.1, 0.2, 0.3],
        embeddingModel: 'text-embedding-3-small',
      };

      expect(book.__label).toBe('Book');
      expect(['epub', 'pdf', 'docx', 'html']).toContain(book.format);
      expect(book.embedding).toHaveLength(3);
    });

    test('should allow null for optional properties', () => {
      const minimalBook: BookNode = {
        __label: 'Book',
        id: 'book-002',
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 1,
        keyInStorage: 'key-002',
        name: 'Minimal Book',
        subtitle: null,
        author: null,
        description: null,
        cover: null,
        format: 'pdf',
        publisher: null,
        category: null,
        size: 0,
        path: '/path/to/book.pdf',
        favorite: false,
        bookshelfId: -1,
        embedding: null,
        embeddingModel: null,
      };

      expect(minimalBook.subtitle).toBeNull();
      expect(minimalBook.embedding).toBeNull();
    });
  });

  describe('NoteNode', () => {
    test('should have bi-temporal properties', () => {
      const note: NoteNode = {
        __label: 'Note',
        id: 'note-001',
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 1,
        // Bi-temporal
        eventTime: new Date(),
        recordTime: new Date(),
        validFrom: new Date(),
        validTo: null,
        // Note specific
        sourceType: 'book',
        sourceKey: 'book-001',
        title: 'Test Note',
        chapter: 'Chapter 1',
        chapterIndex: 0,
        cards: [
          {
            id: 0,
            text: 'Card content',
            html: '<p>Card content</p>',
            image: null,
            overlap: 0,
            type: 'normal',
          },
        ],
        cfi: 'epubcfi(/6/4!/4/2)',
        range: null,
        percentage: 25.5,
        position: null,
        emoji: '📚',
        color: '#ffff00',
        tags: ['test', 'demo'],
        rate: 5,
        hasQuiz: false,
        highlightOnly: false,
        highlightType: null,
        embedding: null,
        embeddingModel: null,
      };

      expect(note.__label).toBe('Note');
      expect(note.eventTime).toBeInstanceOf(Date);
      expect(note.cards).toHaveLength(1);
      expect(['book', 'url', 'chat', 'note']).toContain(note.sourceType);
    });

    test('NoteCard should have correct structure', () => {
      const card: NoteCard = {
        id: 0,
        text: 'Text content',
        html: '<p>HTML content</p>',
        image: 'base64-image',
        overlap: 1, // central
        type: 'mindmap',
      };

      expect([0, 1, 2, 3]).toContain(card.overlap);
      expect(['normal', 'mindmap']).toContain(card.type);
    });

    test('PDFPosition should have bounding rect', () => {
      const position: PDFPosition = {
        x1: 100,
        y1: 200,
        x2: 300,
        y2: 250,
        width: 800,
        height: 1200,
        pageNumber: 5,
      };

      expect(position.pageNumber).toBe(5);
      expect(position.x2).toBeGreaterThan(position.x1);
    });
  });

  describe('ConceptNode', () => {
    test('should have mastery tracking properties', () => {
      const concept: ConceptNode = {
        __label: 'Concept',
        id: 'concept-001',
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 1,
        eventTime: new Date(),
        recordTime: new Date(),
        validFrom: new Date(),
        validTo: null,
        name: 'Machine Learning',
        description: 'A branch of artificial intelligence',
        category: 'Computer Science',
        masteryLevel: 75,
        exposureCount: 10,
        lastReviewedAt: new Date(),
        embedding: [0.1, 0.2],
        embeddingModel: 'text-embedding-3-small',
      };

      expect(concept.masteryLevel).toBeGreaterThanOrEqual(0);
      expect(concept.masteryLevel).toBeLessThanOrEqual(100);
      expect(concept.exposureCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('VocabularyNode', () => {
    test('should have Leitner system properties', () => {
      const vocab: VocabularyNode = {
        __label: 'Vocabulary',
        id: 'vocab-001',
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 1,
        eventTime: new Date(),
        recordTime: new Date(),
        validFrom: new Date(),
        validTo: null,
        word: 'serendipity',
        definition: 'Finding good things by chance',
        relatedWords: 'luck, fortune, chance',
        example: 'It was pure serendipity.',
        setId: 1,
        leitnerBox: 3,
        leitnerNextReview: new Date('2024-02-01'),
        leitnerFullyLearned: false,
        leitnerSkips: 1,
        leitnerFlips: 5,
        leitnerScore: 80,
      };

      expect(vocab.leitnerBox).toBeGreaterThanOrEqual(1);
      expect(vocab.leitnerBox).toBeLessThanOrEqual(5);
      expect(vocab.leitnerFullyLearned).toBe(false);
    });
  });

  describe('MessageNode', () => {
    test('should support tool calls for agentic AI', () => {
      const toolCall: ToolCall = {
        id: 'call-001',
        name: 'searchNotes',
        arguments: { query: 'machine learning' },
      };

      const toolResult: ToolResult = {
        toolCallId: 'call-001',
        result: [{ id: 'note-001', title: 'ML Note' }],
        error: null,
      };

      const message: MessageNode = {
        __label: 'Message',
        id: 'msg-001',
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 1,
        eventTime: new Date(),
        recordTime: new Date(),
        validFrom: new Date(),
        validTo: null,
        role: 'assistant',
        content: 'I found some notes about machine learning.',
        tokenCount: 50,
        toolCalls: [toolCall],
        toolResults: [toolResult],
        embedding: null,
        embeddingModel: null,
      };

      expect(message.role).toBe('assistant');
      expect(message.toolCalls).toHaveLength(1);
      expect(message.toolResults).toHaveLength(1);
    });
  });

  describe('LearningSessionNode', () => {
    test('should track episodic learning data', () => {
      const session: LearningSessionNode = {
        __label: 'LearningSession',
        id: 'session-001',
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 1,
        eventTime: new Date(),
        recordTime: new Date(),
        validFrom: new Date(),
        validTo: null,
        startTime: new Date(),
        endTime: new Date(),
        duration: 1800, // 30 minutes
        focusScore: 0.85,
        notesCreated: 5,
        conceptsReviewed: 10,
        wordsLearned: 3,
        activityType: 'reading',
        primaryResourceType: 'book',
        primaryResourceId: 'book-001',
      };

      expect(session.duration).toBe(1800);
      expect(session.focusScore).toBeGreaterThanOrEqual(0);
      expect(session.focusScore).toBeLessThanOrEqual(1);
      expect(['reading', 'reviewing', 'quizzing', 'browsing', 'chatting']).toContain(
        session.activityType
      );
    });
  });

  // ===========================================================================
  // RELATIONSHIP TYPE TESTS
  // ===========================================================================

  describe('Relationship Types', () => {
    test('AnnotatesRelationship should have location info', () => {
      const annotates: AnnotatesRelationship = {
        __type: 'ANNOTATES',
        createdAt: new Date(),
        weight: 1.0,
        cfi: 'epubcfi(/6/4!/4/2)',
        pageNumber: null,
        percentage: 25.5,
      };

      expect(annotates.__type).toBe('ANNOTATES');
      expect(annotates.cfi).toBeDefined();
    });

    test('MentionsConceptRelationship should have frequency and importance', () => {
      const mentions: MentionsConceptRelationship = {
        __type: 'MENTIONS_CONCEPT',
        createdAt: new Date(),
        weight: 0.8,
        frequency: 5,
        importance: 0.9,
      };

      expect(mentions.frequency).toBeGreaterThan(0);
      expect(mentions.importance).toBeGreaterThanOrEqual(0);
      expect(mentions.importance).toBeLessThanOrEqual(1);
    });

    test('RelatedToRelationship should have relationship type', () => {
      const relatedTo: RelatedToRelationship = {
        __type: 'RELATED_TO',
        createdAt: new Date(),
        weight: 0.7,
        relationshipType: 'prerequisite',
        confidence: 0.85,
      };

      expect(['similar', 'prerequisite', 'extends', 'contrasts', 'example_of']).toContain(
        relatedTo.relationshipType
      );
    });

    test('ReviewedRelationship should have bi-temporal and outcome', () => {
      const reviewed: ReviewedRelationship = {
        __type: 'REVIEWED',
        createdAt: new Date(),
        weight: 1.0,
        eventTime: new Date(),
        recordTime: new Date(),
        validFrom: new Date(),
        validTo: null,
        outcome: 'correct',
        responseTime: 2500, // ms
        leitnerBoxBefore: 2,
        leitnerBoxAfter: 3,
      };

      expect(['correct', 'incorrect', 'skipped']).toContain(reviewed.outcome);
      expect(reviewed.leitnerBoxAfter).toBe(reviewed.leitnerBoxBefore + 1);
    });

    test('RequiresRelationship should have importance level', () => {
      const requires: RequiresRelationship = {
        __type: 'REQUIRES',
        createdAt: new Date(),
        weight: 1.0,
        importance: 'essential',
      };

      expect(['essential', 'helpful', 'optional']).toContain(requires.importance);
    });
  });

  // ===========================================================================
  // UNION TYPE TESTS
  // ===========================================================================

  describe('Union Types', () => {
    test('GraphNode should accept any node type', () => {
      const nodes: GraphNode[] = [
        {
          __label: 'User',
          id: 'user-001',
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: 1,
          email: 'test@test.com',
          name: 'Test',
          readerLevel: 'middle',
          studyMode: 'general',
          preferredProvider: 'chatGPT',
          preferredModel: 'gpt-4o-mini',
        } as UserNode,
        {
          __label: 'Book',
          id: 'book-001',
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: 1,
          keyInStorage: 'key',
          name: 'Book',
          subtitle: null,
          author: null,
          description: null,
          cover: null,
          format: 'epub',
          publisher: null,
          category: null,
          size: 0,
          path: '/path',
          favorite: false,
          bookshelfId: -1,
          embedding: null,
          embeddingModel: null,
        } as BookNode,
      ];

      expect(nodes).toHaveLength(2);
      expect(nodes[0].__label).toBe('User');
      expect(nodes[1].__label).toBe('Book');
    });

    test('NodeLabel should be a valid label string', () => {
      const labels: NodeLabel[] = [
        'User',
        'Book',
        'Note',
        'Concept',
        'Vocabulary',
        'URL',
        'Chat',
        'Message',
        'Quiz',
        'QuizProblem',
        'MoodBoard',
        'LearningSession',
        'Prompt',
      ];

      expect(labels).toContain('Note');
      expect(labels).toContain('LearningSession');
    });

    test('RelationshipType should be a valid type string', () => {
      const types: RelationshipType[] = [
        'OWNS',
        'CONTAINS_CHAPTER',
        'ANNOTATES',
        'MENTIONS_CONCEPT',
        'RELATED_TO',
        'SIMILAR_TO',
        'LEARNED_IN',
        'REVIEWED',
        'REQUIRES',
        'PART_OF',
        'REFERENCES',
        'DERIVED_FROM',
        'HAS_MESSAGE',
        'DISCUSSES',
        'FOLLOWS',
        'DISPLAYS_ON',
      ];

      expect(types).toContain('ANNOTATES');
      expect(types).toContain('REVIEWED');
    });
  });

  // ===========================================================================
  // QUERY TYPE TESTS
  // ===========================================================================

  describe('Query Types', () => {
    test('LearningPathQuery should have required fields', () => {
      const query: LearningPathQuery = {
        userId: 1,
        targetConceptId: 'concept-001',
        maxDepth: 5,
        includeReviews: true,
      };

      expect(query.userId).toBe(1);
      expect(query.targetConceptId).toBeDefined();
    });

    test('LearningPathResult should contain path and stats', () => {
      const result: LearningPathResult = {
        path: [
          {
            concept: {
              __label: 'Concept',
              id: 'prereq-001',
              name: 'Prerequisite',
            } as ConceptNode,
            relationship: {
              __type: 'REQUIRES',
              createdAt: new Date(),
              weight: 1.0,
              importance: 'essential',
            },
          },
        ],
        estimatedTime: 120, // minutes
        prerequisitesMastered: 3,
        prerequisitesTotal: 5,
      };

      expect(result.path).toHaveLength(1);
      expect(result.prerequisitesMastered).toBeLessThanOrEqual(result.prerequisitesTotal);
    });

    test('SpacedRepetitionQuery should filter by item types', () => {
      const query: SpacedRepetitionQuery = {
        userId: 1,
        asOfDate: new Date(),
        itemTypes: ['note', 'vocabulary'],
        limit: 50,
      };

      expect(query.itemTypes).toContain('note');
      expect(query.itemTypes).toContain('vocabulary');
    });

    test('SpacedRepetitionResult should contain due items', () => {
      const result: SpacedRepetitionResult = {
        dueItems: [
          {
            itemType: 'note',
            itemId: 'note-001',
            leitnerBox: 2,
            overdueDays: 3,
            lastReviewed: new Date('2024-01-10'),
          },
          {
            itemType: 'vocabulary',
            itemId: 'vocab-001',
            leitnerBox: 1,
            overdueDays: 1,
            lastReviewed: null,
          },
        ],
        totalDue: 2,
      };

      expect(result.dueItems).toHaveLength(2);
      expect(result.totalDue).toBe(2);
    });
  });

  // ===========================================================================
  // CONSTANTS TESTS
  // ===========================================================================

  describe('GraphIndexes', () => {
    test('should contain unique constraints', () => {
      expect(GraphIndexes.UNIQUE_USER_ID).toContain('CONSTRAINT');
      expect(GraphIndexes.UNIQUE_USER_ID).toContain('UNIQUE');
      expect(GraphIndexes.UNIQUE_NOTE_ID).toContain('Note');
    });

    test('should contain search indexes', () => {
      expect(GraphIndexes.INDEX_NOTE_SOURCE).toContain('INDEX');
      expect(GraphIndexes.INDEX_VOCABULARY_WORD).toContain('word');
    });

    test('should contain temporal indexes', () => {
      expect(GraphIndexes.INDEX_NOTE_EVENT_TIME).toContain('eventTime');
      expect(GraphIndexes.INDEX_SESSION_EVENT_TIME).toContain('LearningSession');
    });
  });

  describe('MigrationMapping', () => {
    test('should map SQLite tables to Neo4j labels', () => {
      expect(MigrationMapping.tables.user).toBe('User');
      expect(MigrationMapping.tables.book).toBe('Book');
      expect(MigrationMapping.tables.note).toBe('Note');
      expect(MigrationMapping.tables.leitner_item).toBeNull(); // Merged into nodes
    });

    test('should map ChromaDB collections', () => {
      expect(MigrationMapping.chromaCollections.my_collection).toBeDefined();
      expect(MigrationMapping.chromaCollections.my_collection.entityMapping.epub).toBe('Book');
      expect(MigrationMapping.chromaCollections.my_collection.entityMapping.note).toBe('Note');
    });
  });
});

// ===========================================================================
// TYPE SAFETY COMPILE-TIME TESTS
// ===========================================================================

describe('Type Safety (Compile-Time)', () => {
  test('should enforce correct label types', () => {
    // This would fail at compile time if __label wasn't correct
    const note: NoteNode = {
      __label: 'Note', // Must be exactly 'Note'
      // ... other properties
    } as NoteNode;

    expect(note.__label).toBe('Note');
  });

  test('should enforce correct relationship types', () => {
    // This would fail at compile time if __type wasn't correct
    const relationship: AnnotatesRelationship = {
      __type: 'ANNOTATES', // Must be exactly 'ANNOTATES'
      createdAt: new Date(),
      weight: 1.0,
      cfi: null,
      pageNumber: 1,
      percentage: null,
    };

    expect(relationship.__type).toBe('ANNOTATES');
  });

  test('should enforce enum-like constraints', () => {
    const user: Partial<UserNode> = {
      readerLevel: 'college', // Must be 'elementary' | 'middle' | 'college'
      studyMode: 'language', // Must be 'general' | 'language' | 'math' | 'program'
    };

    expect(user.readerLevel).toBe('college');
    expect(user.studyMode).toBe('language');
  });
});
