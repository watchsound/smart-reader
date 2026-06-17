/**
 * Phase 7 Integration — cross-book learning path planner happy path.
 *
 * Drives the planner with two analyzed books (Phase 5 diagnostic data
 * present) and one unanalyzed. Verifies it partitions correctly, builds
 * the prompt, calls the AI via brainCall, and shapes the response
 * (validSteps filter, coverageGaps preserve, analyzedCount accounting).
 *
 * @jest-environment node
 */

jest.mock('electron', () => ({ app: { getPath: jest.fn(() => '/tmp/test') } }));

// The planner checks aiProviderManager.currentProvider before calling brainCall.
// Provide a non-null stub so the guard passes; the actual LLM dispatch is
// handled by the brainCall mock below.
jest.mock('../../commons/service/AIProviderManager', () => ({
  __esModule: true,
  instanceInMain: { currentProvider: { name: 'mock-provider' } },
}));

jest.mock('../../main/brain/spine', () => ({
  brainCall: jest.fn().mockResolvedValue({
    output: {
      summary: 'Start with FP basics, then climb to monads.',
      pathSteps: [
        {
          bookId: 1,
          bookTitle: 'Functional Programming Basics',
          chapterFocus: ['Pure Functions'],
          reason: 'Establishes the foundation.',
          estimatedHours: 4,
        },
        {
          bookId: 2,
          bookTitle: 'Advanced Functional Programming',
          chapterFocus: ['Monads'],
          reason: 'Builds on referential transparency.',
          estimatedHours: 6,
        },
        {
          // Invalid step (no bookId AND no bookTitle) — should be filtered out.
          chapterFocus: ['Nothing'],
        },
      ],
      coverageGaps: ['category-theoretic foundations'],
    },
    callId: 7,
    cacheHit: false,
  }),
}));

jest.mock('../../main/db/CallLedgerStore', () => ({
  bindTriggerId: jest.fn(),
}));

const learningPathPlannerService = require('../../main/utils/LearningPathPlannerService').default;

describe('Phase 7 integration — cross-book path planner happy path', () => {
  const { brainCall } = require('../../main/brain/spine');

  beforeEach(() => {
    brainCall.mockClear();
  });

  it('partitions books, calls AI via brainCall, returns ranked path with coverage gaps', async () => {
    const books = [
      {
        id: 1,
        name: 'Functional Programming Basics',
        author: 'Author A',
        diagnostic_data: JSON.stringify({
          topics: ['pure functions', 'immutability'],
          estimatedDifficulty: 'beginner',
          chapters: [
            {
              title: 'Pure Functions',
              estimatedConcepts: ['pure function', 'referential transparency'],
            },
          ],
        }),
      },
      {
        id: 2,
        name: 'Advanced Functional Programming',
        author: 'Author B',
        diagnostic_data: JSON.stringify({
          topics: ['monads', 'applicatives'],
          estimatedDifficulty: 'advanced',
          chapters: [
            { title: 'Monads', estimatedConcepts: ['monad', 'bind'] },
          ],
        }),
      },
      {
        id: 3,
        name: 'Category Theory',
        author: 'Author C',
        // No diagnostic_data — should go to unanalyzed bucket.
      },
    ];

    const result = await learningPathPlannerService.plan(
      'I want to understand monads from first principles',
      books,
    );

    expect(result.error).toBeUndefined();
    expect(result.summary).toContain('FP basics');
    expect(result.pathSteps).toHaveLength(2); // invalid one dropped
    expect(result.pathSteps[0].bookId).toBe(1);
    expect(result.pathSteps[0].estimatedHours).toBe(4);
    expect(result.pathSteps[1].bookId).toBe(2);
    expect(result.coverageGaps).toEqual(['category-theoretic foundations']);
    expect(result.analyzedCount).toBe(2);
    expect(result.totalBooks).toBe(3);
    // callId is surfaced so the handler can bind the trigger.
    expect(result.callId).toBe(7);

    // Verify brainCall was invoked with the correct intent.
    expect(brainCall).toHaveBeenCalledTimes(1);
    expect(brainCall).toHaveBeenCalledWith(
      'plan-cross-book-path',
      expect.any(String),
      expect.objectContaining({ schema: expect.any(Object) }),
    );
  });
});
