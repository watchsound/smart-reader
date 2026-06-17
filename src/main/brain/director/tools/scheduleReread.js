// src/main/brain/director/tools/scheduleReread.js
/**
 * scheduleReread — soft-write Director tool.
 *
 * Calls meteredCallJson to get a ledger row (tagged session-soft-write:scheduleReread),
 * then writes to RereadQueueService. Returns { callId, rescheduleId } so the
 * live trace sidebar (Plan 10b-2) can surface an undo action.
 *
 * Undo: UndoRegistry.run('scheduleReread', { rescheduleId }) → removes the item.
 *
 * Why re-register 'scheduleReread': tools.js bootstraps a minimal stub of this
 * tool (Phase 9 skeleton). This module replaces it with the full Director-aware
 * declaration (correct schema, kind=soft-write) at Phase 10b-1 load time.
 *
 * Why rereadQueueSingleton: RereadQueueService is a class that requires an
 * electron-store instance injected at startup. The singleton accessor lets
 * Director tools call schedule/unschedule without threading the store through
 * every tool import; tests mock the singleton module cleanly.
 */
const tools = require('../../spine/tools');
const meteredCallJson = require('../../spine/meteredCallJson');
const RereadQueue = require('../../../utils/rereadQueueSingleton');
const UndoRegistry = require('../UndoRegistry');

// Re-register with the authoritative schema and kind, overwriting the Phase-9
// skeleton registration in tools.js which used a different shape.
tools.register('scheduleReread', {
  description: 'Schedule a chapter for spaced rereading. Reversible.',
  schema: {
    properties: {
      userId:      { type: 'number' },
      bookId:      { type: 'number' },
      bookTitle:   { type: 'string' },
      chapterId:   { type: 'string' },
      chapterName: { type: 'string' },
      gaps:        { type: 'array' },
      score:       { type: 'number' },
      reason:      { type: 'string' },
    },
    required: ['userId', 'bookId', 'chapterId'],
  },
  kind: 'soft-write',
});

tools.registerHandler('scheduleReread', async (args, ctx = {}) => {
  const {
    userId = 1,
    bookId,
    bookTitle = '',
    chapterId,
    chapterName = '',
    gaps = [],
    score = 0,
    reason = '',
  } = args;

  const { callId } = await meteredCallJson(
    `Acknowledge schedule reread of book ${bookId} chapter ${chapterId}. Reason: ${reason}`,
    null,
    { legacyLabel: 'session-soft-write:scheduleReread', traceId: ctx.traceId },
  );

  const item = RereadQueue.schedule({ userId, bookId, bookTitle, chapterId, chapterName, gaps, score });
  return { callId, rescheduleId: item.id };
});

UndoRegistry.register('scheduleReread', async ({ rescheduleId }) => {
  const undone = RereadQueue.unschedule(rescheduleId);
  return { undone: !!undone };
});
