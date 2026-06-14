/**
 * LearningBrainAgent.skillCallShape.test.js
 *
 * Pins the CURRENT call shape that LearningBrainAgent uses when invoking
 * AdaptiveLearningSkill.detectPatterns and LearningGraphSkill.getWeakConcepts.
 *
 * Why this exists: both calls pass `({ userId, token }, options)` but the
 * real skills expect a single `params` object with domain fields:
 *
 *   AdaptiveLearningSkill.detectPatterns(params) — reads
 *     params.performanceHistory (length < 5 -> empty result).
 *
 *   LearningGraphSkill.getWeakConcepts(params) — reads
 *     params.domainType, params.limit, plus token from this.context.token
 *     (NOT from params).
 *
 * In production today the bug is dormant because main.ts injects
 * `adaptiveLearningSkill: null` and `learningGraphSkill: null`, so the
 * skill branches never execute. The brain falls back to "no skill
 * available" empty patterns / SQLite-based weak-concept query, which
 * both work.
 *
 * The day someone wires real skills into main.ts (the comment there
 * says "Will be injected by skill system"), the call-shape mismatch
 * surfaces and the heartbeat will silently return empty results.
 *
 * These tests pin the broken-but-currently-harmless behavior. When the
 * fix lands, the assertions fail loudly with this file's name in the
 * Jest output, pointing whoever is wiring the skills at the broken call
 * sites. The tests should be updated at that point — see the FIX
 * comment in each `it` block.
 */

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/tmp/test') },
}));

jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: {
    prepare: jest.fn(() => ({ all: () => [], get: () => null, run: () => ({}) })),
  },
  getUserIdFromToken: jest.fn(() => 1),
}));

const LearningBrainAgent = require('../../main/brain/LearningBrainAgent');

describe('LearningBrainAgent — skill call shape (pinned bugs)', () => {
  describe('detectPatterns -> AdaptiveLearningSkill', () => {
    it('passes {userId, token} as params (skill expects {performanceHistory})', async () => {
      // Skill mock that records what the brain hands it. The real skill
      // reads params.performanceHistory; this mock captures the args so
      // the test can assert the mismatch directly.
      const detectPatternsMock = jest.fn(async () => ({
        success: true,
        patterns: [],
        message: 'Need at least 5 sessions to detect patterns',
        dataPoints: 0,
      }));
      const adaptiveLearningSkill = { detectPatterns: detectPatternsMock };

      const agent = new LearningBrainAgent({ adaptiveLearningSkill });
      await agent.detectPatterns(1, 'tok');

      expect(detectPatternsMock).toHaveBeenCalledTimes(1);
      const [firstArg, secondArg] = detectPatternsMock.mock.calls[0];

      // FIX: when this fires intentionally (call shape corrected), expect
      //   firstArg to be { performanceHistory: [...] }
      //   secondArg to be undefined (single-param skill API)
      // and update this assertion to match. The current shape is wrong.
      expect(firstArg).toEqual({ userId: 1, token: 'tok' });
      expect(secondArg).toEqual({ days: 30 });

      // performanceHistory absent → real skill would return the empty
      // "need 5 sessions" result regardless of how much data exists.
      expect(firstArg.performanceHistory).toBeUndefined();
    });
  });

  describe('checkWeakConcepts -> LearningGraphSkill', () => {
    it('passes {userId, token} as params (skill reads token from this.context, not params)', async () => {
      const getWeakConceptsMock = jest.fn(async () => ({
        success: false,
        error: 'Authentication required',
      }));
      const learningGraphSkill = { getWeakConcepts: getWeakConceptsMock };

      const agent = new LearningBrainAgent({ learningGraphSkill });
      await agent.checkWeakConcepts(1, 'tok');

      expect(getWeakConceptsMock).toHaveBeenCalledTimes(1);
      const [firstArg, secondArg] = getWeakConceptsMock.mock.calls[0];

      // FIX: when this fires intentionally, the brain should set
      //   learningGraphSkill.context = { token, services }
      // BEFORE the call (so this.context.token resolves) AND pass
      //   { limit: 10, domainType: ... }
      // as the single params arg. Update this assertion to match.
      expect(firstArg).toEqual({ userId: 1, token: 'tok' });
      expect(secondArg).toEqual({ limit: 10 });

      // domainType absent → real skill won't filter; limit absent from
      // params → defaults to 10 by accident, not by design.
      expect(firstArg.domainType).toBeUndefined();
      expect(firstArg.limit).toBeUndefined();
    });
  });

  describe('regression guard: dormant branches are not accidentally activated', () => {
    it('returns empty patterns when no skill is injected (today\'s default)', async () => {
      const agent = new LearningBrainAgent({});
      const result = await agent.detectPatterns(1, 'tok');
      expect(result.success).toBe(true);
      expect(result.result).toEqual({
        patterns: [],
        message: 'Pattern detection not available',
      });
    });
  });
});
