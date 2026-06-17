/**
 * Phase 5 Integration — pre-book diagnostic happy path.
 *
 * Confirms TOC -> AI prompt -> structured response -> per-chapter
 * annotation pipeline composes end-to-end. The known/unknown
 * intersection is deterministic post-call, so the AI mock can return
 * canned `estimatedConcepts` and we verify chapter status assignment.
 *
 * @jest-environment node
 */

jest.mock('electron', () => ({ app: { getPath: jest.fn(() => '/tmp/test') } }));

const mockProvider = { name: 'mock-provider' };
jest.mock('../../commons/service/AIProviderManager', () => ({
  __esModule: true,
  instanceInMain: { currentProvider: mockProvider },
}));

const mockBrainCall = jest.fn();
jest.mock('../../main/brain/spine', () => ({
  brainCall: (...args) => mockBrainCall(...args),
}));

const { BookDiagnosticService } = require('../../main/utils/BookDiagnosticService');

describe('Phase 5 integration — pre-book diagnostic happy path', () => {
  beforeEach(() => {
    mockBrainCall.mockReset();
  });

  it('TOC + known concepts -> annotated chapters with readiness score', async () => {
    mockBrainCall.mockResolvedValue({
      output: {
        bookSummary: 'An introduction to functional programming.',
        topics: ['immutability', 'higher-order functions', 'monads'],
        estimatedDifficulty: 'intermediate',
        chapters: [
          {
            title: 'Chapter 1: Pure Functions',
            estimatedConcepts: ['pure function', 'referential transparency'],
          },
          {
            title: 'Chapter 2: Higher-Order Functions',
            estimatedConcepts: ['map', 'filter', 'reduce'],
          },
          {
            title: 'Chapter 3: Monads',
            estimatedConcepts: ['monad', 'functor', 'applicative'],
          },
        ],
        primer:
          'You already know functions; focus on equational reasoning early on.',
        prerequisiteWarnings: [
          { topic: 'category theory', reason: 'Not strictly required.' },
        ],
      },
      callId: 5,
      cacheHit: false,
    });

    const service = new BookDiagnosticService();
    const result = await service.run({
      bookTitle: 'Functional Programming',
      bookAuthor: 'Test Author',
      toc: [
        { label: 'Chapter 1: Pure Functions' },
        { label: 'Chapter 2: Higher-Order Functions' },
        { label: 'Chapter 3: Monads' },
      ],
      knownConcepts: ['pure function', 'map', 'filter', 'reduce'],
    });

    expect(result.error).toBeUndefined();
    expect(result.bookTitle).toBe('Functional Programming');
    expect(result.topics).toHaveLength(3);
    expect(result.chapters).toHaveLength(3);

    // Ch 1: 1 of 2 known -> 'partial'
    expect(result.chapters[0].knownToReader).toEqual(['pure function']);
    expect(result.chapters[0].status).toBe('partial');

    // Ch 2: 3 of 3 known -> 'review'
    expect(result.chapters[1].knownToReader).toHaveLength(3);
    expect(result.chapters[1].status).toBe('review');

    // Ch 3: 0 of 3 known -> 'new'
    expect(result.chapters[2].knownToReader).toEqual([]);
    expect(result.chapters[2].status).toBe('new');

    // readinessScore = totalKnown / totalConcepts = 4 / 8 = 50
    expect(result.readinessScore).toBe(50);

    expect(result.prerequisiteWarnings).toHaveLength(1);
    expect(result.primer).toContain('equational reasoning');
  });
});
