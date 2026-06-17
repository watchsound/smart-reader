// src/__tests__/director/sessionSoftWriteTools.test.js
/**
 * Tests for the scheduleReread soft-write Director tool and its undo path.
 *
 * RereadQueueService is a class that requires electron-store injection;
 * the tool uses rereadQueueSingleton which is mocked here so the test
 * stays isolated from both Electron APIs and a real store.
 */

jest.mock('../../main/utils/rereadQueueSingleton', () => ({
  schedule: jest.fn().mockReturnValue({ id: 'rq-1' }),
  unschedule: jest.fn().mockReturnValue(true),
}));
jest.mock('../../main/brain/spine/meteredCallJson', () =>
  jest.fn().mockResolvedValue({ output: 'ok', callId: 77 }),
);

const tools = require('../../main/brain/spine/tools');
const UndoRegistry = require('../../main/brain/director/UndoRegistry');

// Reset tool registry and undo registry before loading the tool module.
// This avoids "scheduleReread already registered" errors from the Phase 9
// skeleton in tools.js if tests run in the same Jest worker as other suites.
beforeAll(() => {
  tools.__reset();
  UndoRegistry.__reset();
  require('../../main/brain/director/tools/scheduleReread');
});

afterAll(() => {
  tools.__reset();
  UndoRegistry.__reset();
});

const RQ = require('../../main/utils/rereadQueueSingleton');

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
