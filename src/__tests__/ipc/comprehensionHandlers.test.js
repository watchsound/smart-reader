/**
 * comprehensionHandlers.test.js
 *
 * Verifies that the comprehension-grade-answer IPC handler forwards
 * learningPointId and questionId to ComprehensionGradingService.gradeAnswer
 * (Phase 13: required so the mastery_event writer receives attribution data).
 */

// ── electron mock ─────────────────────────────────────────────────────────────
const mockHandlers = {};
const mockIpcMain = {
  handle: jest.fn((channel, fn) => {
    mockHandlers[channel] = fn;
  }),
};
jest.mock('electron', () => ({ ipcMain: mockIpcMain }));

// ── ComprehensionGradingService mock ──────────────────────────────────────────
const mockGradeAnswer = jest.fn();
const mockGenerateQuestion = jest.fn();
jest.mock('../../main/utils/ComprehensionGradingService', () => ({
  __esModule: true,
  default: {
    generateQuestion: (...args) => mockGenerateQuestion(...args),
    gradeAnswer: (...args) => mockGradeAnswer(...args),
  },
}));

const { registerComprehensionHandlers } = require('../../main/ipc/comprehensionHandlers');

beforeAll(() => {
  registerComprehensionHandlers();
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('comprehension-grade-answer — Phase 13 learningPointId forwarding', () => {
  it('forwards learningPointId and questionId to gradeAnswer', async () => {
    mockGradeAnswer.mockResolvedValue({ score: 80, feedback: 'Good.' });

    await mockHandlers['comprehension-grade-answer']({}, {
      chapterTitle: 'Ch 1',
      textExcerpt: 'Some text',
      bookTitle: 'Book A',
      question: 'What is X?',
      answer: 'X is Y',
      learningPointId: 'lp-42',
      questionId: 'q-7',
    });

    expect(mockGradeAnswer).toHaveBeenCalledTimes(1);
    const args = mockGradeAnswer.mock.calls[0][0];
    expect(args.learningPointId).toBe('lp-42');
    expect(args.questionId).toBe('q-7');
  });

  it('passes null for learningPointId and questionId when omitted from payload', async () => {
    mockGradeAnswer.mockResolvedValue({ score: 60, feedback: 'OK.' });

    await mockHandlers['comprehension-grade-answer']({}, {
      chapterTitle: 'Ch 2',
      textExcerpt: 'Other text',
      question: 'What is Y?',
      answer: 'Y is Z',
    });

    expect(mockGradeAnswer).toHaveBeenCalledTimes(1);
    const args = mockGradeAnswer.mock.calls[0][0];
    expect(args.learningPointId).toBeNull();
    expect(args.questionId).toBeNull();
  });

  it('returns error for empty answer without calling gradeAnswer', async () => {
    const result = await mockHandlers['comprehension-grade-answer']({}, {
      question: 'What?',
      answer: '   ',
    });

    expect(result).toEqual({ error: 'Empty answer.' });
    expect(mockGradeAnswer).not.toHaveBeenCalled();
  });
});
