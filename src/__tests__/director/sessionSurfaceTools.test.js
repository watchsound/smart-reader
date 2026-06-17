// src/__tests__/director/sessionSurfaceTools.test.js
/**
 * Tests for the surface Director tools (openLeitnerCard, openComprehensionPanel,
 * openMicroCardChip, openMoodBoard).
 *
 * These tools delegate to ctx.awaitUserResult, which SessionRunner (Task 12)
 * will provide. Here we mock ctx and verify the delegation flow.
 */

const tools = require('../../main/brain/spine/tools');

// Reset tool registry before loading the tool modules.
beforeAll(() => {
  tools.__reset();
  require('../../main/brain/director/tools/openLeitnerCard');
  require('../../main/brain/director/tools/openComprehensionPanel');
  require('../../main/brain/director/tools/openMicroCardChip');
  require('../../main/brain/director/tools/openMoodBoard');
});

afterAll(() => {
  tools.__reset();
});

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

test('all 4 surface tools registered with kind=surface', () => {
  const desc = tools.descriptors();
  ['openLeitnerCard', 'openComprehensionPanel', 'openMicroCardChip', 'openMoodBoard']
    .forEach(name => {
      const t = desc.find(d => d.name === name);
      expect(t).toBeDefined();
      expect(t.kind).toBe('surface');
    });
});

// ---------------------------------------------------------------------------
// openLeitnerCard
// ---------------------------------------------------------------------------

test('openLeitnerCard delegates to ctx.awaitUserResult', async () => {
  const ctx = { awaitUserResult: jest.fn().mockResolvedValue({ rating: 'easy', durationMs: 1234 }) };
  const result = await tools.invoke('openLeitnerCard', { learningPointId: 99 }, ctx);
  expect(ctx.awaitUserResult).toHaveBeenCalledWith({ tool: 'openLeitnerCard', args: { learningPointId: 99 } });
  expect(result).toEqual({ rating: 'easy', durationMs: 1234 });
});

test('openLeitnerCard throws if ctx lacks awaitUserResult', async () => {
  const ctx = {};
  await expect(
    tools.invoke('openLeitnerCard', { learningPointId: 99 }, ctx),
  ).rejects.toThrow('requires session ctx with awaitUserResult');
});

// ---------------------------------------------------------------------------
// openComprehensionPanel
// ---------------------------------------------------------------------------

test('openComprehensionPanel delegates to ctx.awaitUserResult', async () => {
  const ctx = { awaitUserResult: jest.fn().mockResolvedValue({ score: 75, answer: 'The answer is...' }) };
  const result = await tools.invoke('openComprehensionPanel', { bookId: 5, chapterId: 'ch-3' }, ctx);
  expect(ctx.awaitUserResult).toHaveBeenCalledWith({ tool: 'openComprehensionPanel', args: { bookId: 5, chapterId: 'ch-3' } });
  expect(result).toEqual({ score: 75, answer: 'The answer is...' });
});

test('openComprehensionPanel throws if ctx lacks awaitUserResult', async () => {
  const ctx = {};
  await expect(
    tools.invoke('openComprehensionPanel', { bookId: 5, chapterId: 'ch-3' }, ctx),
  ).rejects.toThrow('requires session ctx with awaitUserResult');
});

// ---------------------------------------------------------------------------
// openMicroCardChip
// ---------------------------------------------------------------------------

test('openMicroCardChip delegates to ctx.awaitUserResult', async () => {
  const ctx = { awaitUserResult: jest.fn().mockResolvedValue({ accepted: true, durationMs: 5000 }) };
  const result = await tools.invoke('openMicroCardChip', { paragraphHash: 'abc123', proposal: { headword: 'test' } }, ctx);
  expect(ctx.awaitUserResult).toHaveBeenCalledWith({ tool: 'openMicroCardChip', args: { paragraphHash: 'abc123', proposal: { headword: 'test' } } });
  expect(result).toEqual({ accepted: true, durationMs: 5000 });
});

test('openMicroCardChip throws if ctx lacks awaitUserResult', async () => {
  const ctx = {};
  await expect(
    tools.invoke('openMicroCardChip', { paragraphHash: 'abc123', proposal: { headword: 'test' } }, ctx),
  ).rejects.toThrow('requires session ctx with awaitUserResult');
});

// ---------------------------------------------------------------------------
// openMoodBoard
// ---------------------------------------------------------------------------

test('openMoodBoard delegates to ctx.awaitUserResult', async () => {
  const ctx = { awaitUserResult: jest.fn().mockResolvedValue({ dwellMs: 8000, dismissed: false }) };
  const result = await tools.invoke('openMoodBoard', { boardId: 42 }, ctx);
  expect(ctx.awaitUserResult).toHaveBeenCalledWith({ tool: 'openMoodBoard', args: { boardId: 42 } });
  expect(result).toEqual({ dwellMs: 8000, dismissed: false });
});

test('openMoodBoard throws if ctx lacks awaitUserResult', async () => {
  const ctx = {};
  await expect(
    tools.invoke('openMoodBoard', { boardId: 42 }, ctx),
  ).rejects.toThrow('requires session ctx with awaitUserResult');
});
