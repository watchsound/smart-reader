/**
 * synthesizePullSuggestion tests — Plan 3 LLM-backed pull with
 * deterministic Quest-aware fallback.
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

describe('LearningBrainAgent.synthesizePullSuggestion', () => {
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

  test('LLM path — uses aiProvider when present and accepts well-shaped JSON', async () => {
    const generateContentWithJson = jest.fn().mockResolvedValue({
      title: 'Drill 5 German verbs',
      body: 'You have 5 conjugation cards due today.',
      navigate: 'vocabulary',
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
      aiProvider: { generateContentWithJson },
    });
    const result = await agent.synthesizePullSuggestion();
    expect(generateContentWithJson).toHaveBeenCalledTimes(1);
    expect(result.title).toBe('Drill 5 German verbs');
    expect(result.navigate).toBe('vocabulary');
    expect(result.source).toBe('llm');
  });

  test('LLM path — falls back when LLM returns malformed JSON', async () => {
    const generateContentWithJson = jest.fn().mockResolvedValue('not json{garbage');
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
      aiProvider: { generateContentWithJson },
    });
    const result = await agent.synthesizePullSuggestion();
    expect(result.source).toBe('deterministic-fallback');
    expect(result.navigate).toBe('reading/7');
  });

  test('LLM path — falls back when LLM throws', async () => {
    const generateContentWithJson = jest
      .fn()
      .mockRejectedValue(new Error('provider down'));
    const agent = new LearningBrainAgent({
      store: makeStore([]),
      aiProvider: { generateContentWithJson },
    });
    const result = await agent.synthesizePullSuggestion();
    expect(result.source).toBe('deterministic-fallback');
    expect(result.title).toMatch(/caught up/i);
  });

  test('LLM path — strips leading slashes from navigate', async () => {
    const generateContentWithJson = jest.fn().mockResolvedValue({
      title: 'do thing',
      body: 'because',
      navigate: '/notes',
    });
    const agent = new LearningBrainAgent({
      store: makeStore([]),
      aiProvider: { generateContentWithJson },
    });
    const result = await agent.synthesizePullSuggestion();
    expect(result.navigate).toBe('notes');
  });
});
