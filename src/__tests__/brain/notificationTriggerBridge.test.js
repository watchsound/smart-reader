/**
 * Notification → Trigger bridge test.
 *
 * Verifies that LearningBrainAgent.persistBrainNotifications emits an
 * atomic-chip Trigger for each nudge it successfully writes to the
 * NotificationManager, so the Brain Orb surfaces the same content as
 * the legacy notifications panel.
 */

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/mock/user/data') },
}));

const mockCreateNotification = jest.fn(() => ({ id: 'notif_x' }));
jest.mock('../../main/db/NotificationManager', () => ({
  createNotification: (...args) => mockCreateNotification(...args),
  NOTIFICATION_TYPES: {
    STUDY_REMINDER: 'study_reminder',
    STREAK: 'streak',
    SYSTEM: 'system',
    PROGRESS: 'progress',
  },
  NOTIFICATION_PRIORITIES: {
    LOW: 'low',
    NORMAL: 'normal',
    HIGH: 'high',
    URGENT: 'urgent',
  },
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

describe('persistBrainNotifications → Trigger bridge', () => {
  let store;
  let triggerEmitter;
  let agent;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateNotification.mockReturnValue({ id: 'notif_x' });
    // Provide a session token so persistBrainNotifications doesn't bail.
    global.shared = { store: { get: () => ({ token: 'tok-1' }) } };
    store = makeStore();
    triggerEmitter = { emit: jest.fn() };
    agent = new LearningBrainAgent({ store, triggerEmitter });
  });

  afterEach(() => {
    delete global.shared;
  });

  test('emits one atomic-chip Trigger per successfully created notification', () => {
    const result = agent.persistBrainNotifications([
      {
        type: 'streakAlert',
        title: '3 days streak',
        message: 'Keep it up',
        urgency: 'high',
      },
      {
        type: 'dailySummary',
        title: 'Today',
        message: 'Two cards due',
      },
    ]);
    expect(result.created).toBe(2);
    expect(triggerEmitter.emit).toHaveBeenCalledTimes(2);

    const calls = triggerEmitter.emit.mock.calls.map((c) => c[0]);
    const streak = calls.find((c) => c.source === 'notification-streakAlert');
    expect(streak.unit).toBe('atomic-chip');
    expect(streak.priority).toBe('high');
    expect(streak.payload.title).toBe('3 days streak');
    expect(streak.payload.actions[0]).toEqual(
      expect.objectContaining({ navigate: 'vocabulary', label: 'Keep streak' }),
    );
    expect(streak.id).toMatch(/^notif:streakAlert:\d{4}-\d{2}-\d{2}$/);

    const summary = calls.find(
      (c) => c.source === 'notification-dailySummary',
    );
    expect(summary.priority).toBe('normal');
    expect(summary.payload.actions[0].navigate).toBe('vocabulary');
  });

  test('does not emit Trigger when notification path skips (deduped)', () => {
    // First emit creates entries; second call should skip due to today-dedup.
    agent.persistBrainNotifications([
      { type: 'streakAlert', title: 'x', message: 'y' },
    ]);
    triggerEmitter.emit.mockClear();
    mockCreateNotification.mockClear();

    const result = agent.persistBrainNotifications([
      { type: 'streakAlert', title: 'x', message: 'y' },
    ]);
    expect(result.skipped).toBe(1);
    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(triggerEmitter.emit).not.toHaveBeenCalled();
  });

  test('no triggerEmitter → still writes notifications, no crash', () => {
    const agentNoEmitter = new LearningBrainAgent({ store: makeStore() });
    expect(() =>
      agentNoEmitter.persistBrainNotifications([
        { type: 'streakAlert', title: 'x', message: 'y' },
      ]),
    ).not.toThrow();
    expect(mockCreateNotification).toHaveBeenCalled();
  });

  test('does not emit when notification creation throws', () => {
    mockCreateNotification.mockImplementation(() => {
      throw new Error('db locked');
    });
    const result = agent.persistBrainNotifications([
      { type: 'streakAlert', title: 'x', message: 'y' },
    ]);
    expect(result.errors).toBe(1);
    expect(triggerEmitter.emit).not.toHaveBeenCalled();
  });
});
