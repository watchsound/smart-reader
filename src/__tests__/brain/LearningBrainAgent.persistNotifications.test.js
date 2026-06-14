/**
 * LearningBrainAgent.persistBrainNotifications Tests
 *
 * The brain's nudge POJOs (streakAlert / dailySummary / welcomeBack /
 * struggleAlert) were silently dropped before persistBrainNotifications.
 * These tests pin the type-mapping, dedup, and error-handling contracts
 * so the surface doesn't regress to "computed but invisible."
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

// LearningBrainAgent reaches into NotificationManager directly.
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

// The agent constructor also instantiates ConsolidationService,
// MoodBoardOrganizerService, ProductionPromptService — stub them to
// keep this test focused on the persistence layer.
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

describe('LearningBrainAgent.persistBrainNotifications', () => {
  let store;
  let agent;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateNotification.mockReturnValue({ id: 'notif_x' });

    global.shared = {
      store: { get: jest.fn(() => ({ token: 'real-token', id: 1 })) },
    };

    store = makeStore();
    agent = new LearningBrainAgent({ store });
  });

  it('no-ops with reason "no session" when nobody is signed in', () => {
    global.shared = { store: { get: jest.fn(() => null) } };
    const result = agent.persistBrainNotifications([
      { type: 'streakAlert', title: 'a', message: 'b', urgency: 'high' },
    ]);
    expect(result.reason).toBe('no session');
    expect(mockCreateNotification).not.toHaveBeenCalled();
    // Pin the zero-state shape. Without this, a future refactor that
    // accidentally runs the per-type bumpType() before the session gate
    // would silently leak {streakAlert: {created: 0, skipped: 0, errors: 0}}
    // into byType and the existing test would still pass. The UI relies
    // on this stayng empty to render "skipped (not signed in)" correctly.
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);
    expect(result.byType).toEqual({});
  });

  it('no-ops on empty input', () => {
    const result = agent.persistBrainNotifications([]);
    expect(result).toEqual({ created: 0, skipped: 0, errors: 0, byType: {} });
  });

  it('breaks down counts by nudge type for Settings diagnostic', () => {
    // Two daily summaries (one fires, one deduped same day), one streak fires.
    const dailyNudge = {
      type: 'dailySummary',
      title: 'a',
      message: 'b',
    };
    agent.persistBrainNotifications([dailyNudge]); // first daily fires
    mockCreateNotification.mockClear();

    const result = agent.persistBrainNotifications([
      dailyNudge, // skipped by dedup
      {
        type: 'streakAlert',
        title: 'streak',
        message: '!',
        urgency: 'high',
      },
    ]);
    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.byType).toEqual({
      dailySummary: { created: 0, skipped: 1, errors: 0 },
      streakAlert: { created: 1, skipped: 0, errors: 0 },
    });
  });

  it('maps streakAlert → STREAK + HIGH priority + /vocabulary actionUrl', () => {
    agent.persistBrainNotifications([
      {
        type: 'streakAlert',
        title: 'Your 5-day streak ends soon!',
        message: 'Quick review?',
        urgency: 'high',
      },
    ]);
    const [payload, token] = mockCreateNotification.mock.calls[0];
    expect(payload.type).toBe('streak');
    expect(payload.priority).toBe('high');
    expect(payload.actionUrl).toBe('/vocabulary');
    expect(payload.title).toContain('5-day');
    expect(token).toBe('real-token');
  });

  it('maps dailySummary → STUDY_REMINDER + NORMAL priority', () => {
    agent.persistBrainNotifications([
      { type: 'dailySummary', title: 'SmartReader', message: '3 due' },
    ]);
    const payload = mockCreateNotification.mock.calls[0][0];
    expect(payload.type).toBe('study_reminder');
    expect(payload.priority).toBe('normal');
    expect(payload.actionUrl).toBe('/vocabulary');
  });

  it('maps welcomeBack → SYSTEM type + /knowledge actionUrl', () => {
    agent.persistBrainNotifications([
      { type: 'welcomeBack', title: 'Welcome back!', message: '' },
    ]);
    const payload = mockCreateNotification.mock.calls[0][0];
    expect(payload.type).toBe('system');
    expect(payload.actionUrl).toBe('/knowledge');
  });

  it('maps struggleAlert → STUDY_REMINDER + /knowledge actionUrl', () => {
    agent.persistBrainNotifications([
      {
        type: 'struggleAlert',
        title: 'Focus Area Detected',
        message: 'concept X',
      },
    ]);
    const payload = mockCreateNotification.mock.calls[0][0];
    expect(payload.type).toBe('study_reminder');
    expect(payload.actionUrl).toBe('/knowledge');
  });

  it('falls back to SYSTEM/NORMAL for unknown nudge types', () => {
    agent.persistBrainNotifications([
      { type: 'someNewType', title: 't', message: 'm' },
    ]);
    const payload = mockCreateNotification.mock.calls[0][0];
    expect(payload.type).toBe('system');
    expect(payload.priority).toBe('normal');
  });

  it('deduplicates same (date, type) — second call same day is skipped', () => {
    const nudge = {
      type: 'dailySummary',
      title: 'SmartReader',
      message: '3 due',
    };
    const first = agent.persistBrainNotifications([nudge]);
    expect(first.created).toBe(1);

    mockCreateNotification.mockClear();
    const second = agent.persistBrainNotifications([nudge]);
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(1);
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it('allows different types to fire same day (dedup is per-type)', () => {
    const result = agent.persistBrainNotifications([
      { type: 'dailySummary', title: 'a', message: 'b' },
      {
        type: 'streakAlert',
        title: 'c',
        message: 'd',
        urgency: 'high',
      },
    ]);
    expect(result.created).toBe(2);
    expect(mockCreateNotification).toHaveBeenCalledTimes(2);
  });

  it('counts errors when createNotification throws', () => {
    mockCreateNotification.mockImplementation(() => {
      throw new Error('db locked');
    });
    const result = agent.persistBrainNotifications([
      { type: 'dailySummary', title: 'a', message: 'b' },
    ]);
    expect(result.created).toBe(0);
    expect(result.errors).toBe(1);
    // Dedup must NOT be recorded on failure — otherwise the user
    // would never see this nudge until tomorrow.
    const dedup = store._raw['learningBrain.notifDedup'] || {};
    expect(Object.keys(dedup)).toHaveLength(0);
  });

  it('trims the dedup map to today + yesterday only', () => {
    // Seed an old entry (3 days ago) — it should be evicted on the next
    // write so the map doesn't grow unbounded.
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000)
      .toISOString()
      .slice(0, 10);
    store.set('learningBrain.notifDedup', {
      [`${threeDaysAgo}:dailySummary`]: { firedAt: 'old' },
    });

    agent.persistBrainNotifications([
      { type: 'dailySummary', title: 'a', message: 'b' },
    ]);

    const dedup = store._raw['learningBrain.notifDedup'];
    const today = new Date().toISOString().slice(0, 10);
    expect(dedup[`${today}:dailySummary`]).toBeTruthy();
    // The 3-days-old key is evicted.
    expect(dedup[`${threeDaysAgo}:dailySummary`]).toBeUndefined();
  });

  it('honors urgency=high for non-streak nudge types too', () => {
    agent.persistBrainNotifications([
      {
        type: 'dailySummary',
        title: 'urgent',
        message: 'm',
        urgency: 'high',
      },
    ]);
    const payload = mockCreateNotification.mock.calls[0][0];
    expect(payload.priority).toBe('high');
  });
});
