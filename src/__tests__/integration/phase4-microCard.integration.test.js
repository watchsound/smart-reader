/**
 * Phase 4 Integration — micro-card proposer happy path.
 *
 * Exercises the full propose-from-paragraph pipeline against a real
 * `getStructured` polyfill mock + a stub AI provider. The unit tests
 * mock the proposer's gates individually; this confirms the gate order
 * + state mutation + AI handoff still composes correctly.
 *
 * @jest-environment node
 */

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/tmp/test') },
}));

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

const { MicroCardProposer, SKIP } = require('../../main/utils/MicroCardProposer');

const PARAGRAPH = [
  'A monad is a design pattern from functional programming.',
  'It represents computations as a sequence of steps, each step',
  'producing a new value wrapped in a context. The two essential',
  'operations are unit (wrap a value) and bind (apply a function',
  'to a wrapped value). This abstraction lets you compose effectful',
  'computations without explicitly threading state.',
].join(' ');

describe('Phase 4 integration — micro-card proposer happy path', () => {
  beforeEach(() => {
    mockGetStructured.mockReset();
  });

  it('propose -> AI accepts -> returns hydrated proposal with proposalId', async () => {
    mockGetStructured.mockResolvedValue({
      shouldPropose: true,
      front: 'What is a monad?',
      back: 'A design pattern composing effectful computations via unit + bind.',
      domain: 'programming',
      conceptName: 'monad',
      confidence: 0.85,
    });

    const proposer = new MicroCardProposer();
    const result = await proposer.proposeFromParagraph({
      bookId: 1,
      chapterId: 'ch_1',
      bookTitle: 'Functional Programming',
      chapterTitle: 'Composing Effects',
      text: PARAGRAPH,
      knownConcepts: ['function', 'value'],
    });

    expect(result.proposed).toBe(true);
    expect(result.proposalId).toBeTruthy();
    expect(result.front).toBe('What is a monad?');
    expect(result.back).toContain('design pattern');
    expect(result.domain).toBe('programming');
    expect(result.confidence).toBe(0.85);
    expect(result.paragraphHash).toBeTruthy();

    // Internal state should reflect the claimed slot — re-proposing the
    // same paragraph hits the dedup gate, not the AI.
    const second = await proposer.proposeFromParagraph({
      bookId: 1,
      chapterId: 'ch_1',
      bookTitle: 'Functional Programming',
      chapterTitle: 'Composing Effects',
      text: PARAGRAPH,
    });
    expect(second.proposed).toBe(false);
    expect(second.reason).toBe(SKIP.DUPLICATE);
    expect(mockGetStructured).toHaveBeenCalledTimes(1);
  });
});
