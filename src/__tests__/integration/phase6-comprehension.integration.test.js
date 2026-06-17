/**
 * Phase 6 Integration — comprehension grading happy path.
 *
 * Walks the two-step flow: generateQuestion (string return, no schema)
 * -> gradeAnswer (structured return). Confirms the service correctly
 * threads chapter context through both AI calls and normalizes the
 * grading response (clamps score, defaults missing arrays).
 *
 * @jest-environment node
 */

jest.mock('electron', () => ({ app: { getPath: jest.fn(() => '/tmp/test') } }));

// Mock AIProviderManager — the null-provider guard in the service reads
// aiProviderManager.currentProvider; supply a truthy stub so the guard passes.
jest.mock('../../commons/service/AIProviderManager', () => ({
  __esModule: true,
  instanceInMain: { currentProvider: { name: 'mock-provider' } },
}));

const mockBrainCall = jest.fn();
jest.mock('../../main/brain/spine', () => ({
  brainCall: (...args) => mockBrainCall(...args),
}));

const comprehensionGradingService = require('../../main/utils/ComprehensionGradingService').default;

describe('Phase 6 integration — comprehension grading happy path', () => {
  beforeEach(() => {
    mockBrainCall.mockReset();
  });

  it('generateQuestion -> gradeAnswer returns normalized score + gaps', async () => {
    // First brainCall: generateQuestion — returns plain text (no schema)
    mockBrainCall.mockResolvedValueOnce({
      output: 'How does the chapter explain the relationship between monads and side effects?',
      callId: 100,
      cacheHit: false,
    });

    const question = await comprehensionGradingService.generateQuestion({
      chapterTitle: 'Composing Effects',
      bookTitle: 'Functional Programming',
      textExcerpt: 'Monads compose effectful computations...',
    });

    expect(typeof question).toBe('string');
    expect(question).toContain('monads');

    // Second brainCall: gradeAnswer — returns structured grading object
    mockBrainCall.mockResolvedValueOnce({
      output: {
        score: 72,
        strengths: ['Identified bind as the composition operator'],
        gaps: ['Did not mention the law of associativity'],
        feedback: 'Solid grasp of mechanics; refine the algebraic framing.',
      },
      callId: 101,
      cacheHit: false,
    });

    const result = await comprehensionGradingService.gradeAnswer({
      chapterTitle: 'Composing Effects',
      bookTitle: 'Functional Programming',
      textExcerpt: 'Monads compose effectful computations...',
      question,
      answer:
        'Monads let you sequence computations that produce side effects ' +
        'by wrapping values in a context and binding functions over them.',
    });

    expect(result.error).toBeUndefined();
    expect(result.score).toBe(72);
    expect(result.strengths).toHaveLength(1);
    expect(result.gaps).toHaveLength(1);
    expect(result.feedback).toContain('algebraic');
    expect(result.callId).toBe(101);

    // Score clamping: even if the AI returns out-of-range, the service
    // normalizes to 0-100.
    mockBrainCall.mockResolvedValueOnce({
      output: {
        score: 150,
        strengths: [],
        gaps: [],
        feedback: '',
      },
      callId: 102,
      cacheHit: false,
    });
    const clamped = await comprehensionGradingService.gradeAnswer({
      chapterTitle: 'x',
      question: 'q',
      answer: 'a',
    });
    expect(clamped.score).toBe(100);
  });
});
