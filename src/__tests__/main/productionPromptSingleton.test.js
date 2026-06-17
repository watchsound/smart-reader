// src/__tests__/main/productionPromptSingleton.test.js
/**
 * Unit tests for productionPromptSingleton.
 *
 * Verifies that schedulePrompt forwards userId to the underlying service and
 * that unschedule passes the real userId + learningPointId (not hardcoded 1).
 */

// Mock ProductionPromptService BEFORE requiring the singleton so the singleton
// picks up the mock when it calls require('./ProductionPromptService') on init.
const mockSchedulePrompt = jest.fn().mockResolvedValue({ created: 1, skipped: 0, candidates: [], reason: undefined });
const mockClearPrompt = jest.fn().mockReturnValue(true);

jest.mock('../../main/brain/ProductionPromptService', () => {
  return jest.fn().mockImplementation(() => ({
    schedulePrompt: mockSchedulePrompt,
    clearPrompt: mockClearPrompt,
  }));
});

const singleton = require('../../main/brain/productionPromptSingleton');

beforeEach(() => {
  // Re-initialize with an empty services object so the mock class is used.
  singleton.init({});
  mockSchedulePrompt.mockClear();
  mockClearPrompt.mockClear();
});

test('schedulePrompt forwards userId to ProductionPromptService.schedulePrompt', async () => {
  const result = await singleton.schedulePrompt({ userId: 7, learningPointId: 99, prompt: 'Explain cold' });
  expect(result.id).toBe(99);
  expect(mockSchedulePrompt).toHaveBeenCalledWith(7, null);
});

test('unschedule passes the userId from args, not hardcoded 1', () => {
  const ok = singleton.unschedule({ promptId: 99, userId: 7, learningPointId: 42 });
  expect(mockClearPrompt).toHaveBeenCalledWith(7, '42');
  expect(ok).toBe(true);
});

test('unschedule returns false when clearPrompt returns false', () => {
  mockClearPrompt.mockReturnValueOnce(false);
  const ok = singleton.unschedule({ userId: 7, learningPointId: 42 });
  expect(ok).toBe(false);
});
