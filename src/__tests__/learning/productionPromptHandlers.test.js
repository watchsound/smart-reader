/**
 * productionPromptHandlers.test.js
 *
 * IPC contract tests for Phase 8 production loop renderer-facing handlers.
 * Verifies the bridge between renderer payloads and the underlying services
 * (LearningPointManager + ComprehensionGradingService + ProductionPromptService).
 */

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
  },
}));

const mockBookStmt = { get: jest.fn(() => null) };
jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: { prepare: jest.fn(() => mockBookStmt) },
  getUserIdFromToken: jest.fn(() => 1),
}));

jest.mock('../../main/db/LearningPointManager', () => ({
  getLearningPointById: jest.fn(),
  applyProductionGrade: jest.fn(),
}));

jest.mock('../../main/utils/ComprehensionGradingService', () => ({
  __esModule: true,
  default: {
    gradeAnswer: jest.fn(),
  },
}));

// ProductionPromptService is `require`d (not import) inside the handler,
// and exports with dual pattern. Stub the class so its instance methods
// can be inspected.
const mockClearPrompt = jest.fn(() => true);
jest.mock('../../main/brain/ProductionPromptService', () => {
  return jest.fn().mockImplementation(() => ({
    clearPrompt: mockClearPrompt,
  }));
});

const { ipcMain } = require('electron');
const {
  getLearningPointById,
  applyProductionGrade,
} = require('../../main/db/LearningPointManager');
const comprehensionGradingService = require('../../main/utils/ComprehensionGradingService').default;
const {
  registerProductionPromptHandlers,
} = require('../../main/ipc/productionPromptHandlers');

describe('productionPromptHandlers', () => {
  const handlers = {};

  beforeAll(() => {
    ipcMain.handle.mockImplementation((channel, fn) => {
      handlers[channel] = fn;
    });
    registerProductionPromptHandlers({});
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockBookStmt.get.mockReturnValue(null);
    mockClearPrompt.mockReturnValue(true);
  });

  // ----------------------------------------------------------------------
  // production-get-prompt
  // ----------------------------------------------------------------------

  describe('production-get-prompt', () => {
    it('returns null when id is missing', async () => {
      const res = await handlers['production-get-prompt']({}, {});
      expect(res.learningPoint).toBeNull();
      expect(getLearningPointById).not.toHaveBeenCalled();
    });

    it('returns null when the learning point does not exist', async () => {
      getLearningPointById.mockReturnValue(null);
      const res = await handlers['production-get-prompt'](
        {},
        { id: 'lp_x', token: 'tok' },
      );
      expect(res.learningPoint).toBeNull();
    });

    it('flattens point + book title + parsed back text', async () => {
      getLearningPointById.mockReturnValue({
        id: 'lp_1',
        title: 'gradient descent',
        bookId: 42,
        domainType: 'math',
        masteryLevel: 75,
        back: JSON.stringify({ text: 'An iterative optimization algorithm.' }),
      });
      mockBookStmt.get.mockReturnValue({ name: 'Deep Learning' });

      const res = await handlers['production-get-prompt'](
        {},
        { id: 'lp_1', token: 'tok' },
      );
      expect(res.learningPoint).toEqual({
        id: 'lp_1',
        title: 'gradient descent',
        bookTitle: 'Deep Learning',
        bookId: 42,
        domainType: 'math',
        masteryLevel: 75,
        backText: 'An iterative optimization algorithm.',
      });
    });

    it('falls back to empty string for malformed back JSON', async () => {
      getLearningPointById.mockReturnValue({
        id: 'lp_1',
        title: 't',
        back: 'not valid json',
        bookId: null,
      });
      const res = await handlers['production-get-prompt'](
        {},
        { id: 'lp_1', token: 'tok' },
      );
      expect(res.learningPoint.backText).toBe('not valid json');
    });
  });

  // ----------------------------------------------------------------------
  // production-grade-answer
  // ----------------------------------------------------------------------

  describe('production-grade-answer', () => {
    it('rejects empty answer', async () => {
      const res = await handlers['production-grade-answer'](
        {},
        { id: 'lp_1', answer: '   ', token: 'tok' },
      );
      expect(res.error).toBe('Empty answer.');
      expect(comprehensionGradingService.gradeAnswer).not.toHaveBeenCalled();
    });

    it('rejects missing learning point', async () => {
      getLearningPointById.mockReturnValue(null);
      const res = await handlers['production-grade-answer'](
        {},
        { id: 'lp_x', answer: 'my explanation', token: 'tok' },
      );
      expect(res.error).toBe('Learning point not found.');
    });

    it('grades + applies SRS write-back + returns merged shape', async () => {
      getLearningPointById.mockReturnValue({
        id: 'lp_1',
        title: 'gradient descent',
        bookId: 42,
        back: JSON.stringify({ text: 'reference text' }),
      });
      mockBookStmt.get.mockReturnValue({ name: 'Deep Learning' });
      comprehensionGradingService.gradeAnswer.mockResolvedValue({
        score: 65,
        strengths: ['core idea'],
        gaps: ['edge case'],
        feedback: 'Solid grasp.',
      });
      applyProductionGrade.mockReturnValue({
        beforeMastery: 80,
        afterMastery: 65,
        beforeBox: 4,
        afterBox: 4,
        demoted: false,
      });

      const res = await handlers['production-grade-answer'](
        {},
        { id: 'lp_1', answer: 'my explanation', token: 'tok' },
      );

      // Grader called with the right framing — title as question, back.text
      // as the reference excerpt.
      expect(comprehensionGradingService.gradeAnswer).toHaveBeenCalledWith({
        chapterTitle: 'gradient descent',
        textExcerpt: 'reference text',
        bookTitle: 'Deep Learning',
        question: 'Explain "gradient descent" in your own words.',
        answer: 'my explanation',
      });
      // SRS write-back called with score from the grader.
      expect(applyProductionGrade).toHaveBeenCalledWith('lp_1', 65, 'tok');
      // Response merges grading + SRS delta.
      expect(res).toEqual({
        score: 65,
        strengths: ['core idea'],
        gaps: ['edge case'],
        feedback: 'Solid grasp.',
        update: {
          beforeMastery: 80,
          afterMastery: 65,
          beforeBox: 4,
          afterBox: 4,
          demoted: false,
        },
      });
    });

    it('returns grading error without calling SRS write-back', async () => {
      getLearningPointById.mockReturnValue({
        id: 'lp_1',
        title: 't',
        back: JSON.stringify({ text: 'ref' }),
      });
      comprehensionGradingService.gradeAnswer.mockResolvedValue({
        error: 'No AI provider configured.',
      });

      const res = await handlers['production-grade-answer'](
        {},
        { id: 'lp_1', answer: 'something', token: 'tok' },
      );
      expect(res.error).toBe('No AI provider configured.');
      expect(applyProductionGrade).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------------
  // production-complete / production-skip
  // ----------------------------------------------------------------------

  describe('production-complete', () => {
    it('clears the dedup record and returns ok+cleared', async () => {
      mockClearPrompt.mockReturnValue(true);
      const res = await handlers['production-complete'](
        {},
        { id: 'lp_1', score: 65, token: 'tok' },
      );
      expect(mockClearPrompt).toHaveBeenCalledWith(1, 'lp_1');
      expect(res).toEqual({ ok: true, cleared: true });
    });

    it('returns ok:true cleared:false when no dedup record existed', async () => {
      mockClearPrompt.mockReturnValue(false);
      const res = await handlers['production-complete'](
        {},
        { id: 'lp_1', score: 65, token: 'tok' },
      );
      expect(res).toEqual({ ok: true, cleared: false });
    });

    it('returns ok:false when id is missing', async () => {
      const res = await handlers['production-complete']({}, {});
      expect(res.ok).toBe(false);
      expect(mockClearPrompt).not.toHaveBeenCalled();
    });
  });

  describe('production-skip', () => {
    it('clears the dedup record and returns ok+cleared symmetric with complete', async () => {
      mockClearPrompt.mockReturnValue(true);
      const res = await handlers['production-skip'](
        {},
        { id: 'lp_1', token: 'tok' },
      );
      expect(mockClearPrompt).toHaveBeenCalledWith(1, 'lp_1');
      expect(res).toEqual({ ok: true, cleared: true });
    });

    it('returns ok:true cleared:false when no dedup record existed (skip is idempotent)', async () => {
      // Regression guard: prior to symmetric contract, this case returned
      // {ok: false} which misreported a successful no-op as a failure.
      mockClearPrompt.mockReturnValue(false);
      const res = await handlers['production-skip'](
        {},
        { id: 'lp_1', token: 'tok' },
      );
      expect(res).toEqual({ ok: true, cleared: false });
    });

    it('returns ok:false when id is missing', async () => {
      const res = await handlers['production-skip']({}, {});
      expect(res.ok).toBe(false);
    });
  });
});
