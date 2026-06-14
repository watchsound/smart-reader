/**
 * HybridScheduler.getStatus / saveState / runHeartbeat diagnostics tests.
 *
 * Focused on the Phase 8 addition: surfacing the brain agent's
 * `persistedNotifications` stats through `getStatus` so the Settings UI
 * can show "N nudges fired, M deduped" without a separate query.
 */

const {
  describe,
  it,
  expect,
  beforeEach,
} = require('@jest/globals');

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/mock/user/data') },
}));

// saveState writes a state file via fs — stub the I/O so tests don't
// touch disk.
jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  existsSync: jest.fn(() => false),
}));

const HybridScheduler = require('../../main/brain/HybridScheduler');

const makeStore = () => {
  const data = {};
  return {
    get: jest.fn((key, fallback) =>
      data[key] === undefined ? fallback : data[key],
    ),
    set: jest.fn((key, value) => {
      data[key] = value;
    }),
    _raw: data,
  };
};

describe('HybridScheduler diagnostics surface', () => {
  let store;
  let brainAgent;
  let scheduler;

  beforeEach(() => {
    jest.clearAllMocks();
    store = makeStore();
    brainAgent = {
      runHeartbeat: jest.fn(),
    };
    scheduler = new HybridScheduler(brainAgent, { store });
  });

  // ----------------------------------------------------------------------
  // saveState
  // ----------------------------------------------------------------------

  describe('saveState', () => {
    it('persists lastHeartbeatResult to electron-store', () => {
      const result = {
        success: true,
        duration: 123,
        persistedNotifications: { created: 2, skipped: 1, errors: 0 },
      };
      scheduler.saveState({
        lastHeartbeat: '2026-06-14T10:00:00Z',
        lastHeartbeatResult: result,
      });

      expect(store._raw['learningBrain.lastHeartbeat']).toBe(
        '2026-06-14T10:00:00Z',
      );
      expect(store._raw['learningBrain.lastHeartbeatResult']).toEqual(result);
    });

    it('does not write lastHeartbeatResult when absent', () => {
      scheduler.saveState({ lastHeartbeat: '2026-06-14T10:00:00Z' });
      expect(
        store._raw['learningBrain.lastHeartbeatResult'],
      ).toBeUndefined();
    });

    it('swallows fs failures (does not throw) so heartbeat survives disk error', () => {
      // eslint-disable-next-line global-require
      const fs = require('fs');
      fs.writeFileSync.mockImplementationOnce(() => {
        throw new Error('ENOSPC');
      });
      expect(() =>
        scheduler.saveState({
          lastHeartbeat: '2026-06-14T10:00:00Z',
          lastHeartbeatResult: { success: true },
        }),
      ).not.toThrow();
      // Store write must still complete even when file write failed.
      expect(store._raw['learningBrain.lastHeartbeatResult']).toEqual({
        success: true,
      });
    });

    it('swallows store failures and continues', () => {
      store.set = jest.fn(() => {
        throw new Error('disk full');
      });
      expect(() =>
        scheduler.saveState({
          lastHeartbeat: '2026-06-14T10:00:00Z',
          lastHeartbeatResult: { success: true },
        }),
      ).not.toThrow();
    });
  });

  // ----------------------------------------------------------------------
  // getStatus
  // ----------------------------------------------------------------------

  describe('getStatus', () => {
    it('includes lastHeartbeatResult from the store', () => {
      const result = {
        success: true,
        duration: 50,
        persistedNotifications: { created: 3, skipped: 0, errors: 0 },
      };
      store.set('learningBrain.lastHeartbeatResult', result);
      store.set('learningBrain.lastHeartbeat', '2026-06-14T10:00:00Z');

      const status = scheduler.getStatus();
      expect(status.lastHeartbeatResult).toEqual(result);
      expect(status.lastHeartbeat).toBe('2026-06-14T10:00:00.000Z');
    });

    it('returns lastHeartbeatResult as undefined when nothing saved', () => {
      const status = scheduler.getStatus();
      expect(status.lastHeartbeatResult).toBeUndefined();
    });
  });

  // ----------------------------------------------------------------------
  // runHeartbeat → state save
  // ----------------------------------------------------------------------

  describe('runHeartbeat persists nudge stats', () => {
    it('saves persistedNotifications from the agent result', async () => {
      brainAgent.runHeartbeat.mockResolvedValue({
        success: true,
        persistedNotifications: { created: 2, skipped: 1, errors: 0 },
      });

      await scheduler.runHeartbeat({ manual: true });

      const saved = store._raw['learningBrain.lastHeartbeatResult'];
      expect(saved).toBeDefined();
      expect(saved.success).toBe(true);
      expect(saved.manual).toBe(true);
      expect(saved.persistedNotifications).toEqual({
        created: 2,
        skipped: 1,
        errors: 0,
      });
    });

    it('round-trips the byType breakdown through state to getStatus', async () => {
      brainAgent.runHeartbeat.mockResolvedValue({
        success: true,
        persistedNotifications: {
          created: 2,
          skipped: 1,
          errors: 0,
          byType: {
            streakAlert: { created: 1, skipped: 0, errors: 0 },
            dailySummary: { created: 1, skipped: 1, errors: 0 },
          },
        },
      });
      await scheduler.runHeartbeat({ manual: true });
      const status = scheduler.getStatus();
      expect(
        status.lastHeartbeatResult.persistedNotifications.byType,
      ).toEqual({
        streakAlert: { created: 1, skipped: 0, errors: 0 },
        dailySummary: { created: 1, skipped: 1, errors: 0 },
      });
    });

    it('saves a null persistedNotifications when the agent did not produce one', async () => {
      brainAgent.runHeartbeat.mockResolvedValue({ success: true });

      await scheduler.runHeartbeat();

      const saved = store._raw['learningBrain.lastHeartbeatResult'];
      expect(saved.persistedNotifications).toBeNull();
    });

    it('saves error result and rethrows on agent failure', async () => {
      brainAgent.runHeartbeat.mockRejectedValue(new Error('agent died'));

      await expect(scheduler.runHeartbeat()).rejects.toThrow('agent died');

      const saved = store._raw['learningBrain.lastHeartbeatResult'];
      expect(saved.success).toBe(false);
      expect(saved.error).toBe('agent died');
    });
  });
});
