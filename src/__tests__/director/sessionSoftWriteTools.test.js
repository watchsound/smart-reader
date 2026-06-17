// src/__tests__/director/sessionSoftWriteTools.test.js
/**
 * Tests for the soft-write Director tools (scheduleReread, createMicroCard,
 * scheduleProductionPrompt) and their undo paths.
 *
 * RereadQueueService, MicroCardProposer, and ProductionPromptService are all
 * singletons that require injection or Electron-context imports. The singleton
 * wrapper modules are mocked here so tests stay isolated.
 */

jest.mock('../../main/utils/rereadQueueSingleton', () => ({
  schedule: jest.fn().mockReturnValue({ id: 'rq-1' }),
  unschedule: jest.fn().mockReturnValue(true),
}));
jest.mock('../../main/brain/spine/meteredCallJson', () =>
  jest.fn().mockResolvedValue({ output: 'ok', callId: 77 }),
);
jest.mock('../../main/utils/microCardProposerSingleton', () => ({
  commit: jest.fn().mockReturnValue({ id: 'mc-1' }),
  delete: jest.fn().mockReturnValue(true),
}));
jest.mock('../../main/brain/productionPromptSingleton', () => ({
  schedulePrompt: jest.fn().mockResolvedValue({ id: 'pp-1' }),
  unschedule: jest.fn().mockReturnValue(true),
}));

const tools = require('../../main/brain/spine/tools');
const UndoRegistry = require('../../main/brain/director/UndoRegistry');

// Reset tool registry and undo registry before loading the tool modules.
// This avoids "already registered" errors from the Phase 9 skeleton in
// tools.js if tests run in the same Jest worker as other suites.
beforeAll(() => {
  tools.__reset();
  UndoRegistry.__reset();
  require('../../main/brain/director/tools/scheduleReread');
  require('../../main/brain/director/tools/createMicroCard');
  require('../../main/brain/director/tools/scheduleProductionPrompt');
});

afterAll(() => {
  tools.__reset();
  UndoRegistry.__reset();
});

const RQ = require('../../main/utils/rereadQueueSingleton');
const MCP = require('../../main/utils/microCardProposerSingleton');
const PPS = require('../../main/brain/productionPromptSingleton');

// ---------------------------------------------------------------------------
// scheduleReread
// ---------------------------------------------------------------------------

test('scheduleReread executes + returns callId + rescheduleId', async () => {
  const result = await tools.invoke('scheduleReread', {
    userId: 1,
    bookId: 5,
    chapterId: 'ch-3',
    reason: 'low comprehension',
  });
  expect(RQ.schedule).toHaveBeenCalledWith({
    userId: 1,
    bookId: 5,
    bookTitle: '',
    chapterId: 'ch-3',
    chapterName: '',
    gaps: [],
    score: 0,
  });
  expect(result.callId).toBe(77);
  expect(result.rescheduleId).toBe('rq-1');
});

test('scheduleReread undo reverses via UndoRegistry', async () => {
  const result = await UndoRegistry.run('scheduleReread', { rescheduleId: 'rq-1' });
  expect(RQ.unschedule).toHaveBeenCalledWith('rq-1');
  expect(result.undone).toBe(true);
});

test('scheduleReread registered with kind=soft-write', () => {
  const desc = tools.descriptors().find((t) => t.name === 'scheduleReread');
  expect(desc).toBeDefined();
  expect(desc.kind).toBe('soft-write');
});

// ---------------------------------------------------------------------------
// createMicroCard
// ---------------------------------------------------------------------------

test('createMicroCard executes + undo reverses', async () => {
  const result = await tools.invoke('createMicroCard', {
    userId: 1,
    paragraphHash: 'h1',
    draft: { headword: 'parse', definition: 'd' },
    domain: 'vocabulary',
  });
  expect(MCP.commit).toHaveBeenCalled();
  expect(result.microCardId).toBe('mc-1');
  const undo = await UndoRegistry.run('createMicroCard', { microCardId: 'mc-1' });
  expect(undo.undone).toBe(true);
});

test('createMicroCard registered with kind=soft-write', () => {
  const desc = tools.descriptors().find((t) => t.name === 'createMicroCard');
  expect(desc).toBeDefined();
  expect(desc.kind).toBe('soft-write');
});

// ---------------------------------------------------------------------------
// scheduleProductionPrompt
// ---------------------------------------------------------------------------

test('scheduleProductionPrompt executes + undo reverses', async () => {
  const result = await tools.invoke('scheduleProductionPrompt', {
    userId: 1,
    learningPointId: 99,
    prompt: 'Write a sentence using "parse"',
  });
  expect(PPS.schedulePrompt).toHaveBeenCalled();
  expect(result.promptId).toBe('pp-1');
  expect(result.userId).toBe(1);
  expect(result.learningPointId).toBe(99);
  const undo = await UndoRegistry.run('scheduleProductionPrompt', { userId: 1, learningPointId: 99 });
  expect(PPS.unschedule).toHaveBeenCalledWith({ userId: 1, learningPointId: 99 });
  expect(undo.undone).toBe(true);
});

test('scheduleProductionPrompt registered with kind=soft-write', () => {
  const desc = tools.descriptors().find((t) => t.name === 'scheduleProductionPrompt');
  expect(desc).toBeDefined();
  expect(desc.kind).toBe('soft-write');
});
