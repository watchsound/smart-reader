/**
 * synthesizePullSuggestion tests — Plan 13 migrated to Director.
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

// Director mock — used for the aiProvider-present path.
const directorRunMock = jest.fn();
jest.mock('../../main/brain/director/Director', () => ({
  run: (...args) => directorRunMock(...args),
}));

const LearningBrainAgent = require('../../main/brain/LearningBrainAgent');

function makeStore(quests = []) {
  const state = { 'quests.items': quests };
  return {
    get: (key, def) => (key in state ? state[key] : def),
    set: (key, value) => {
      state[key] = value;
    },
  };
}

// Stub aiProvider so the `if (!this.aiProvider)` guard doesn't short-circuit
// LLM-path tests. The actual call now goes through Director.
const stubProvider = {};

describe('LearningBrainAgent.synthesizePullSuggestion', () => {
  beforeEach(() => {
    directorRunMock.mockReset();
  });

  test('deterministic fallback when no aiProvider — uses top active quest', async () => {
    const store = makeStore([
      {
        id: 'q1',
        name: 'German B2',
        goal: 'Reach B2 by end of year',
        bookIds: [42],
        status: 'active',
        userId: 1,
      },
    ]);
    const agent = new LearningBrainAgent({ store, aiProvider: null });
    const result = await agent.synthesizePullSuggestion();
    expect(result).not.toBeNull();
    expect(result.title).toMatch(/German B2/);
    expect(result.navigate).toBe('reading/42');
    expect(result.source).toBe('deterministic-fallback');
  });

  test('deterministic fallback when no quests — sends to bookshelf', async () => {
    const agent = new LearningBrainAgent({ store: makeStore([]), aiProvider: null });
    const result = await agent.synthesizePullSuggestion();
    expect(result.title).toMatch(/caught up/i);
    expect(result.navigate).toBe('bookshelf');
  });

  test('LLM path — uses Director when aiProvider present and accepts well-shaped output', async () => {
    directorRunMock.mockResolvedValue({
      output: { title: 'Drill 5 German verbs', body: 'You have 5 conjugation cards due today.', navigate: 'vocabulary' },
      traceId: 'tr_test',
      callIds: [1],
      usedFallback: false,
    });
    const agent = new LearningBrainAgent({
      store: makeStore([
        {
          id: 'q1',
          name: 'German B2',
          goal: 'Reach B2',
          bookIds: [42],
          status: 'active',
          userId: 1,
        },
      ]),
      aiProvider: stubProvider,
    });
    const result = await agent.synthesizePullSuggestion();
    expect(directorRunMock).toHaveBeenCalledTimes(1);
    expect(result.title).toBe('Drill 5 German verbs');
    expect(result.navigate).toBe('vocabulary');
    expect(result.source).toBe('llm');
  });

  test('LLM path — falls back when Director returns usedFallback=true', async () => {
    directorRunMock.mockResolvedValue({
      output: { title: 'Continue your quest: X', body: 'g', navigate: 'reading/7', source: 'deterministic-fallback' },
      traceId: 'tr_test',
      callIds: [],
      usedFallback: true,
    });
    const agent = new LearningBrainAgent({
      store: makeStore([
        {
          id: 'q1',
          name: 'X',
          goal: 'g',
          bookIds: [7],
          status: 'active',
          userId: 1,
        },
      ]),
      aiProvider: stubProvider,
    });
    const result = await agent.synthesizePullSuggestion();
    expect(result.source).toBe('deterministic-fallback');
  });

  test('LLM path — falls back when Director throws', async () => {
    directorRunMock.mockRejectedValue(new Error('provider down'));
    const agent = new LearningBrainAgent({
      store: makeStore([]),
      aiProvider: stubProvider,
    });
    const result = await agent.synthesizePullSuggestion();
    expect(result.source).toBe('deterministic-fallback');
    expect(result.title).toMatch(/caught up/i);
  });

  test('LLM path — source is llm when Director succeeds', async () => {
    directorRunMock.mockResolvedValue({
      output: { title: 'do thing', body: 'because', navigate: 'notes' },
      traceId: 'tr_test',
      callIds: [3],
      usedFallback: false,
    });
    const agent = new LearningBrainAgent({
      store: makeStore([]),
      aiProvider: stubProvider,
    });
    const result = await agent.synthesizePullSuggestion();
    expect(result.navigate).toBe('notes');
    expect(result.source).toBe('llm');
  });
});
