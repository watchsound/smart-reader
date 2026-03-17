/**
 * Neo4jAdapterEpisodes.test.js
 *
 * Tests for Neo4jAdapter Episode batch creation
 * This would have caught the .toNumber() bug!
 */

// Mock electron app BEFORE any imports
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => './test-data'),
    isReady: jest.fn(() => true),
  },
}));

// Mock dbManager
jest.mock('../../main/db/dbManager', () => ({
  getUserIdFromToken: jest.fn((token) => 1),
  default: {},
}));

describe('Neo4jAdapter.batchCreateEpisodes', () => {
  let adapter;
  let mockDriver;
  let mockSession;

  beforeAll(async () => {
    // Dynamically import after mocks are set
    const module = await import('../../main/utils/Neo4jAdapter.js');
    adapter = module.default; // This is the singleton instance
  });

  beforeEach(() => {
    // Mock Neo4j session
    mockSession = {
      run: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };

    // Mock Neo4j driver
    mockDriver = {
      session: jest.fn().mockReturnValue(mockSession),
      close: jest.fn().mockResolvedValue(undefined),
    };

    // Replace the driver on the singleton
    adapter.driver = mockDriver;
    adapter.isConnected = true;
  });

  describe('successful creation', () => {
    it('should create episodes with MERGE query', async () => {
      const events = [
        {
          id: 'ep_123',
          userId: 1,
          eventType: 'REVIEW_COMPLETED',
          timestamp: '2024-01-15T10:00:00Z',
          payloadJson: JSON.stringify({ conceptId: 'c123' }),
          sourceContextJson: JSON.stringify({ planId: 'p123' }),
        },
      ];

      mockSession.run.mockResolvedValue({
        records: [{ get: jest.fn().mockReturnValue(1) }],
      });

      const result = await adapter.batchCreateEpisodes(events);

      expect(result.created).toBe(1);
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.stringContaining('MERGE (e:Episode {id: event.id})'),
        { events }
      );
    });

    it('should handle Neo4j Integer objects (legacy behavior)', async () => {
      const events = [
        {
          id: 'ep_456',
          userId: 1,
          eventType: 'SESSION_STARTED',
          timestamp: '2024-01-15T10:00:00Z',
          payloadJson: '{}',
          sourceContextJson: '{}',
        },
      ];

      // Mock Neo4j Integer object with toNumber() method
      const mockInteger = {
        toNumber: jest.fn().mockReturnValue(1),
      };

      mockSession.run.mockResolvedValue({
        records: [{ get: jest.fn().mockReturnValue(mockInteger) }],
      });

      const result = await adapter.batchCreateEpisodes(events);

      expect(result.created).toBe(1);
      expect(mockInteger.toNumber).toHaveBeenCalled();
    });

    it('should handle plain JavaScript numbers (MERGE behavior)', async () => {
      const events = [
        {
          id: 'ep_789',
          userId: 1,
          eventType: 'REVIEW_COMPLETED',
          timestamp: '2024-01-15T10:00:00Z',
          payloadJson: '{}',
          sourceContextJson: '{}',
        },
      ];

      // This is what MERGE actually returns - a plain number
      mockSession.run.mockResolvedValue({
        records: [{ get: jest.fn().mockReturnValue(1) }],
      });

      // Should NOT throw "toNumber is not a function"
      const result = await adapter.batchCreateEpisodes(events);

      expect(result.created).toBe(1);
    });

    it('should handle multiple events in batch', async () => {
      const events = [
        { id: 'ep_1', userId: 1, eventType: 'REVIEW_COMPLETED', timestamp: '2024-01-15T10:00:00Z', payloadJson: '{}', sourceContextJson: '{}' },
        { id: 'ep_2', userId: 1, eventType: 'REVIEW_COMPLETED', timestamp: '2024-01-15T10:01:00Z', payloadJson: '{}', sourceContextJson: '{}' },
        { id: 'ep_3', userId: 1, eventType: 'REVIEW_COMPLETED', timestamp: '2024-01-15T10:02:00Z', payloadJson: '{}', sourceContextJson: '{}' },
      ];

      mockSession.run.mockResolvedValue({
        records: [{ get: jest.fn().mockReturnValue(3) }],
      });

      const result = await adapter.batchCreateEpisodes(events);

      expect(result.created).toBe(3);
      expect(mockSession.run).toHaveBeenCalledWith(
        expect.any(String),
        { events }
      );
    });
  });

  describe('duplicate handling', () => {
    it('should not throw error on duplicate episode IDs', async () => {
      const duplicateEvent = {
        id: 'ep_duplicate',
        userId: 1,
        eventType: 'REVIEW_COMPLETED',
        timestamp: '2024-01-15T10:00:00Z',
        payloadJson: '{}',
        sourceContextJson: '{}',
      };

      // First insert
      mockSession.run.mockResolvedValueOnce({
        records: [{ get: jest.fn().mockReturnValue(1) }],
      });

      await adapter.batchCreateEpisodes([duplicateEvent]);

      // Second insert (duplicate) - MERGE should handle this
      mockSession.run.mockResolvedValueOnce({
        records: [{ get: jest.fn().mockReturnValue(0) }], // No new nodes created
      });

      // Should not throw
      const result = await adapter.batchCreateEpisodes([duplicateEvent]);

      expect(result.created).toBe(0);
    });

    it('should use ON CREATE SET to avoid updating existing episodes', async () => {
      const events = [{ id: 'ep_test', userId: 1, eventType: 'REVIEW_COMPLETED', timestamp: '2024-01-15T10:00:00Z', payloadJson: '{}', sourceContextJson: '{}' }];

      mockSession.run.mockResolvedValue({
        records: [{ get: jest.fn().mockReturnValue(1) }],
      });

      await adapter.batchCreateEpisodes(events);

      const query = mockSession.run.mock.calls[0][0];
      expect(query).toContain('ON CREATE SET');
      expect(query).not.toContain('ON MATCH SET');
    });
  });

  describe('error handling', () => {
    it('should return created: 0 on Neo4j error', async () => {
      const events = [{ id: 'ep_error', userId: 1, eventType: 'REVIEW_COMPLETED', timestamp: '2024-01-15T10:00:00Z', payloadJson: '{}', sourceContextJson: '{}' }];

      mockSession.run.mockRejectedValue(new Error('Connection lost'));

      const result = await adapter.batchCreateEpisodes(events);

      expect(result.created).toBe(0);
      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should handle empty events array', async () => {
      const result = await adapter.batchCreateEpisodes([]);

      expect(result.created).toBe(0);
      expect(mockSession.run).not.toHaveBeenCalled();
    });

    it('should handle null events', async () => {
      const result = await adapter.batchCreateEpisodes(null);

      expect(result.created).toBe(0);
      expect(mockSession.run).not.toHaveBeenCalled();
    });

    it('should handle adapter not connected', async () => {
      adapter.isConnected = false;

      const result = await adapter.batchCreateEpisodes([
        { id: 'ep_disconnected', userId: 1, eventType: 'REVIEW_COMPLETED', timestamp: '2024-01-15T10:00:00Z', payloadJson: '{}', sourceContextJson: '{}' },
      ]);

      expect(result.created).toBe(0);
      expect(mockSession.run).not.toHaveBeenCalled();
    });

    it('should handle missing driver', async () => {
      adapter.driver = null;

      const result = await adapter.batchCreateEpisodes([
        { id: 'ep_nodriver', userId: 1, eventType: 'REVIEW_COMPLETED', timestamp: '2024-01-15T10:00:00Z', payloadJson: '{}', sourceContextJson: '{}' },
      ]);

      expect(result.created).toBe(0);
    });

    it('should handle no records returned', async () => {
      const events = [{ id: 'ep_norecords', userId: 1, eventType: 'REVIEW_COMPLETED', timestamp: '2024-01-15T10:00:00Z', payloadJson: '{}', sourceContextJson: '{}' }];

      mockSession.run.mockResolvedValue({ records: [] });

      const result = await adapter.batchCreateEpisodes(events);

      expect(result.created).toBe(0);
    });
  });

  describe('bi-temporal timestamps', () => {
    it('should set both t_created and t_valid timestamps', async () => {
      const events = [{
        id: 'ep_timestamps',
        userId: 1,
        eventType: 'REVIEW_COMPLETED',
        timestamp: '2024-01-15T10:00:00Z',
        payloadJson: '{}',
        sourceContextJson: '{}',
      }];

      mockSession.run.mockResolvedValue({
        records: [{ get: jest.fn().mockReturnValue(1) }],
      });

      await adapter.batchCreateEpisodes(events);

      const query = mockSession.run.mock.calls[0][0];
      expect(query).toContain('e.t_created = datetime()');
      expect(query).toContain('e.t_valid = datetime(event.timestamp)');
    });
  });

  describe('session cleanup', () => {
    it('should close session after successful operation', async () => {
      const events = [{ id: 'ep_cleanup', userId: 1, eventType: 'REVIEW_COMPLETED', timestamp: '2024-01-15T10:00:00Z', payloadJson: '{}', sourceContextJson: '{}' }];

      mockSession.run.mockResolvedValue({
        records: [{ get: jest.fn().mockReturnValue(1) }],
      });

      await adapter.batchCreateEpisodes(events);

      expect(mockSession.close).toHaveBeenCalled();
    });

    it('should close session even on error', async () => {
      const events = [{ id: 'ep_error_cleanup', userId: 1, eventType: 'REVIEW_COMPLETED', timestamp: '2024-01-15T10:00:00Z', payloadJson: '{}', sourceContextJson: '{}' }];

      mockSession.run.mockRejectedValue(new Error('Query failed'));

      await adapter.batchCreateEpisodes(events);

      expect(mockSession.close).toHaveBeenCalled();
    });
  });
});
