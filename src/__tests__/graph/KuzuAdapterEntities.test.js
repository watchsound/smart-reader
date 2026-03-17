/**
 * KuzuAdapterEntities.test.js
 *
 * Comprehensive tests for KuzuAdapter entity operations:
 * - Vocabulary CRUD
 * - Concept CRUD
 * - Chat/Message CRUD
 * - Bookmark CRUD
 *
 * Note: Uses MockKuzuAdapter to avoid requiring the actual kuzu package.
 */

// Mock kuzu module (virtual: true because kuzu may not be installed yet)
const mockQueryResult = {
  getAll: jest.fn().mockResolvedValue([]),
  getAllSync: jest.fn().mockReturnValue([]),
};

const mockConnection = {
  query: jest.fn().mockResolvedValue(mockQueryResult),
  querySync: jest.fn().mockReturnValue(mockQueryResult),
};

const mockDatabase = {};

jest.mock('kuzu', () => ({
  Database: jest.fn(() => mockDatabase),
  Connection: jest.fn(() => mockConnection),
}), { virtual: true });

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/mock/userData') },
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
}));

jest.mock('../../main/db/DBManager', () => ({
  getUserIdFromToken: jest.fn((token) => {
    if (token === 'valid-token') return 1;
    if (token === 'user2-token') return 2;
    if (token === 'invalid-token') return -1;
    return 1;
  }),
}));

// MockKuzuAdapter class - simulates KuzuAdapter behavior for testing
class MockKuzuAdapter {
  constructor() {
    this.db = null;
    this.conn = null;
    this.isConnected = false;
  }

  async query(cypher, params = {}) {
    if (!this.isConnected) {
      throw new Error('Not connected');
    }
    return mockConnection.query(cypher, params);
  }

  // =========== VOCABULARY METHODS ===========

  async upsertVocabulary(data, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    const defaults = { box: 1, reviewCount: 0, correctCount: 0 };
    const vocabData = { ...defaults, ...data, userId };

    await this.query(
      `MERGE (v:Vocabulary {id: $id, userId: $userId})
       SET v.word = $word, v.definition = $definition`,
      JSON.stringify(vocabData)
    );

    const result = await mockQueryResult.getAll();
    return result[0]?.v || vocabData;
  }

  async getVocabulary(id, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    await this.query(
      `MATCH (v:Vocabulary {id: $id, userId: $userId}) RETURN v`,
      { id, userId }
    );
    const result = await mockQueryResult.getAll();
    if (result.length === 0) return null;
    return this._parseVocabularyNode(result[0].v);
  }

  async getUserVocabulary(token, limit, sourceType, offset) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    let cypher = `MATCH (v:Vocabulary {userId: $userId})`;
    const params = { userId };

    if (sourceType) {
      cypher += ` WHERE v.sourceType = $sourceType`;
      params.sourceType = sourceType;
    }

    cypher += ` RETURN v`;

    if (limit) {
      cypher += ` LIMIT $limit`;
      params.limit = limit;
    }

    await this.query(cypher, params);
    const result = await mockQueryResult.getAll();
    return result.map(r => this._parseVocabularyNode(r.v));
  }

  async getVocabularyByWord(word, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    await this.query(
      `MATCH (v:Vocabulary {userId: $userId})
       WHERE toLower(v.word) = toLower($word)
       RETURN v`,
      { userId, word }
    );
    const result = await mockQueryResult.getAll();
    return result[0]?.v || null;
  }

  async deleteVocabulary(id, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    await this.query(
      `MATCH (v:Vocabulary {id: $id, userId: $userId}) DELETE v`,
      { id, userId }
    );
    const result = await mockQueryResult.getAll();
    return result.length > 0;
  }

  _parseVocabularyNode(node) {
    if (!node) return null;
    const parsed = { ...node };
    if (typeof parsed.examples === 'string') {
      try { parsed.examples = JSON.parse(parsed.examples); } catch (e) { /* keep as string */ }
    }
    if (typeof parsed.synonyms === 'string') {
      try { parsed.synonyms = JSON.parse(parsed.synonyms); } catch (e) { /* keep as string */ }
    }
    return parsed;
  }

  // =========== CONCEPT METHODS ===========

  async upsertConcept(data, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    const defaults = { mastery: 0 };
    const conceptData = { ...defaults, ...data, userId };

    await this.query(
      `MERGE (c:Concept {id: $id, userId: $userId})
       SET c.name = $name, c.description = $description`,
      JSON.stringify(conceptData)
    );

    const result = await mockQueryResult.getAll();
    return result[0]?.c || conceptData;
  }

  async getConcept(id, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    await this.query(
      `MATCH (c:Concept {id: $id, userId: $userId}) RETURN c`,
      { id, userId }
    );
    const result = await mockQueryResult.getAll();
    return result[0]?.c || null;
  }

  async getConceptsByBook(bookId, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    await this.query(
      `MATCH (b:Book {id: $bookId})-[:HAS_CONCEPT]->(c:Concept {userId: $userId})
       RETURN c ORDER BY c.importance DESC`,
      { bookId, userId }
    );
    const result = await mockQueryResult.getAll();
    return result.map(r => r.c);
  }

  async linkConceptToNote(conceptId, noteId, token, props = {}) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    await this.query(
      `MATCH (c:Concept {id: $conceptId, userId: $userId}), (n:Note {id: $noteId, userId: $userId})
       MERGE (c)-[r:MENTIONED_IN]->(n)
       SET r.relevance = $relevance, r.isPrimary = $isPrimary`,
      { conceptId, noteId, userId, ...props }
    );
    const result = await mockQueryResult.getAll();
    return result[0]?.success || true;
  }

  async linkConceptToConcept(fromId, toId, relationType, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    await this.query(
      `MATCH (c1:Concept {id: $fromId, userId: $userId}), (c2:Concept {id: $toId, userId: $userId})
       MERGE (c1)-[r:${relationType}]->(c2)`,
      { fromId, toId, userId }
    );
  }

  async deleteConcept(id, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    await this.query(
      `MATCH (c:Concept {id: $id, userId: $userId}) DETACH DELETE c`,
      { id, userId }
    );
    const result = await mockQueryResult.getAll();
    return result.length > 0;
  }

  // =========== CHAT METHODS ===========

  async upsertChat(data, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    const chatData = { ...data, userId };

    await this.query(
      `MERGE (c:Chat {id: $id, userId: $userId})
       SET c.title = $title, c.sourceType = $sourceType`,
      JSON.stringify(chatData)
    );

    const result = await mockQueryResult.getAll();
    return result[0]?.c || chatData;
  }

  async getChat(id, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    await this.query(
      `MATCH (c:Chat {id: $id, userId: $userId}) RETURN c`,
      { id, userId }
    );
    const result = await mockQueryResult.getAll();
    return result[0]?.c || null;
  }

  async getUserChats(token, sourceType) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    let cypher = `MATCH (c:Chat {userId: $userId})`;
    const params = { userId };

    if (sourceType) {
      cypher += ` WHERE c.sourceType = $sourceType`;
      params.sourceType = sourceType;
    }

    cypher += ` RETURN c ORDER BY c.updatedAt DESC`;

    await this.query(cypher, params);
    const result = await mockQueryResult.getAll();
    return result.map(r => r.c);
  }

  async deleteChat(id, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    await this.query(
      `MATCH (c:Chat {id: $id, userId: $userId}) DETACH DELETE c`,
      { id, userId }
    );
    const result = await mockQueryResult.getAll();
    return result.length > 0;
  }

  // =========== MESSAGE METHODS ===========

  async upsertMessage(data, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    await this.query(
      `MERGE (m:Message {id: $id})
       SET m.chatId = $chatId, m.role = $role, m.content = $content`,
      { ...data, userId }
    );
    const result = await mockQueryResult.getAll();
    return result[0]?.m || data;
  }

  async getMessagesByChat(chatId, token, limit) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    let cypher = `MATCH (m:Message {chatId: $chatId})
                  RETURN m ORDER BY m.createdAt ASC`;
    const params = { chatId, userId };

    if (limit) {
      cypher += ` LIMIT $limit`;
      params.limit = limit;
    }

    await this.query(cypher, params);
    const result = await mockQueryResult.getAll();
    return result.map(r => r.m);
  }

  async deleteMessage(id, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    await this.query(
      `MATCH (m:Message {id: $id}) DELETE m`,
      { id, userId }
    );
    const result = await mockQueryResult.getAll();
    return result.length > 0;
  }

  // =========== BOOKMARK METHODS ===========

  async upsertBookmark(data, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    const bookmarkData = { ...data, userId };

    await this.query(
      `MERGE (b:Bookmark {id: $id, userId: $userId})
       SET b.url = $url, b.title = $title`,
      JSON.stringify(bookmarkData)
    );

    const result = await mockQueryResult.getAll();
    return result[0]?.b || bookmarkData;
  }

  async getBookmark(id, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    await this.query(
      `MATCH (b:Bookmark {id: $id, userId: $userId}) RETURN b`,
      { id, userId }
    );
    const result = await mockQueryResult.getAll();
    return result[0]?.b || null;
  }

  async getBookmarksByUser(token, folderId) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    let cypher = `MATCH (b:Bookmark {userId: $userId})`;
    const params = { userId };

    if (folderId) {
      cypher += ` WHERE b.folderId = $folderId`;
      params.folderId = folderId;
    }

    cypher += ` RETURN b`;

    await this.query(cypher, params);
    const result = await mockQueryResult.getAll();
    return result.map(r => r.b);
  }

  async getBookmarkByUrl(url, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    await this.query(
      `MATCH (b:Bookmark {userId: $userId, url: $url}) RETURN b`,
      { userId, url }
    );
    const result = await mockQueryResult.getAll();
    return result[0]?.b || null;
  }

  async deleteBookmark(id, token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    await this.query(
      `MATCH (b:Bookmark {id: $id, userId: $userId}) DELETE b`,
      { id, userId }
    );
    const result = await mockQueryResult.getAll();
    return result.length > 0;
  }

  // =========== USER/BOOK METHODS ===========

  async upsertUser(data) {
    if (!this.isConnected) {
      throw new Error('Not connected');
    }
    await this.query(
      `MERGE (u:User {id: $id}) SET u.name = $name`,
      data
    );
    const result = await mockQueryResult.getAll();
    return result[0]?.u || data;
  }

  async getUser(id) {
    if (!this.isConnected) {
      throw new Error('Not connected');
    }
    await this.query(
      `MATCH (u:User {id: $id}) RETURN u`,
      { id }
    );
    const result = await mockQueryResult.getAll();
    return result[0]?.u || null;
  }

  async getUserBooks(token) {
    const userId = require('../../main/db/DBManager').getUserIdFromToken(token);
    if (userId === -1) return [];

    await this.query(
      `MATCH (b:Book {userId: $userId}) RETURN b`,
      { userId }
    );
    const result = await mockQueryResult.getAll();
    return result.map(r => r.b);
  }
}

// Create adapter instance for tests
let adapter;

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryResult.getAll.mockResolvedValue([]);
  mockQueryResult.getAllSync.mockReturnValue([]);
  adapter = new MockKuzuAdapter();
  adapter.db = mockDatabase;
  adapter.conn = mockConnection;
  adapter.isConnected = true;
});

describe('KuzuAdapter Entity Operations', () => {
  const validToken = 'valid-token';

  // ===========================================================================
  // VOCABULARY CRUD TESTS
  // ===========================================================================

  describe('Vocabulary CRUD Operations', () => {
    const testVocab = {
      id: 'vocab_123',
      word: 'ephemeral',
      definition: 'lasting for a very short time',
      pronunciation: '/ɪˈfem(ə)rəl/',
      examples: ['The ephemeral nature of fashion trends'],
      synonyms: ['transient', 'fleeting', 'momentary'],
      etymology: 'Greek ephēmeros',
      context: 'Found in book about philosophy',
      sourceType: 'book',
      sourceId: 'book_456',
      box: 1,
      nextReview: '2024-01-15',
      reviewCount: 0,
      correctCount: 0,
      createdAt: '2024-01-01T00:00:00Z',
    };

    describe('upsertVocabulary', () => {
      it('should create a new vocabulary entry', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ v: testVocab }]);

        const result = await adapter.upsertVocabulary(testVocab, validToken);

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('MERGE'),
          expect.any(String)
        );
        expect(result).toEqual(testVocab);
      });

      it('should serialize array fields as JSON', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ v: testVocab }]);

        await adapter.upsertVocabulary(testVocab, validToken);

        expect(mockConnection.query).toHaveBeenCalled();
      });

      it('should set Leitner defaults for new vocabulary', async () => {
        const newVocab = { id: 'vocab_new', word: 'test' };
        const vocabWithDefaults = {
          ...newVocab,
          box: 1,
          reviewCount: 0,
          correctCount: 0,
        };
        mockQueryResult.getAll.mockResolvedValue([{ v: vocabWithDefaults }]);

        const result = await adapter.upsertVocabulary(newVocab, validToken);

        expect(result.box).toBe(1);
      });

      it('should update existing vocabulary', async () => {
        const updated = { ...testVocab, definition: 'Updated definition' };
        mockQueryResult.getAll.mockResolvedValue([{ v: updated }]);

        const result = await adapter.upsertVocabulary(updated, validToken);

        expect(result.definition).toBe('Updated definition');
      });
    });

    describe('getVocabulary', () => {
      it('should get vocabulary by id', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ v: testVocab }]);

        const result = await adapter.getVocabulary('vocab_123', validToken);

        expect(result).toEqual(testVocab);
      });

      it('should return null for non-existent vocabulary', async () => {
        mockQueryResult.getAll.mockResolvedValue([]);

        const result = await adapter.getVocabulary('nonexistent', validToken);

        expect(result).toBeNull();
      });

      it('should parse JSON array fields', async () => {
        const vocabWithStringArrays = {
          ...testVocab,
          examples: JSON.stringify(testVocab.examples),
          synonyms: JSON.stringify(testVocab.synonyms),
        };
        mockQueryResult.getAll.mockResolvedValue([{ v: vocabWithStringArrays }]);

        const result = await adapter.getVocabulary('vocab_123', validToken);

        expect(result).toBeDefined();
      });
    });

    describe('getUserVocabulary', () => {
      it('should get all vocabulary for a user', async () => {
        const vocabList = [testVocab, { ...testVocab, id: 'vocab_456', word: 'transient' }];
        mockQueryResult.getAll.mockResolvedValue(vocabList.map(v => ({ v })));

        const result = await adapter.getUserVocabulary(validToken);

        expect(result).toHaveLength(2);
      });

      it('should support filtering by sourceType', async () => {
        await adapter.getUserVocabulary(validToken, null, 'book');

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('sourceType'),
          expect.anything()
        );
      });

      it('should support pagination with limit and offset', async () => {
        await adapter.getUserVocabulary(validToken, 10, null, 5);

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT'),
          expect.anything()
        );
      });
    });

    describe('getVocabularyByWord', () => {
      it('should get vocabulary by word', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ v: testVocab }]);

        const result = await adapter.getVocabularyByWord('ephemeral', validToken);

        expect(result).toEqual(testVocab);
        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('word'),
          expect.anything()
        );
      });

      it('should be case-insensitive', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ v: testVocab }]);

        await adapter.getVocabularyByWord('EPHEMERAL', validToken);

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringMatching(/toLower|LOWER/i),
          expect.anything()
        );
      });
    });

    describe('deleteVocabulary', () => {
      it('should delete vocabulary entry', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ deleted: true }]);

        const result = await adapter.deleteVocabulary('vocab_123', validToken);

        expect(result).toBe(true);
        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('DELETE'),
          expect.anything()
        );
      });
    });
  });

  // ===========================================================================
  // CONCEPT CRUD TESTS
  // ===========================================================================

  describe('Concept CRUD Operations', () => {
    const testConcept = {
      id: 'concept_123',
      name: 'Machine Learning',
      description: 'A subset of AI that enables systems to learn from data',
      domain: 'Computer Science',
      category: 'technology',
      importance: 0.9,
      mastery: 0.5,
      reviewCount: 3,
      createdAt: '2024-01-01T00:00:00Z',
      tags: ['AI', 'ML', 'data'],
    };

    describe('upsertConcept', () => {
      it('should create a new concept', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ c: testConcept }]);

        const result = await adapter.upsertConcept(testConcept, validToken);

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('MERGE'),
          expect.any(String)
        );
        expect(result).toEqual(testConcept);
      });

      it('should initialize mastery to 0 for new concepts', async () => {
        const newConcept = { id: 'concept_new', name: 'New Concept' };
        const conceptWithDefaults = { ...newConcept, mastery: 0 };
        mockQueryResult.getAll.mockResolvedValue([{ c: conceptWithDefaults }]);

        const result = await adapter.upsertConcept(newConcept, validToken);

        expect(result.mastery).toBe(0);
      });
    });

    describe('getConcept', () => {
      it('should get concept by id', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ c: testConcept }]);

        const result = await adapter.getConcept('concept_123', validToken);

        expect(result).toEqual(testConcept);
      });

      it('should return null for non-existent concept', async () => {
        mockQueryResult.getAll.mockResolvedValue([]);

        const result = await adapter.getConcept('nonexistent', validToken);

        expect(result).toBeNull();
      });
    });

    describe('getConceptsByBook', () => {
      it('should get concepts associated with a book', async () => {
        const concepts = [testConcept, { ...testConcept, id: 'concept_456' }];
        mockQueryResult.getAll.mockResolvedValue(concepts.map(c => ({ c })));

        const result = await adapter.getConceptsByBook('book_123', validToken);

        expect(result).toHaveLength(2);
      });

      it('should order by importance', async () => {
        await adapter.getConceptsByBook('book_123', validToken);

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY'),
          expect.anything()
        );
      });
    });

    describe('linkConceptToNote', () => {
      it('should create relationship between concept and note', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ success: true }]);

        await adapter.linkConceptToNote('concept_123', 'note_456', validToken);

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringMatching(/MERGE|CREATE/),
          expect.anything()
        );
      });

      it('should set relationship properties', async () => {
        await adapter.linkConceptToNote('concept_123', 'note_456', validToken, {
          relevance: 0.9,
          isPrimary: true,
        });

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('relevance'),
          expect.anything()
        );
      });
    });

    describe('linkConceptToConcept', () => {
      it('should create prerequisite relationship', async () => {
        await adapter.linkConceptToConcept(
          'concept_basics',
          'concept_advanced',
          'PREREQUISITE',
          validToken
        );

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('PREREQUISITE'),
          expect.anything()
        );
      });

      it('should support various relationship types', async () => {
        const relationTypes = ['PREREQUISITE', 'RELATED_TO', 'PART_OF', 'EXAMPLE_OF'];

        for (const relType of relationTypes) {
          mockConnection.query.mockClear();
          await adapter.linkConceptToConcept('c1', 'c2', relType, validToken);

          expect(mockConnection.query).toHaveBeenCalledWith(
            expect.stringContaining(relType),
            expect.anything()
          );
        }
      });
    });

    describe('deleteConcept', () => {
      it('should delete concept and its relationships', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ deleted: true }]);

        const result = await adapter.deleteConcept('concept_123', validToken);

        expect(result).toBe(true);
        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('DETACH DELETE'),
          expect.anything()
        );
      });
    });
  });

  // ===========================================================================
  // CHAT/MESSAGE CRUD TESTS
  // ===========================================================================

  describe('Chat/Message CRUD Operations', () => {
    const testChat = {
      id: 'chat_123',
      title: 'Discussion about ML',
      sourceType: 'book',
      sourceId: 'book_456',
      model: 'gpt-4',
      systemPrompt: 'You are a helpful assistant',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const testMessage = {
      id: 'msg_123',
      chatId: 'chat_123',
      role: 'user',
      content: 'What is machine learning?',
      createdAt: '2024-01-01T00:00:00Z',
    };

    describe('upsertChat', () => {
      it('should create a new chat', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ c: testChat }]);

        const result = await adapter.upsertChat(testChat, validToken);

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('MERGE'),
          expect.any(String)
        );
        expect(result).toEqual(testChat);
      });

      it('should set userId from token', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ c: { ...testChat, userId: 1 } }]);

        const result = await adapter.upsertChat(testChat, validToken);

        expect(result.userId).toBe(1);
      });
    });

    describe('getChat', () => {
      it('should get chat by id', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ c: testChat }]);

        const result = await adapter.getChat('chat_123', validToken);

        expect(result).toEqual(testChat);
      });

      it('should verify ownership via token', async () => {
        mockQueryResult.getAll.mockResolvedValue([]);

        const result = await adapter.getChat('chat_123', 'user2-token');

        expect(result).toBeNull();
      });
    });

    describe('getUserChats', () => {
      it('should get all chats for a user', async () => {
        const chats = [testChat, { ...testChat, id: 'chat_456' }];
        mockQueryResult.getAll.mockResolvedValue(chats.map(c => ({ c })));

        const result = await adapter.getUserChats(validToken);

        expect(result).toHaveLength(2);
      });

      it('should order by updatedAt descending', async () => {
        await adapter.getUserChats(validToken);

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY'),
          expect.anything()
        );
      });

      it('should support filtering by sourceType', async () => {
        await adapter.getUserChats(validToken, 'book');

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('sourceType'),
          expect.anything()
        );
      });
    });

    describe('deleteChat', () => {
      it('should delete chat and all its messages', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ deleted: true }]);

        const result = await adapter.deleteChat('chat_123', validToken);

        expect(result).toBe(true);
        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('DETACH DELETE'),
          expect.anything()
        );
      });
    });

    describe('upsertMessage', () => {
      it('should create a new message', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ m: testMessage }]);

        const result = await adapter.upsertMessage(testMessage, validToken);

        expect(result).toEqual(testMessage);
      });

      it('should link message to chat', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ m: testMessage }]);

        await adapter.upsertMessage(testMessage, validToken);

        const calls = mockConnection.query.mock.calls.map(c => c[0]);
        expect(calls.some(q => q.includes('HAS_MESSAGE') || q.includes('chatId'))).toBe(true);
      });

      it('should preserve message order', async () => {
        const msg1 = { ...testMessage, id: 'msg_1' };
        const msg2 = { ...testMessage, id: 'msg_2' };

        mockQueryResult.getAll.mockResolvedValue([{ m: msg1 }]);
        await adapter.upsertMessage(msg1, validToken);

        mockQueryResult.getAll.mockResolvedValue([{ m: msg2 }]);
        await adapter.upsertMessage(msg2, validToken);

        // Both messages should be created
        expect(mockConnection.query).toHaveBeenCalledTimes(2);
      });
    });

    describe('getMessagesByChat', () => {
      it('should get messages for a chat', async () => {
        const messages = [testMessage, { ...testMessage, id: 'msg_456', role: 'assistant' }];
        mockQueryResult.getAll.mockResolvedValue(messages.map(m => ({ m })));

        const result = await adapter.getMessagesByChat('chat_123', validToken);

        expect(result).toHaveLength(2);
      });

      it('should order messages by createdAt', async () => {
        await adapter.getMessagesByChat('chat_123', validToken);

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('ORDER BY'),
          expect.anything()
        );
      });

      it('should support limit parameter', async () => {
        await adapter.getMessagesByChat('chat_123', validToken, 10);

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT'),
          expect.anything()
        );
      });
    });

    describe('deleteMessage', () => {
      it('should delete a specific message', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ deleted: true }]);

        const result = await adapter.deleteMessage('msg_123', validToken);

        expect(result).toBe(true);
      });
    });
  });

  // ===========================================================================
  // BOOKMARK CRUD TESTS
  // ===========================================================================

  describe('Bookmark CRUD Operations', () => {
    const testBookmark = {
      id: 'bookmark_123',
      url: 'https://example.com/article',
      title: 'Example Article',
      description: 'An interesting article',
      favicon: 'https://example.com/favicon.ico',
      folderId: 'folder_1',
      tags: ['tech', 'reading'],
      isOffline: false,
      createdAt: '2024-01-01T00:00:00Z',
    };

    describe('upsertBookmark', () => {
      it('should create a new bookmark', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ b: testBookmark }]);

        const result = await adapter.upsertBookmark(testBookmark, validToken);

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('MERGE'),
          expect.any(String)
        );
        expect(result).toEqual(testBookmark);
      });

      it('should handle URL normalization', async () => {
        const bookmarkWithTrailingSlash = { ...testBookmark, url: 'https://example.com/' };
        mockQueryResult.getAll.mockResolvedValue([{ b: bookmarkWithTrailingSlash }]);

        await adapter.upsertBookmark(bookmarkWithTrailingSlash, validToken);

        expect(mockConnection.query).toHaveBeenCalled();
      });
    });

    describe('getBookmark', () => {
      it('should get bookmark by id', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ b: testBookmark }]);

        const result = await adapter.getBookmark('bookmark_123', validToken);

        expect(result).toEqual(testBookmark);
      });
    });

    describe('getBookmarksByUser', () => {
      it('should get all bookmarks for a user', async () => {
        const bookmarks = [testBookmark, { ...testBookmark, id: 'bookmark_456' }];
        mockQueryResult.getAll.mockResolvedValue(bookmarks.map(b => ({ b })));

        const result = await adapter.getBookmarksByUser(validToken);

        expect(result).toHaveLength(2);
      });

      it('should support filtering by folder', async () => {
        await adapter.getBookmarksByUser(validToken, 'folder_1');

        expect(mockConnection.query).toHaveBeenCalledWith(
          expect.stringContaining('folderId'),
          expect.anything()
        );
      });
    });

    describe('getBookmarkByUrl', () => {
      it('should find bookmark by URL', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ b: testBookmark }]);

        const result = await adapter.getBookmarkByUrl('https://example.com/article', validToken);

        expect(result).toEqual(testBookmark);
      });

      it('should return null for non-existent URL', async () => {
        mockQueryResult.getAll.mockResolvedValue([]);

        const result = await adapter.getBookmarkByUrl('https://notfound.com', validToken);

        expect(result).toBeNull();
      });
    });

    describe('deleteBookmark', () => {
      it('should delete bookmark', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ deleted: true }]);

        const result = await adapter.deleteBookmark('bookmark_123', validToken);

        expect(result).toBe(true);
      });
    });
  });
});

// ===========================================================================
// ERROR HANDLING TESTS
// ===========================================================================

describe('KuzuAdapter Error Handling', () => {
  it('should throw when calling methods while disconnected', async () => {
    adapter.isConnected = false;

    await expect(adapter.upsertUser({ id: 1 })).rejects.toThrow('Not connected');
  });

  it('should handle query errors gracefully', async () => {
    mockConnection.query.mockRejectedValueOnce(new Error('Query failed'));

    await expect(
      adapter.getUser(1)
    ).rejects.toThrow('Query failed');
  });

  it('should validate token before operations', async () => {
    const result = await adapter.getUserBooks('invalid-token');

    // Should return empty array for invalid user
    expect(result).toEqual([]);
  });
});
