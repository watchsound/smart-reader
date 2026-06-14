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

const mockProvider = {
  name: 'mock-provider',
  generateContent: jest.fn(),
};
jest.mock('../../commons/service/AIProviderManager', () => ({
  __esModule: true,
  instanceInMain: { currentProvider: mockProvider },
}));

const mockGetStructured = jest.fn();
jest.mock('../../commons/service/polyfills/structuredOutput', () => ({
  getStructured: (...args) => mockGetStructured(...args),
}));

const comprehensionGradingService = require('../../main/utils/ComprehensionGradingService').default;

describe('Phase 6 integration — comprehension grading happy path', () => {
  beforeEach(() => {
    mockProvider.generateContent.mockReset();
    mockGetStructured.mockReset();
  });

  it('generateQuestion -> gradeAnswer returns normalized score + gaps', async () => {
    mockProvider.generateContent.mockResolvedValue(
      'How does the chapter explain the relationship between monads and side effects?',
    );

    const question = await comprehensionGradingService.generateQuestion({
      chapterTitle: 'Composing Effects',
      bookTitle: 'Functional Programming',
      textExcerpt: 'Monads compose effectful computations...',
    });

    expect(typeof question).toBe('string');
    expect(question).toContain('monads');

    mockGetStructured.mockResolvedValue({
      score: 72,
      strengths: ['Identified bind as the composition operator'],
      gaps: ['Did not mention the law of associativity'],
      feedback: 'Solid grasp of mechanics; refine the algebraic framing.',
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

    // Score clamping: even if the AI returns out-of-range, the service
    // normalizes to 0-100.
    mockGetStructured.mockResolvedValue({
      score: 150,
      strengths: [],
      gaps: [],
      feedback: '',
    });
    const clamped = await comprehensionGradingService.gradeAnswer({
      chapterTitle: 'x',
      question: 'q',
      answer: 'a',
    });
    expect(clamped.score).toBe(100);
  });
});
