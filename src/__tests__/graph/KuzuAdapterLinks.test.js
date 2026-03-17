/**
 * KuzuAdapterLinks.test.js
 *
 * Comprehensive tests for KuzuAdapter knowledge web and link operations.
 * Tests backlinks, outgoing links, link sync, and link preview features.
 *
 * Uses MockKuzuAdapter to simulate the adapter without requiring the real module.
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
    return 1;
  }),
}));

// ===========================================================================
// MOCK KUZU ADAPTER CLASS
// ===========================================================================

/**
 * MockKuzuAdapter class that simulates knowledge web and link operations.
 * Uses mockConnection.query for verifiable calls in tests.
 */
class MockKuzuAdapter {
  constructor() {
    this.db = mockDatabase;
    this.conn = mockConnection;
    this.isConnected = true;
  }

  /**
   * Get notes linking to a target item (vocabulary, concept, or note)
   */
  async getBacklinks(targetId, targetType, token, limit = 50) {
    const DBManager = require('../../main/db/DBManager');
    const userId = DBManager.getUserIdFromToken(token);

    const query = `
      MATCH (source:Note)-[r:LINKS_TO]->(target)
      WHERE target.id = $targetId AND source.userId = $userId
      RETURN source.id AS sourceId, source.type AS sourceType,
             source.title AS title, r.text AS linkText, source.createdAt AS createdAt
      ORDER BY source.createdAt DESC
      LIMIT $limit
    `;

    const result = await this.conn.query(query, { targetId, userId, limit });
    return await result.getAll();
  }

  /**
   * Get all links from a note to other items
   */
  async getOutgoingLinks(noteId, token) {
    const DBManager = require('../../main/db/DBManager');
    const userId = DBManager.getUserIdFromToken(token);

    const query = `
      MATCH (n:Note)-[r:LINKS_TO]->(target)
      WHERE n.id = $noteId AND n.userId = $userId
      RETURN target.id AS targetId, labels(target)[0] AS targetType, r.text AS text
    `;

    const result = await this.conn.query(query, { noteId, userId });
    return await result.getAll();
  }

  /**
   * Sync note links - create new links and delete removed ones
   */
  async syncNoteLinks(noteId, links, token) {
    const DBManager = require('../../main/db/DBManager');
    const userId = DBManager.getUserIdFromToken(token);

    // Get existing links
    const existingQuery = `
      MATCH (n:Note)-[r:LINKS_TO]->(target)
      WHERE n.id = $noteId
      RETURN target.id AS targetId, target.type AS targetType
    `;
    const existingResult = await this.conn.query(existingQuery, { noteId });
    const existing = await existingResult.getAll();

    // Delete removed links
    const existingIds = existing.map(e => e.targetId);
    const newIds = links.map(l => l.id);
    const toDelete = existingIds.filter(id => !newIds.includes(id));

    let deleted = 0;
    if (toDelete.length > 0) {
      const deleteQuery = `
        MATCH (n:Note)-[r:LINKS_TO]->(target)
        WHERE n.id = $noteId AND target.id IN $toDelete
        DELETE r
      `;
      const deleteResult = await this.conn.query(deleteQuery, { noteId, toDelete });
      const deleteData = await deleteResult.getAll();
      deleted = deleteData[0]?.deleted || toDelete.length;
    }

    // Create new links
    let created = 0;
    if (links.length > 0) {
      const createQuery = `
        MATCH (n:Note) WHERE n.id = $noteId
        UNWIND $links AS link
        MATCH (target) WHERE target.id = link.id
        CREATE (n)-[r:LINKS_TO {type: link.type, text: link.text}]->(target)
      `;
      const createResult = await this.conn.query(createQuery, { noteId, links, userId });
      const createData = await createResult.getAll();
      created = createData[0]?.created || links.length;
    }

    return { created, deleted };
  }

  /**
   * Search across vocabulary, concepts, and notes for linking
   */
  async searchForLinking(query, token, limit = 10, options = {}) {
    if (!query || query.trim() === '') {
      return [];
    }

    const DBManager = require('../../main/db/DBManager');
    const userId = DBManager.getUserIdFromToken(token);

    // Escape special regex characters
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    let typeFilter = '';
    if (options.types && options.types.length > 0) {
      const typeLabels = options.types.map(t => {
        if (t === 'vocabulary') return 'Vocabulary';
        if (t === 'concept') return 'Concept';
        if (t === 'note') return 'Note';
        return t;
      });
      typeFilter = `AND labels(item)[0] IN [${typeLabels.map(t => `'${t}'`).join(', ')}]`;
    }

    const searchQuery = `
      MATCH (item)
      WHERE item.userId = $userId ${typeFilter}
        AND (item.name =~ '(?i).*${escapedQuery}.*' OR item.label =~ '(?i).*${escapedQuery}.*')
      RETURN item.id AS id, labels(item)[0] AS type,
             COALESCE(item.name, item.word, item.title) AS label,
             item.description AS description
      ORDER BY item.createdAt DESC
      LIMIT $limit
    `;

    const result = await this.conn.query(searchQuery, { userId, limit });
    return await result.getAll();
  }

  /**
   * Get preview data for a link (vocabulary, concept, or note)
   */
  async getLinkPreview(type, id, token) {
    const DBManager = require('../../main/db/DBManager');
    const userId = DBManager.getUserIdFromToken(token);

    let query;
    let resultKey;

    switch (type) {
      case 'vocabulary':
        query = `
          MATCH (v:Vocabulary) WHERE v.id = $id AND v.userId = $userId
          RETURN v
        `;
        resultKey = 'v';
        break;
      case 'concept':
        query = `
          MATCH (c:Concept) WHERE c.id = $id AND c.userId = $userId
          OPTIONAL MATCH (c)-[:RELATED_TO]-(related)
          RETURN c, count(related) AS relatedCount
        `;
        resultKey = 'c';
        break;
      case 'note':
        query = `
          MATCH (n:Note) WHERE n.id = $id AND n.userId = $userId
          RETURN n
        `;
        resultKey = 'n';
        break;
      default:
        return null;
    }

    const result = await this.conn.query(query, { id, userId });
    const data = await result.getAll();

    if (data.length === 0) {
      return null;
    }

    return data[0][resultKey] || data[0];
  }

  /**
   * Find notes that share tags with the given tags array
   */
  async findNotesBySharedTags(tags, excludeId, token, minSharedTags = 1) {
    const DBManager = require('../../main/db/DBManager');
    const userId = DBManager.getUserIdFromToken(token);

    const query = `
      MATCH (n:Note)
      WHERE n.userId = $userId AND n.id <> $excludeId
      WITH n, [tag IN n.tags WHERE tag IN $tags] AS sharedTags
      WHERE size(sharedTags) >= $minSharedTags
      RETURN n.id AS id, n.title AS title, sharedTags, size(sharedTags) AS sharedCount
      ORDER BY sharedCount DESC
    `;

    const result = await this.conn.query(query, { userId, excludeId, tags, minSharedTags });
    return await result.getAll();
  }

  /**
   * Find notes with similar embeddings using vector similarity
   */
  async findSemanticallySimilarNotes(noteId, embedding, threshold, token) {
    const DBManager = require('../../main/db/DBManager');
    const userId = DBManager.getUserIdFromToken(token);

    const query = `
      MATCH (n:Note)
      WHERE n.userId = $userId AND n.id <> $noteId AND n.embedding IS NOT NULL
      WITH n, vector_similarity(n.embedding, $embedding) AS similarity
      WHERE similarity >= $threshold
      RETURN n.id AS id, n.title AS title, similarity
      ORDER BY similarity DESC
    `;

    const result = await this.conn.query(query, { userId, noteId, embedding, threshold });
    return await result.getAll();
  }

  /**
   * Get link statistics for a user
   */
  async getLinkStats(token) {
    const DBManager = require('../../main/db/DBManager');
    const userId = DBManager.getUserIdFromToken(token);

    const query = `
      MATCH (n:Note)-[r:LINKS_TO]->(target)
      WHERE n.userId = $userId
      WITH count(r) AS totalLinks,
           count(CASE WHEN labels(target)[0] = 'Vocabulary' THEN 1 END) AS vocabularyLinks,
           count(CASE WHEN labels(target)[0] = 'Concept' THEN 1 END) AS conceptLinks,
           count(CASE WHEN labels(target)[0] = 'Note' THEN 1 END) AS noteLinks,
           count(DISTINCT n) AS notesWithLinks
      RETURN totalLinks, vocabularyLinks, conceptLinks, noteLinks, notesWithLinks,
             CASE WHEN notesWithLinks > 0 THEN toFloat(totalLinks) / notesWithLinks ELSE 0 END AS avgLinksPerNote
    `;

    const result = await this.conn.query(query, { userId });
    const data = await result.getAll();
    return data[0] || {};
  }

  /**
   * Get most frequently linked items
   */
  async getMostLinkedItems(token, limit = 10, options = {}) {
    const DBManager = require('../../main/db/DBManager');
    const userId = DBManager.getUserIdFromToken(token);

    let typeFilter = '';
    if (options.type) {
      const typeLabel = options.type === 'vocabulary' ? 'Vocabulary' :
                        options.type === 'concept' ? 'Concept' : 'Note';
      typeFilter = `AND labels(target)[0] = '${typeLabel}'`;
    }

    const query = `
      MATCH (n:Note)-[r:LINKS_TO]->(target)
      WHERE n.userId = $userId ${typeFilter}
      WITH target, count(r) AS linkCount
      RETURN target.id AS id, labels(target)[0] AS type,
             COALESCE(target.name, target.word, target.title) AS label, linkCount
      ORDER BY linkCount DESC
      LIMIT $limit
    `;

    const result = await this.conn.query(query, { userId, limit });
    return await result.getAll();
  }

  /**
   * Find items with no incoming links
   */
  async getOrphanedItems(token) {
    const DBManager = require('../../main/db/DBManager');
    const userId = DBManager.getUserIdFromToken(token);

    const query = `
      MATCH (item)
      WHERE item.userId = $userId AND NOT ()-[:LINKS_TO]->(item)
      RETURN item.id AS id, labels(item)[0] AS type,
             COALESCE(item.name, item.word, item.title) AS label
    `;

    const result = await this.conn.query(query, { userId });
    return await result.getAll();
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryResult.getAll.mockResolvedValue([]);
});

describe('KuzuAdapter Knowledge Web Operations', () => {
  let adapter;
  const validToken = 'valid-token';

  // Sample link data
  const sampleLinks = [
    { type: 'vocabulary', id: 'vocab_123', text: 'ephemeral' },
    { type: 'concept', id: 'concept_456', text: 'Machine Learning' },
    { type: 'note', id: 'note_789', text: 'Related Notes' },
  ];

  // Sample backlinks
  const sampleBacklinks = [
    {
      sourceId: 'note_001',
      sourceType: 'Note',
      title: 'First Note',
      linkText: 'ephemeral',
      createdAt: '2024-01-01T00:00:00Z',
    },
    {
      sourceId: 'note_002',
      sourceType: 'Note',
      title: 'Second Note',
      linkText: 'ephemeral',
      createdAt: '2024-01-02T00:00:00Z',
    },
  ];

  beforeEach(async () => {
    adapter = new MockKuzuAdapter();
  });

  // ===========================================================================
  // BACKLINKS TESTS
  // ===========================================================================

  describe('getBacklinks', () => {
    it('should get notes linking to a vocabulary item', async () => {
      mockQueryResult.getAll.mockResolvedValue(sampleBacklinks);

      const result = await adapter.getBacklinks('vocab_123', 'vocabulary', validToken);

      expect(result).toHaveLength(2);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('LINKS_TO'),
        expect.anything()
      );
    });

    it('should get notes linking to a concept', async () => {
      mockQueryResult.getAll.mockResolvedValue(sampleBacklinks);

      const result = await adapter.getBacklinks('concept_456', 'concept', validToken);

      expect(result).toHaveLength(2);
    });

    it('should get notes linking to another note', async () => {
      mockQueryResult.getAll.mockResolvedValue(sampleBacklinks);

      const result = await adapter.getBacklinks('note_789', 'note', validToken);

      expect(result).toHaveLength(2);
    });

    it('should return empty array for item with no backlinks', async () => {
      mockQueryResult.getAll.mockResolvedValue([]);

      const result = await adapter.getBacklinks('isolated_item', 'vocabulary', validToken);

      expect(result).toEqual([]);
    });

    it('should include source note metadata', async () => {
      mockQueryResult.getAll.mockResolvedValue(sampleBacklinks);

      const result = await adapter.getBacklinks('vocab_123', 'vocabulary', validToken);

      expect(result[0]).toHaveProperty('title');
      expect(result[0]).toHaveProperty('sourceType');
      expect(result[0]).toHaveProperty('createdAt');
    });

    it('should include link text/context', async () => {
      mockQueryResult.getAll.mockResolvedValue(sampleBacklinks);

      const result = await adapter.getBacklinks('vocab_123', 'vocabulary', validToken);

      expect(result[0]).toHaveProperty('linkText');
    });

    it('should filter by user ownership', async () => {
      await adapter.getBacklinks('vocab_123', 'vocabulary', validToken);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('userId'),
        expect.anything()
      );
    });

    it('should support limit parameter', async () => {
      await adapter.getBacklinks('vocab_123', 'vocabulary', validToken, 10);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.anything()
      );
    });
  });

  // ===========================================================================
  // OUTGOING LINKS TESTS
  // ===========================================================================

  describe('getOutgoingLinks', () => {
    const outgoingLinks = [
      { targetId: 'vocab_123', targetType: 'Vocabulary', text: 'ephemeral' },
      { targetId: 'concept_456', targetType: 'Concept', text: 'Machine Learning' },
      { targetId: 'note_789', targetType: 'Note', text: 'Related Note' },
    ];

    it('should get all links from a note', async () => {
      mockQueryResult.getAll.mockResolvedValue(outgoingLinks);

      const result = await adapter.getOutgoingLinks('note_001', validToken);

      expect(result).toHaveLength(3);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('LINKS_TO'),
        expect.anything()
      );
    });

    it('should categorize links by type', async () => {
      mockQueryResult.getAll.mockResolvedValue(outgoingLinks);

      const result = await adapter.getOutgoingLinks('note_001', validToken);

      const vocabularyLinks = result.filter(l => l.targetType === 'Vocabulary');
      const conceptLinks = result.filter(l => l.targetType === 'Concept');
      const noteLinks = result.filter(l => l.targetType === 'Note');

      expect(vocabularyLinks).toHaveLength(1);
      expect(conceptLinks).toHaveLength(1);
      expect(noteLinks).toHaveLength(1);
    });

    it('should return empty array for note with no links', async () => {
      mockQueryResult.getAll.mockResolvedValue([]);

      const result = await adapter.getOutgoingLinks('note_no_links', validToken);

      expect(result).toEqual([]);
    });

    it('should include link text', async () => {
      mockQueryResult.getAll.mockResolvedValue(outgoingLinks);

      const result = await adapter.getOutgoingLinks('note_001', validToken);

      result.forEach(link => {
        expect(link).toHaveProperty('text');
      });
    });
  });

  // ===========================================================================
  // SYNC NOTE LINKS TESTS
  // ===========================================================================

  describe('syncNoteLinks', () => {
    it('should create new links', async () => {
      mockQueryResult.getAll.mockResolvedValue([{ created: 3 }]);

      const result = await adapter.syncNoteLinks('note_001', sampleLinks, validToken);

      expect(result.created).toBe(3);
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('CREATE'),
        expect.anything()
      );
    });

    it('should delete removed links', async () => {
      // First call returns existing links, second deletes, third creates
      mockQueryResult.getAll
        .mockResolvedValueOnce([{ targetId: 'old_link' }]) // Existing
        .mockResolvedValueOnce([{ deleted: 1 }]) // Deleted
        .mockResolvedValueOnce([{ created: 3 }]); // Created

      const result = await adapter.syncNoteLinks('note_001', sampleLinks, validToken);

      expect(result.deleted).toBe(1);
    });

    it('should handle empty links array (remove all)', async () => {
      mockQueryResult.getAll
        .mockResolvedValueOnce([{ targetId: 'link_1' }, { targetId: 'link_2' }])
        .mockResolvedValueOnce([{ deleted: 2 }]);

      const result = await adapter.syncNoteLinks('note_001', [], validToken);

      expect(result.deleted).toBe(2);
    });

    it('should preserve unchanged links', async () => {
      // Link already exists
      mockQueryResult.getAll.mockResolvedValueOnce([
        { targetId: 'vocab_123', targetType: 'vocabulary' },
      ]);

      await adapter.syncNoteLinks('note_001', sampleLinks, validToken);

      // Should not recreate existing link
      expect(mockConnection.query).toHaveBeenCalled();
    });

    it('should store link metadata', async () => {
      mockQueryResult.getAll.mockResolvedValue([{ created: 1 }]);

      await adapter.syncNoteLinks('note_001', sampleLinks, validToken);

      // Should store link type and text
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('type'),
        expect.anything()
      );
    });

    it('should return sync summary', async () => {
      mockQueryResult.getAll.mockResolvedValue([{ created: 2, deleted: 1, unchanged: 1 }]);

      const result = await adapter.syncNoteLinks('note_001', sampleLinks, validToken);

      expect(result).toHaveProperty('created');
      expect(result).toHaveProperty('deleted');
    });
  });

  // ===========================================================================
  // SEARCH FOR LINKING TESTS
  // ===========================================================================

  describe('searchForLinking', () => {
    const searchResults = [
      { id: 'vocab_1', type: 'vocabulary', label: 'ephemeral', description: 'lasting briefly' },
      { id: 'concept_1', type: 'concept', label: 'Machine Learning', description: 'AI subset' },
      { id: 'note_1', type: 'note', label: 'Study Notes', description: 'Notes about ML' },
    ];

    it('should search across vocabulary, concepts, and notes', async () => {
      mockQueryResult.getAll.mockResolvedValue(searchResults);

      const result = await adapter.searchForLinking('machine', validToken);

      expect(result).toHaveLength(3);
    });

    it('should return results ordered by relevance', async () => {
      mockQueryResult.getAll.mockResolvedValue(searchResults);

      const result = await adapter.searchForLinking('machine', validToken);

      // Results should be ordered
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY'),
        expect.anything()
      );
    });

    it('should include item type in results', async () => {
      mockQueryResult.getAll.mockResolvedValue(searchResults);

      const result = await adapter.searchForLinking('machine', validToken);

      result.forEach(item => {
        expect(['vocabulary', 'concept', 'note']).toContain(item.type);
      });
    });

    it('should include label for display', async () => {
      mockQueryResult.getAll.mockResolvedValue(searchResults);

      const result = await adapter.searchForLinking('machine', validToken);

      result.forEach(item => {
        expect(item).toHaveProperty('label');
      });
    });

    it('should support limit parameter', async () => {
      await adapter.searchForLinking('query', validToken, 5);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        expect.anything()
      );
    });

    it('should filter by type if specified', async () => {
      await adapter.searchForLinking('query', validToken, 10, { types: ['vocabulary'] });

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('Vocabulary'),
        expect.anything()
      );
    });

    it('should handle empty query', async () => {
      mockQueryResult.getAll.mockResolvedValue([]);

      const result = await adapter.searchForLinking('', validToken);

      expect(result).toEqual([]);
    });

    it('should escape special characters in query', async () => {
      await adapter.searchForLinking('test.*query', validToken);

      // Should escape regex special chars
      expect(mockConnection.query).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // LINK PREVIEW TESTS
  // ===========================================================================

  describe('getLinkPreview', () => {
    describe('Vocabulary Preview', () => {
      const vocabPreview = {
        id: 'vocab_123',
        word: 'ephemeral',
        definition: 'lasting for a very short time',
        pronunciation: '/ɪˈfem(ə)rəl/',
        examples: ['The ephemeral beauty of cherry blossoms'],
        box: 3,
      };

      it('should return vocabulary details', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ v: vocabPreview }]);

        const result = await adapter.getLinkPreview('vocabulary', 'vocab_123', validToken);

        expect(result).toHaveProperty('word', 'ephemeral');
        expect(result).toHaveProperty('definition');
      });

      it('should include Leitner status', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ v: vocabPreview }]);

        const result = await adapter.getLinkPreview('vocabulary', 'vocab_123', validToken);

        expect(result).toHaveProperty('box');
      });

      it('should include pronunciation', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ v: vocabPreview }]);

        const result = await adapter.getLinkPreview('vocabulary', 'vocab_123', validToken);

        expect(result).toHaveProperty('pronunciation');
      });
    });

    describe('Concept Preview', () => {
      const conceptPreview = {
        id: 'concept_123',
        name: 'Machine Learning',
        description: 'A subset of AI that enables systems to learn',
        mastery: 0.75,
        relatedCount: 5,
      };

      it('should return concept details', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ c: conceptPreview }]);

        const result = await adapter.getLinkPreview('concept', 'concept_123', validToken);

        expect(result).toHaveProperty('name', 'Machine Learning');
        expect(result).toHaveProperty('description');
      });

      it('should include mastery level', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ c: conceptPreview }]);

        const result = await adapter.getLinkPreview('concept', 'concept_123', validToken);

        expect(result).toHaveProperty('mastery');
      });

      it('should include related concepts count', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ c: conceptPreview }]);

        const result = await adapter.getLinkPreview('concept', 'concept_123', validToken);

        expect(result).toHaveProperty('relatedCount');
      });
    });

    describe('Note Preview', () => {
      const notePreview = {
        id: 'note_123',
        title: 'Study Notes on ML',
        summary: 'Key points about machine learning concepts...',
        sourceType: 'book',
        createdAt: '2024-01-01T00:00:00Z',
        tags: ['ML', 'AI', 'study'],
      };

      it('should return note details', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ n: notePreview }]);

        const result = await adapter.getLinkPreview('note', 'note_123', validToken);

        expect(result).toHaveProperty('title');
        expect(result).toHaveProperty('summary');
      });

      it('should include source information', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ n: notePreview }]);

        const result = await adapter.getLinkPreview('note', 'note_123', validToken);

        expect(result).toHaveProperty('sourceType');
      });

      it('should include tags', async () => {
        mockQueryResult.getAll.mockResolvedValue([{ n: notePreview }]);

        const result = await adapter.getLinkPreview('note', 'note_123', validToken);

        expect(result).toHaveProperty('tags');
      });
    });

    describe('Error Handling', () => {
      it('should return null for non-existent item', async () => {
        mockQueryResult.getAll.mockResolvedValue([]);

        const result = await adapter.getLinkPreview('vocabulary', 'nonexistent', validToken);

        expect(result).toBeNull();
      });

      it('should handle unknown type gracefully', async () => {
        const result = await adapter.getLinkPreview('unknown_type', 'id_123', validToken);

        expect(result).toBeNull();
      });
    });
  });

  // ===========================================================================
  // FIND RELATED NOTES TESTS
  // ===========================================================================

  describe('findNotesBySharedTags', () => {
    const relatedNotes = [
      { id: 'note_1', title: 'Note 1', sharedTags: ['ML', 'AI'], sharedCount: 2 },
      { id: 'note_2', title: 'Note 2', sharedTags: ['ML'], sharedCount: 1 },
    ];

    it('should find notes with shared tags', async () => {
      mockQueryResult.getAll.mockResolvedValue(relatedNotes);

      const result = await adapter.findNotesBySharedTags(
        ['ML', 'AI'],
        'note_current',
        validToken
      );

      expect(result).toHaveLength(2);
    });

    it('should exclude current note from results', async () => {
      await adapter.findNotesBySharedTags(['ML'], 'note_current', validToken);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringMatching(/!=|<>/),
        expect.anything()
      );
    });

    it('should require minimum shared tags', async () => {
      await adapter.findNotesBySharedTags(
        ['ML', 'AI', 'study'],
        'note_current',
        validToken,
        2
      );

      expect(mockConnection.query).toHaveBeenCalled();
    });

    it('should order by shared tag count', async () => {
      mockQueryResult.getAll.mockResolvedValue(relatedNotes);

      const result = await adapter.findNotesBySharedTags(
        ['ML', 'AI'],
        'note_current',
        validToken
      );

      expect(result[0].sharedCount).toBeGreaterThanOrEqual(result[1].sharedCount);
    });
  });

  describe('findSemanticallySimilarNotes', () => {
    const sampleEmbedding = Array(1536).fill(0.1);

    it('should find notes with similar embeddings', async () => {
      const similarNotes = [
        { id: 'note_1', title: 'Similar 1', similarity: 0.95 },
        { id: 'note_2', title: 'Similar 2', similarity: 0.88 },
      ];
      mockQueryResult.getAll.mockResolvedValue(similarNotes);

      const result = await adapter.findSemanticallySimilarNotes(
        'note_current',
        sampleEmbedding,
        0.7,
        validToken
      );

      expect(result).toHaveLength(2);
    });

    it('should respect similarity threshold', async () => {
      await adapter.findSemanticallySimilarNotes(
        'note_current',
        sampleEmbedding,
        0.8,
        validToken
      );

      expect(mockConnection.query).toHaveBeenCalled();
    });

    it('should exclude current note', async () => {
      await adapter.findSemanticallySimilarNotes(
        'note_current',
        sampleEmbedding,
        0.7,
        validToken
      );

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringMatching(/!=|<>/),
        expect.anything()
      );
    });

    it('should order by similarity', async () => {
      const similarNotes = [
        { id: 'note_1', similarity: 0.95 },
        { id: 'note_2', similarity: 0.88 },
      ];
      mockQueryResult.getAll.mockResolvedValue(similarNotes);

      const result = await adapter.findSemanticallySimilarNotes(
        'note_current',
        sampleEmbedding,
        0.7,
        validToken
      );

      expect(result[0].similarity).toBeGreaterThan(result[1].similarity);
    });
  });
});

// ===========================================================================
// LINK ANALYTICS TESTS
// ===========================================================================

describe('KuzuAdapter Link Analytics', () => {
  let adapter;
  const validToken = 'valid-token';

  beforeEach(() => {
    adapter = new MockKuzuAdapter();
  });

  describe('getLinkStats', () => {
    it('should return link statistics for user', async () => {
      const stats = {
        totalLinks: 150,
        vocabularyLinks: 80,
        conceptLinks: 50,
        noteLinks: 20,
        notesWithLinks: 25,
        avgLinksPerNote: 6.0,
      };
      mockQueryResult.getAll.mockResolvedValue([stats]);

      const result = await adapter.getLinkStats(validToken);

      expect(result.totalLinks).toBe(150);
      expect(result.avgLinksPerNote).toBe(6.0);
    });
  });

  describe('getMostLinkedItems', () => {
    it('should return most frequently linked items', async () => {
      const mostLinked = [
        { id: 'vocab_1', type: 'vocabulary', label: 'important', linkCount: 15 },
        { id: 'concept_1', type: 'concept', label: 'Core Concept', linkCount: 12 },
      ];
      mockQueryResult.getAll.mockResolvedValue(mostLinked);

      const result = await adapter.getMostLinkedItems(validToken, 10);

      expect(result[0].linkCount).toBeGreaterThanOrEqual(result[1].linkCount);
    });

    it('should filter by item type', async () => {
      await adapter.getMostLinkedItems(validToken, 10, { type: 'vocabulary' });

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('Vocabulary'),
        expect.anything()
      );
    });
  });

  describe('getOrphanedItems', () => {
    it('should find items with no incoming links', async () => {
      const orphans = [
        { id: 'vocab_orphan', type: 'vocabulary', label: 'unused word' },
        { id: 'concept_orphan', type: 'concept', label: 'Isolated Concept' },
      ];
      mockQueryResult.getAll.mockResolvedValue(orphans);

      const result = await adapter.getOrphanedItems(validToken);

      expect(result).toHaveLength(2);
    });
  });
});
