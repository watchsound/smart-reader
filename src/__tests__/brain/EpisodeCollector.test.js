/**
 * EpisodeCollector.test.js
 *
 * Tests for the EpisodeCollector class
 */

const EpisodeCollector = require('../../main/brain/EpisodeCollector');

describe('EpisodeCollector', () => {
  let collector;
  let mockNeo4jAdapter;
  let mockStore;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Neo4j adapter
    mockNeo4jAdapter = {
      batchCreateEpisodes: jest.fn().mockResolvedValue({ created: 1 }),
      isReady: jest.fn().mockReturnValue(true),
    };

    // Mock electron-store
    mockStore = {
      get: jest.fn().mockReturnValue([]),
      set: jest.fn(),
    };

    // Create collector with mocks
    collector = new EpisodeCollector({
      neo4jAdapter: mockNeo4jAdapter,
      store: mockStore,
    });

    // Clear timers
    jest.clearAllTimers();
  });

  afterEach(() => {
    if (collector) {
      collector.stopPeriodicFlush();
    }
  });

  describe('record', () => {
    it('should record a single event', () => {
      const event = {
        userId: 1,
        eventType: 'REVIEW_COMPLETED',
        payload: { conceptId: 'c123', rating: 3 },
        sourceContext: { view: 'study' },
      };

      const id = collector.record(event);

      expect(id).toBeDefined();
      expect(collector.eventBuffer.length).toBe(1);
      expect(collector.eventBuffer[0]).toMatchObject({
        userId: 1,
        eventType: 'REVIEW_COMPLETED',
        payload: { conceptId: 'c123', rating: 3 },
      });
      expect(collector.eventBuffer[0].id).toBeDefined();
      expect(collector.eventBuffer[0].timestamp).toBeDefined();
    });

    it('should auto-flush when buffer reaches size limit', async () => {
      // Set small buffer size
      collector.maxBufferSize = 5;
      const flushSpy = jest.spyOn(collector, 'flush');

      // Record 5 events
      for (let i = 0; i < 5; i++) {
        collector.record({
          userId: 1,
          eventType: 'REVIEW_COMPLETED',
          payload: { conceptId: `c${i}` },
        });
      }

      // Wait for async flush
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(flushSpy).toHaveBeenCalled();
    });

    it('should handle events without userId gracefully', () => {
      const event = {
        eventType: 'SESSION_STARTED',
        payload: { planId: 'p123' },
      };

      collector.record(event);

      expect(collector.eventBuffer.length).toBe(1);
      expect(collector.eventBuffer[0].userId).toBe(1); // Default userId
    });

    it('should return event ID', () => {
      const event = {
        eventType: 'NOTE_CREATED',
        payload: { noteId: 'n123' },
      };

      const id = collector.record(event);

      expect(typeof id).toBe('string');
      expect(id).toMatch(/^ep_/);
    });
  });

  describe('flush', () => {
    it('should flush events to Neo4j', async () => {
      collector.record({
        userId: 1,
        eventType: 'REVIEW_COMPLETED',
        payload: { conceptId: 'c123' },
        sourceContext: { view: 'study' },
      });

      await collector.flush();

      expect(mockNeo4jAdapter.batchCreateEpisodes).toHaveBeenCalledTimes(1);
      expect(mockNeo4jAdapter.batchCreateEpisodes).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            userId: 1,
            eventType: 'REVIEW_COMPLETED',
            payloadJson: expect.any(String),
            sourceContextJson: expect.any(String),
          }),
        ])
      );
      expect(collector.eventBuffer.length).toBe(0);
    });

    it('should not flush if buffer is empty', async () => {
      await collector.flush();

      expect(mockNeo4jAdapter.batchCreateEpisodes).not.toHaveBeenCalled();
    });

    it('should handle Neo4j errors by putting events back in buffer', async () => {
      mockNeo4jAdapter.batchCreateEpisodes.mockRejectedValueOnce(
        new Error('Network error')
      );

      collector.record({
        userId: 1,
        eventType: 'REVIEW_COMPLETED',
        payload: { conceptId: 'c123' },
      });

      // Should not throw
      await expect(collector.flush()).resolves.not.toThrow();

      // Buffer should have the event back
      expect(collector.eventBuffer.length).toBe(1);
    });

    it('should skip flush if adapter is not ready', async () => {
      mockNeo4jAdapter.isReady.mockReturnValue(false);

      collector.record({
        userId: 1,
        eventType: 'REVIEW_COMPLETED',
        payload: {},
      });

      await collector.flush();

      expect(mockNeo4jAdapter.batchCreateEpisodes).not.toHaveBeenCalled();
    });

    it('should fallback to local storage if no Neo4j adapter', async () => {
      const collectorNoNeo4j = new EpisodeCollector({ store: mockStore });

      collectorNoNeo4j.record({
        userId: 1,
        eventType: 'REVIEW_COMPLETED',
        payload: { conceptId: 'c123' },
      });

      await collectorNoNeo4j.flush();

      // Should use store instead
      expect(mockStore.set).toHaveBeenCalled();

      collectorNoNeo4j.stopPeriodicFlush();
    });
  });

  describe('JSON serialization', () => {
    it('should serialize payload to JSON', async () => {
      const complexPayload = {
        conceptId: 'c123',
        rating: 3,
        metadata: { hints: 2, time: 5000 },
      };

      collector.record({
        userId: 1,
        eventType: 'REVIEW_COMPLETED',
        payload: complexPayload,
      });

      await collector.flush();

      const call = mockNeo4jAdapter.batchCreateEpisodes.mock.calls[0][0][0];
      expect(call.payloadJson).toBe(JSON.stringify(complexPayload));
    });

    it('should serialize sourceContext to JSON', async () => {
      const sourceContext = {
        view: 'study',
        planId: 'p123',
        sessionId: 's456',
      };

      collector.record({
        userId: 1,
        eventType: 'REVIEW_COMPLETED',
        payload: {},
        sourceContext,
      });

      await collector.flush();

      const call = mockNeo4jAdapter.batchCreateEpisodes.mock.calls[0][0][0];
      expect(call.sourceContextJson).toBe(JSON.stringify(sourceContext));
    });
  });

  describe('batch operations', () => {
    it('should handle large batches efficiently', async () => {
      // Set large buffer to prevent auto-flush during recording
      collector.maxBufferSize = 200;

      // Record 100 events
      for (let i = 0; i < 100; i++) {
        collector.record({
          userId: 1,
          eventType: 'REVIEW_COMPLETED',
          payload: { conceptId: `c${i}` },
        });
      }

      await collector.flush();

      expect(mockNeo4jAdapter.batchCreateEpisodes).toHaveBeenCalledTimes(1);
      expect(mockNeo4jAdapter.batchCreateEpisodes.mock.calls[0][0].length).toBe(100);
    });
  });

  describe('periodic flush', () => {
    it('should have periodic flush enabled', () => {
      expect(collector.flushTimer).not.toBeNull();
    });

    it('should stop periodic flush on stopPeriodicFlush', () => {
      collector.stopPeriodicFlush();
      expect(collector.flushTimer).toBeNull();
    });
  });
});
