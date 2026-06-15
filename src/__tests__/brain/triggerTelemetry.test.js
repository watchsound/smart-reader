/**
 * Trigger telemetry tests — LearningBrainAgent.recordProposalEvent persists
 * per-source counters to electron-store, and getTriggerTelemetry reads them.
 */

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/mock/user/data') },
}));

jest.mock('../../main/db/NotificationManager', () => ({
  createNotification: jest.fn(),
  NOTIFICATION_TYPES: {
    STUDY_REMINDER: 'study_reminder',
    STREAK: 'streak',
    SYSTEM: 'system',
    PROGRESS: 'progress',
  },
  NOTIFICATION_PRIORITIES: { LOW: 'low', NORMAL: 'normal', HIGH: 'high', URGENT: 'urgent' },
}));

jest.mock('../../main/utils/ConsolidationService', () =>
  jest.fn().mockImplementation(() => ({})),
);
jest.mock('../../main/brain/MoodBoardOrganizerService', () =>
  jest.fn().mockImplementation(() => ({})),
);
jest.mock('../../main/brain/ProductionPromptService', () =>
  jest.fn().mockImplementation(() => ({})),
);

const LearningBrainAgent = require('../../main/brain/LearningBrainAgent');

function makeStore() {
  const state = {};
  return {
    get: (k, d) => (k in state ? state[k] : d),
    set: (k, v) => {
      state[k] = v;
    },
    _state: state,
  };
}

describe('recordProposalEvent / getTriggerTelemetry', () => {
  test('records accept under provided source and bumps the counter', async () => {
    const store = makeStore();
    const agent = new LearningBrainAgent({ store });
    await agent.recordProposalEvent({
      proposalId: 'phase7:x',
      source: 'phase-7-learning-path',
      kind: 'accept',
    });
    const t = agent.getTriggerTelemetry();
    expect(t.bySource['phase-7-learning-path'].accepted).toBe(1);
    expect(t.bySource['phase-7-learning-path'].dismissed).toBe(0);
    expect(t.bySource['phase-7-learning-path'].lastEventKind).toBe('accept');
    expect(t.bySource['phase-7-learning-path'].lastEvent).toMatch(/T/);
  });

  test('records dismiss under provided source and bumps the counter', async () => {
    const store = makeStore();
    const agent = new LearningBrainAgent({ store });
    await agent.recordProposalEvent({
      proposalId: 'phase8b:x',
      source: 'phase-8b-organize',
      kind: 'dismiss',
    });
    const t = agent.getTriggerTelemetry();
    expect(t.bySource['phase-8b-organize'].dismissed).toBe(1);
    expect(t.bySource['phase-8b-organize'].accepted).toBe(0);
  });

  test('falls back to source="unknown" when source is missing', async () => {
    const store = makeStore();
    const agent = new LearningBrainAgent({ store });
    await agent.recordProposalEvent({
      proposalId: 'x',
      source: null,
      kind: 'accept',
    });
    expect(agent.getTriggerTelemetry().bySource.unknown.accepted).toBe(1);
  });

  test('accumulates counters across multiple events', async () => {
    const store = makeStore();
    const agent = new LearningBrainAgent({ store });
    const event = (kind) =>
      agent.recordProposalEvent({
        proposalId: 'p',
        source: 'phase-8a-reread',
        kind,
      });
    await event('accept');
    await event('accept');
    await event('dismiss');
    const t = agent.getTriggerTelemetry();
    expect(t.bySource['phase-8a-reread']).toEqual(
      expect.objectContaining({
        accepted: 2,
        dismissed: 1,
        lastEventKind: 'dismiss',
      }),
    );
  });

  test('no-op when store is absent', async () => {
    const agent = new LearningBrainAgent({ store: null });
    await expect(
      agent.recordProposalEvent({
        proposalId: 'x',
        source: 'phase-7-learning-path',
        kind: 'accept',
      }),
    ).resolves.not.toThrow();
    expect(agent.getTriggerTelemetry()).toEqual({ bySource: {} });
  });
});
