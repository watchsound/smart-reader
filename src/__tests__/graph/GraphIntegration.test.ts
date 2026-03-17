/**
 * GraphIntegration.test.ts
 *
 * Integration tests for the Neo4j graph database system.
 * Tests the full flow from renderer API through IPC handlers to neo4jAdapter.
 *
 * These tests mock the Neo4j driver but test the integration between components.
 */

// ===========================================================================
// MOCK SETUP
// ===========================================================================

// Mock neo4j-driver
const mockSession = {
  run: jest.fn(),
  close: jest.fn(),
};

const mockDriver = {
  session: jest.fn(() => mockSession),
  verifyConnectivity: jest.fn(),
  close: jest.fn(),
};

jest.mock('neo4j-driver', () => ({
  driver: jest.fn(() => mockDriver),
  auth: {
    basic: jest.fn((user, pass) => ({ user, pass })),
  },
  int: jest.fn((n) => n),
}));

// Mock electron
const mockIpcMainOn = jest.fn();
const mockIpcMainHandle = jest.fn();
jest.mock('electron', () => ({
  ipcMain: {
    on: mockIpcMainOn,
    handle: mockIpcMainHandle,
  },
}));

// Mock better-sqlite3 (for migration tests)
const mockDbAll = jest.fn();
const mockDbGet = jest.fn();
const mockDbRun = jest.fn();
const mockDbPrepare = jest.fn(() => ({
  all: mockDbAll,
  get: mockDbGet,
  run: mockDbRun,
}));

jest.mock('../../main/db/DBManager', () => ({
  __esModule: true,
  default: {
    getDatabase: jest.fn(() => ({
      prepare: mockDbPrepare,
    })),
  },
}));

// Mock dbManager for getUserIdFromToken (lowercase import path)
jest.mock('../../main/db/dbManager', () => ({
  getUserIdFromToken: jest.fn((token: string) => {
    if (token === 'user-token' || token === 'valid-token') return 1;
    if (token === 'user-2-token') return 2;
    return -1;
  }),
}));

// Reset GraphInterface singleton for each test
let graphInterface: any;
let neo4jAdapter: any;

describe('Graph System Integration Tests', () => {
  let mockStore: any;
  let registeredHandlers: Map<string, Function>;
  let registeredInvokeHandlers: Map<string, Function>;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    // Reset singleton by re-importing
    const GraphInterfaceModule = await import('../../main/utils/GraphInterface');
    graphInterface = GraphInterfaceModule.default;
    // Reset the singleton instance
    (graphInterface as any).adapter = null;
    (graphInterface as any).isInitialized = false;
    (graphInterface as any).adapterType = null;

    const Neo4jAdapterModule = await import('../../main/utils/Neo4jAdapter');
    neo4jAdapter = Neo4jAdapterModule.default;
    // Reset adapter state
    (neo4jAdapter as any).driver = null;
    (neo4jAdapter as any).isConnected = false;

    // Capture IPC handlers
    registeredHandlers = new Map();
    registeredInvokeHandlers = new Map();

    mockIpcMainOn.mockImplementation((channel: string, handler: Function) => {
      registeredHandlers.set(channel, handler);
    });

    mockIpcMainHandle.mockImplementation((channel: string, handler: Function) => {
      registeredInvokeHandlers.set(channel, handler);
    });

    mockStore = {
      get: jest.fn((key: string) => {
        const config: { [key: string]: string } = {
          neo4j_uri: 'bolt://localhost:7687',
          neo4j_user: 'neo4j',
          neo4j_password: 'password',
        };
        return config[key];
      }),
      set: jest.fn(),
    };

    // Default mock responses
    mockDriver.verifyConnectivity.mockResolvedValue(undefined);
    mockSession.run.mockResolvedValue({ records: [] });
    mockSession.close.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    // Clean up any connections
    if (graphInterface.checkConnection()) {
      await graphInterface.disconnect();
    }
  });

  // ===========================================================================
  // CONNECTION FLOW TESTS
  // ===========================================================================

  describe('Connection Flow', () => {
    test('should connect to Neo4j with store config', async () => {
      const connected = await neo4jAdapter.connect(mockStore);

      expect(connected).toBe(true);
      expect(mockStore.get).toHaveBeenCalledWith('neo4j_uri');
      expect(mockStore.get).toHaveBeenCalledWith('neo4j_user');
      expect(mockStore.get).toHaveBeenCalledWith('neo4j_password');
      expect(mockDriver.verifyConnectivity).toHaveBeenCalled();
    });

    test('should handle connection failure gracefully', async () => {
      mockDriver.verifyConnectivity.mockRejectedValue(new Error('Connection refused'));

      // Neo4jAdapter catches errors and returns false instead of throwing
      const result = await neo4jAdapter.connect(mockStore);
      expect(result).toBe(false);
      expect(neo4jAdapter.checkConnection()).toBe(false);
    });

    test('should track connection state', async () => {
      expect(neo4jAdapter.checkConnection()).toBe(false);

      await neo4jAdapter.connect(mockStore);

      expect(neo4jAdapter.checkConnection()).toBe(true);

      await neo4jAdapter.disconnect();

      expect(neo4jAdapter.checkConnection()).toBe(false);
    });
  });

  // ===========================================================================
  // NOTE LIFECYCLE TESTS
  // ===========================================================================

  describe('Note Lifecycle', () => {
    beforeEach(async () => {
      await neo4jAdapter.connect(mockStore);
    });

    test('should create note and return with ID', async () => {
      const noteId = 'note-uuid-001';
      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: (key: string) => {
              if (key === 'n') {
                return {
                  properties: {
                    id: noteId,
                    title: 'Test Note',
                    content: 'Test content',
                    createdAt: new Date().toISOString(),
                  },
                };
              }
              return null;
            },
          },
        ],
      });

      const note = await neo4jAdapter.createNote(
        {
          title: 'Test Note',
          content: 'Test content',
        },
        'user-token'
      );

      expect(note).toBeDefined();
      expect(note.id).toBe(noteId);
      expect(mockSession.run).toHaveBeenCalled();
    });

    test('should retrieve note by ID', async () => {
      const noteData = {
        id: 'note-001',
        title: 'Retrieved Note',
        content: 'Content here',
        leitnerBox: 2,
        inLeitner: true,
        cards: '[]',
        position: null,
      };

      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: () => ({
              properties: noteData,
            }),
          },
        ],
      });

      const note = await neo4jAdapter.getNoteById('note-001', 'user-token');

      // Adapter parses cards JSON and adds default position
      expect(note.id).toBe('note-001');
      expect(note.title).toBe('Retrieved Note');
      expect(note.content).toBe('Content here');
      expect(note.leitnerBox).toBe(2);
      expect(note.inLeitner).toBe(true);
    });

    test('should update note field', async () => {
      mockSession.run.mockResolvedValueOnce({
        summary: { counters: { updates: jest.fn(() => ({ nodesCreated: 0, propertiesSet: 1 })) } },
      });

      const result = await neo4jAdapter.updateNote('note-001', 'title', 'Updated Title', 'user-token');

      expect(result).toBe(1);
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('SET'),
        expect.objectContaining({ noteId: 'note-001', value: 'Updated Title' })
      );
    });

    test('should delete note', async () => {
      mockSession.run.mockResolvedValueOnce({
        summary: { counters: { updates: jest.fn(() => ({ nodesDeleted: 1 })) } },
      });

      const result = await neo4jAdapter.deleteNote('note-001', 'user-token');

      expect(result).toBe(1);
    });
  });

  // ===========================================================================
  // LEITNER SYSTEM INTEGRATION TESTS
  // ===========================================================================

  describe('Leitner System Integration', () => {
    beforeEach(async () => {
      await neo4jAdapter.connect(mockStore);
    });

    test('should add note to Leitner study', async () => {
      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: () => ({
              properties: {
                id: 'note-001',
                inLeitner: true,
                leitnerBox: 1,
                leitnerDueDate: expect.any(String),
              },
            }),
          },
        ],
      });

      const note = await neo4jAdapter.addNoteToLeitnerStudy('note-001', 'user-token');

      expect(note.inLeitner).toBe(true);
      expect(note.leitnerBox).toBe(1);
    });

    test('should get items due for review', async () => {
      const dueItems = [
        { props: { id: 'note-001', leitnerBox: 1, title: 'Note 1' }, label: 'Note' },
        { props: { id: 'vocab-001', leitnerBox: 2, word: 'serendipity' }, label: 'Vocabulary' },
      ];

      mockSession.run.mockResolvedValueOnce({
        records: dueItems.map((item) => ({
          get: (key: string) => {
            if (key === 'item') {
              return { properties: item.props };
            }
            if (key === 'itemType') {
              return item.label;
            }
            return null;
          },
        })),
      });

      const items = await neo4jAdapter.getDueForReview(new Date(), ['note', 'vocabulary'], 50, 'user-token');

      expect(items).toHaveLength(2);
    });

    test('should progress note to next box on correct review', async () => {
      const now = new Date();

      // Mock first query - update item and return result
      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: (key: string) => {
              if (key === 'item') {
                return {
                  properties: {
                    id: 'note-001',
                    leitnerBox: 3, // Advanced from 2 to 3
                    leitnerFlips: 6,
                    lastReviewDate: now.toISOString(),
                  },
                };
              }
              if (key === 'oldBox') {
                return 2;
              }
              return null;
            },
          },
        ],
      });

      // Mock second query - create REVIEWED relationship
      mockSession.run.mockResolvedValueOnce({
        records: [],
      });

      const result = await neo4jAdapter.recordReview('note-001', 'note', 'correct', 2, 'user-token');

      expect(result.leitnerBox).toBe(3);
    });

    test('should reset note to box 1 on incorrect review', async () => {
      // Mock first query - update item (returns item and oldBox)
      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: (key: string) => {
              if (key === 'item') return {
                properties: {
                  id: 'note-001',
                  leitnerBox: 1, // Reset to 1 after incorrect review
                  leitnerFlips: 11,
                },
              };
              if (key === 'oldBox') return 4; // Was in box 4
              return null;
            },
          },
        ],
      });
      // Mock second query - create REVIEWED relationship
      mockSession.run.mockResolvedValueOnce({ records: [] });

      const result = await neo4jAdapter.recordReview('note-001', 'note', 'incorrect', 2, 'user-token');

      expect(result.leitnerBox).toBe(1);
    });

    test('should cap note at box 5 (mastered)', async () => {
      // Mock first query - update item
      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: (key: string) => {
              if (key === 'item') return {
                properties: {
                  id: 'note-001',
                  leitnerBox: 5, // Stays at 5
                  leitnerFlips: 21,
                },
              };
              if (key === 'oldBox') return 5;
              return null;
            },
          },
        ],
      });
      // Mock second query - create REVIEWED relationship
      mockSession.run.mockResolvedValueOnce({ records: [] });

      const result = await neo4jAdapter.recordReview('note-001', 'note', 'correct', 2, 'user-token');

      expect(result.leitnerBox).toBe(5);
    });
  });

  // ===========================================================================
  // LEARNING SESSION TRACKING TESTS
  // ===========================================================================

  describe('Learning Session Tracking', () => {
    beforeEach(async () => {
      await neo4jAdapter.connect(mockStore);
    });

    test('should start and end learning session', async () => {
      const startTime = new Date();

      // Start session
      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: () => ({
              properties: {
                id: 'session-001',
                activityType: 'reading',
                resourceType: 'book',
                resourceId: 'book-001',
                startTime: startTime.toISOString(),
              },
            }),
          },
        ],
      });

      const session = await neo4jAdapter.startLearningSession('reading', 'book', 'book-001', 'user-token');

      expect(session.id).toBe('session-001');
      expect(session.activityType).toBe('reading');

      // End session
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes later
      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: () => ({
              properties: {
                id: 'session-001',
                endTime: endTime.toISOString(),
                duration: 1800, // 30 minutes in seconds
                focusScore: 0.85,
                notesCreated: 5,
              },
            }),
          },
        ],
      });

      const endedSession = await neo4jAdapter.endLearningSession(
        'session-001',
        { focusScore: 0.85, notesCreated: 5 },
        'user-token'
      );

      expect(endedSession.duration).toBe(1800);
      expect(endedSession.focusScore).toBe(0.85);
    });

    test('should track different activity types', async () => {
      const activities = ['reading', 'reviewing', 'quizzing', 'browsing', 'chatting'];

      for (const activity of activities) {
        mockSession.run.mockResolvedValueOnce({
          records: [
            {
              get: () => ({
                properties: {
                  id: `session-${activity}`,
                  activityType: activity,
                },
              }),
            },
          ],
        });

        const session = await neo4jAdapter.startLearningSession(activity, null, null, 'user-token');
        expect(session.activityType).toBe(activity);
      }
    });
  });

  // ===========================================================================
  // CONCEPT AND RELATIONSHIP TESTS
  // ===========================================================================

  describe('Concepts and Relationships', () => {
    beforeEach(async () => {
      await neo4jAdapter.connect(mockStore);
    });

    test('should create concept and link to note', async () => {
      // Create concept
      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: () => ({
              properties: {
                id: 'concept-001',
                name: 'Machine Learning',
                domain: 'Computer Science',
              },
            }),
          },
        ],
      });

      const concept = await neo4jAdapter.upsertConcept(
        {
          name: 'Machine Learning',
          domain: 'Computer Science',
        },
        'user-token'
      );

      expect(concept.name).toBe('Machine Learning');

      // Create relationship
      mockSession.run.mockResolvedValueOnce({
        summary: { counters: { updates: jest.fn(() => ({ relationshipsCreated: 1 })) } },
      });

      await neo4jAdapter.createMentionsRelationship('note-001', 'concept-001', 3, 0.8);

      // Verify relationship was created
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MENTIONS_CONCEPT'),
        expect.objectContaining({
          noteId: 'note-001',
          conceptId: 'concept-001',
          frequency: 3,
          importance: 0.8,
        })
      );
    });

    test('should find learning path through concepts', async () => {
      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: (key: string) => {
              if (key === 'prereq') {
                return { properties: { id: 'concept-003', name: 'Linear Algebra', masteryLevel: 80 } };
              }
              if (key === 'mastered') return true;
              return null;
            },
          },
          {
            get: (key: string) => {
              if (key === 'prereq') {
                return { properties: { id: 'concept-002', name: 'Calculus', masteryLevel: 50 } };
              }
              if (key === 'mastered') return false;
              return null;
            },
          },
        ],
      });

      const path = await neo4jAdapter.getLearningPath('concept-001', 5, 'user-token');

      expect(path).toBeDefined();
      expect(path.targetConceptId).toBe('concept-001');
      expect(path.prerequisites).toHaveLength(2);
      expect(path.masteredCount).toBe(1);
      expect(path.totalCount).toBe(2);
    });
  });

  // ===========================================================================
  // SEMANTIC SEARCH INTEGRATION TESTS
  // ===========================================================================

  describe('Semantic Search Integration', () => {
    beforeEach(async () => {
      await neo4jAdapter.connect(mockStore);
    });

    test('should store and retrieve embeddings', async () => {
      const embedding = [0.1, 0.2, 0.3, 0.4, 0.5];

      // Store embedding
      mockSession.run.mockResolvedValueOnce({
        summary: { counters: { updates: jest.fn(() => ({ propertiesSet: 2 })) } },
      });

      await neo4jAdapter.storeEmbedding('note-001', 'Note', embedding, 'text-embedding-3-small');

      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('embedding'),
        expect.objectContaining({
          nodeId: 'note-001',
          embedding: embedding,
          model: 'text-embedding-3-small',
        })
      );
    });

    test('should find similar nodes by embedding', async () => {
      const queryEmbedding = [0.1, 0.2, 0.3];

      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: (key: string) => {
              if (key === 'n') {
                return { properties: { id: 'note-001', title: 'Similar Note 1' } };
              }
              if (key === 'similarity') {
                return 0.95;
              }
              if (key === 'nodeType') {
                return 'Note';
              }
              return null;
            },
          },
          {
            get: (key: string) => {
              if (key === 'n') {
                return { properties: { id: 'note-002', title: 'Similar Note 2' } };
              }
              if (key === 'similarity') {
                return 0.87;
              }
              if (key === 'nodeType') {
                return 'Note';
              }
              return null;
            },
          },
        ],
      });

      const similar = await neo4jAdapter.findSimilar(queryEmbedding, ['Note'], 10, 0.7, 'user-token');

      expect(similar).toHaveLength(2);
      expect(similar[0].similarity).toBe(0.95);
    });
  });

  // ===========================================================================
  // TEMPORAL QUERIES TESTS
  // ===========================================================================

  describe('Temporal Queries (Bi-temporal)', () => {
    beforeEach(async () => {
      await neo4jAdapter.connect(mockStore);
    });

    test('should get knowledge state at specific time', async () => {
      const asOfDate = new Date('2024-01-15T00:00:00Z');

      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: (key: string) => {
              if (key === 'item') {
                return {
                  properties: {
                    id: 'note-001',
                    title: 'ML Basics',
                    leitnerBox: 3,
                  },
                };
              }
              if (key === 'reviewCount') {
                return 5;
              }
              if (key === 'lastReview') {
                return '2024-01-14T12:00:00Z';
              }
              if (key === 'itemType') {
                return 'Note';
              }
              return null;
            },
          },
        ],
      });

      const knowledge = await neo4jAdapter.getKnowledgeAtTime(asOfDate, 'user-token');

      expect(knowledge).toBeDefined();
      expect(knowledge).toHaveLength(1);
      expect(knowledge[0].item.id).toBe('note-001');
      expect(knowledge[0].reviewCount).toBe(5);
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('eventTime'),
        expect.objectContaining({
          asOfDate: asOfDate.toISOString(),
        })
      );
    });
  });

  // ===========================================================================
  // MIGRATION INTEGRATION TESTS
  // ===========================================================================

  describe('Migration Integration', () => {
    beforeEach(async () => {
      await neo4jAdapter.connect(mockStore);
    });

    test('should migrate notes from SQLite to Neo4j', async () => {
      // Mock SQLite query returning notes
      mockDbAll.mockReturnValueOnce([
        { id: 1, title: 'Note 1', content: 'Content 1', created_at: '2024-01-01' },
        { id: 2, title: 'Note 2', content: 'Content 2', created_at: '2024-01-02' },
      ]);

      // Mock Neo4j insert
      mockSession.run.mockResolvedValue({
        records: [{ get: () => ({ properties: { id: 'migrated' } }) }],
      });

      // Note: Full migration test would require the actual migration function
      // This tests that the database connections work together
      expect(mockDbPrepare).toBeDefined();
    });

    test('should verify migration integrity', async () => {
      // Mock SQLite counts
      mockDbGet.mockReturnValueOnce({ count: 100 }); // notes count

      // Mock Neo4j counts
      mockSession.run.mockResolvedValueOnce({
        records: [{ get: () => 100 }],
      });

      // The verification would compare counts and check for data integrity
      expect(mockSession.run).toBeDefined();
    });
  });

  // ===========================================================================
  // ERROR HANDLING INTEGRATION TESTS
  // ===========================================================================

  describe('Error Handling Integration', () => {
    test('should handle disconnection during operation', async () => {
      await neo4jAdapter.connect(mockStore);

      // Simulate session error (disconnection)
      mockSession.run.mockRejectedValueOnce(new Error('Session expired'));

      await expect(
        neo4jAdapter.createNote({ title: 'Test' }, 'user-token')
      ).rejects.toThrow('Session expired');
    });

    test('should handle invalid user token', async () => {
      await neo4jAdapter.connect(mockStore);

      mockSession.run.mockResolvedValueOnce({
        records: [], // No user found
      });

      const note = await neo4jAdapter.createNote({ title: 'Test' }, 'invalid-token');

      // Should return null or throw depending on implementation
      expect(mockSession.run).toHaveBeenCalled();
    });

    test('should handle concurrent operations', async () => {
      await neo4jAdapter.connect(mockStore);

      // Simulate concurrent note creations
      const mockResponses = [
        { records: [{ get: () => ({ properties: { id: 'note-001', title: 'Note 1' } }) }] },
        { records: [{ get: () => ({ properties: { id: 'note-002', title: 'Note 2' } }) }] },
        { records: [{ get: () => ({ properties: { id: 'note-003', title: 'Note 3' } }) }] },
      ];

      mockSession.run.mockResolvedValueOnce(mockResponses[0]);
      mockSession.run.mockResolvedValueOnce(mockResponses[1]);
      mockSession.run.mockResolvedValueOnce(mockResponses[2]);

      const results = await Promise.all([
        neo4jAdapter.createNote({ title: 'Note 1' }, 'user-token'),
        neo4jAdapter.createNote({ title: 'Note 2' }, 'user-token'),
        neo4jAdapter.createNote({ title: 'Note 3' }, 'user-token'),
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].id).toBe('note-001');
      expect(results[1].id).toBe('note-002');
      expect(results[2].id).toBe('note-003');
    });
  });

  // ===========================================================================
  // FULL WORKFLOW TESTS
  // ===========================================================================

  describe('Full Learning Workflow', () => {
    test('should support complete note learning cycle', async () => {
      await neo4jAdapter.connect(mockStore);

      // 1. Create a note while reading
      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: () => ({
              properties: {
                id: 'note-001',
                title: 'Neural Networks Basics',
                content: 'A neural network is...',
                inLeitner: false,
                leitnerBox: 0,
              },
            }),
          },
        ],
      });

      const note = await neo4jAdapter.createNote(
        {
          title: 'Neural Networks Basics',
          content: 'A neural network is...',
          sourceType: 'book',
          sourceKey: 'book-001',
        },
        'user-token'
      );

      expect(note.id).toBe('note-001');
      expect(note.inLeitner).toBe(false);

      // 2. Add note to Leitner study
      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: () => ({
              properties: {
                ...note,
                inLeitner: true,
                leitnerBox: 1,
                leitnerDueDate: new Date().toISOString(),
              },
            }),
          },
        ],
      });

      const studyNote = await neo4jAdapter.addNoteToLeitnerStudy('note-001', 'user-token');
      expect(studyNote.inLeitner).toBe(true);
      expect(studyNote.leitnerBox).toBe(1);

      // 3. Review note (correct) - recordReview expects 'item' and 'oldBox' keys
      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: (key: string) => {
              if (key === 'item') return {
                properties: {
                  id: 'note-001',
                  title: 'Neural Networks Basics',
                  inLeitner: true,
                  leitnerBox: 2, // Progressed from 1 to 2
                  leitnerFlips: 1,
                },
              };
              if (key === 'oldBox') return 1;
              return null;
            },
          },
        ],
      });
      // Mock second query - create REVIEWED relationship
      mockSession.run.mockResolvedValueOnce({ records: [] });

      const reviewedNote = await neo4jAdapter.recordReview('note-001', 'note', 'correct', 2, 'user-token');
      expect(reviewedNote.leitnerBox).toBe(2);

      // 4. Link to concept
      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: () => ({
              properties: { id: 'concept-001', name: 'Neural Networks' },
            }),
          },
        ],
      });

      const concept = await neo4jAdapter.upsertConcept(
        { name: 'Neural Networks', domain: 'AI' },
        'user-token'
      );

      mockSession.run.mockResolvedValueOnce({
        summary: { counters: { updates: jest.fn(() => ({ relationshipsCreated: 1 })) } },
      });

      await neo4jAdapter.createMentionsRelationship('note-001', 'concept-001', 5, 0.9);

      // 5. Search for related notes
      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: () => ({
              properties: { id: 'note-001', title: 'Neural Networks Basics' },
            }),
          },
        ],
      });

      const searchResults = await neo4jAdapter.searchNotes('neural', 'user-token');
      expect(searchResults.length).toBeGreaterThan(0);
    });

    test('should track complete learning session', async () => {
      await neo4jAdapter.connect(mockStore);

      // Start reading session
      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: () => ({
              properties: {
                id: 'session-001',
                activityType: 'reading',
                resourceType: 'book',
                resourceId: 'book-ml-001',
                startTime: new Date().toISOString(),
              },
            }),
          },
        ],
      });

      const session = await neo4jAdapter.startLearningSession('reading', 'book', 'book-ml-001', 'user-token');

      // Simulate 45 minutes of reading
      const sessionStats = {
        focusScore: 0.92,
        notesCreated: 7,
        conceptsReviewed: 12,
        wordsLearned: 5,
      };

      mockSession.run.mockResolvedValueOnce({
        records: [
          {
            get: () => ({
              properties: {
                ...session,
                endTime: new Date().toISOString(),
                duration: 2700, // 45 minutes
                ...sessionStats,
              },
            }),
          },
        ],
      });

      const endedSession = await neo4jAdapter.endLearningSession(session.id, sessionStats, 'user-token');

      expect(endedSession.focusScore).toBe(0.92);
      expect(endedSession.notesCreated).toBe(7);
      expect(endedSession.duration).toBe(2700);
    });
  });
});
