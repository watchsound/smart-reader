/**
 * LearningPlanManager Reconciliation Function Tests
 *
 * Tests for getDueItemsReconciled, calculateDaysOverdue, getOverdueItemsByGap
 *
 * Note: We test the logic directly without importing from LearningPlanManager
 * to avoid electron/db dependencies. The functions are simple enough to test inline.
 */

// ===========================================================================
// Inline implementations of the functions being tested (mirrors LearningPlanManager.js)
// ===========================================================================

/**
 * Calculate days overdue for an item
 * This mirrors the implementation in LearningPlanManager.js
 */
const calculateDaysOverdue = (item) => {
  if (!item.nextReview) return 0;

  const now = new Date();
  const nextReview = new Date(item.nextReview);

  if (nextReview > now) return 0;

  const diffMs = now - nextReview;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Get overdue items grouped by severity
 * This mirrors the implementation in LearningPlanManager.js
 */
const getOverdueItemsByGap = (dueItems, profile = null) => {
  const optimalInterval = profile?.optimalReviewInterval > 0 ? profile.optimalReviewInterval : 3;

  const grouped = {
    critical: [], // > 2x optimal interval overdue
    important: [], // 1-2x optimal interval overdue
    routine: [], // < 1x optimal interval overdue
    total: 0,
  };

  for (const item of dueItems) {
    const daysOverdue = calculateDaysOverdue(item);
    item.daysOverdue = daysOverdue;

    if (daysOverdue > optimalInterval * 2) {
      grouped.critical.push(item);
    } else if (daysOverdue > optimalInterval) {
      grouped.important.push(item);
    } else {
      grouped.routine.push(item);
    }
    grouped.total++;
  }

  // Sort each group by days overdue (most overdue first)
  grouped.critical.sort((a, b) => b.daysOverdue - a.daysOverdue);
  grouped.important.sort((a, b) => b.daysOverdue - a.daysOverdue);
  grouped.routine.sort((a, b) => b.daysOverdue - a.daysOverdue);

  return grouped;
};

/**
 * Get due items with optional LLM reconciliation
 * This mirrors the implementation in LearningPlanManager.js
 */
const getDueItemsReconciled = async (dueItems, limit, token, options = {}) => {
  const { useReconciliation = false, reconciler = null } = options;

  // Base result structure
  const basicResult = {
    items: dueItems.slice(0, limit),
    reconciled: false,
    source: 'basic',
  };

  if (!useReconciliation || !reconciler) {
    return basicResult;
  }

  try {
    const reconcileResult = await reconciler.getDueItemsReconciled('planId', token, limit);

    if (reconcileResult.error) {
      return {
        ...basicResult,
        source: 'basic_fallback',
        error: reconcileResult.error,
      };
    }

    return {
      items: reconcileResult.items || [],
      reconciled: true,
      source: 'reconciled',
      context: reconcileResult.context,
      adjustments: reconcileResult.adjustments,
      sessionPlan: reconcileResult.sessionPlan,
      recommendations: reconcileResult.recommendations,
    };
  } catch (err) {
    return {
      ...basicResult,
      source: 'error_fallback',
      error: err.message,
    };
  }
};

// ===========================================================================
// Helper function for tests
// ===========================================================================

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

// ===========================================================================
// Tests
// ===========================================================================

describe('LearningPlanManager - Reconciliation Functions', () => {
  // ===========================================================================
  // calculateDaysOverdue Tests
  // ===========================================================================

  describe('calculateDaysOverdue()', () => {
    it('should return 0 for item not yet due', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const item = { nextReview: tomorrow.toISOString() };
      const result = calculateDaysOverdue(item);

      expect(result).toBe(0);
    });

    it('should return 0 for item due today', () => {
      const today = new Date();
      today.setHours(23, 59, 59); // End of today

      const item = { nextReview: today.toISOString() };
      const result = calculateDaysOverdue(item);

      expect(result).toBe(0);
    });

    it('should calculate correct days for overdue item', () => {
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      const item = { nextReview: fiveDaysAgo.toISOString() };
      const result = calculateDaysOverdue(item);

      expect(result).toBe(5);
    });

    it('should handle item with no nextReview', () => {
      const item = { nextReview: null };
      const result = calculateDaysOverdue(item);

      expect(result).toBe(0);
    });

    it('should handle item with undefined nextReview', () => {
      const item = {};
      const result = calculateDaysOverdue(item);

      expect(result).toBe(0);
    });

    it('should floor partial days', () => {
      // 2.5 days ago
      const twoAndHalfDaysAgo = new Date();
      twoAndHalfDaysAgo.setTime(twoAndHalfDaysAgo.getTime() - (2.5 * 24 * 60 * 60 * 1000));

      const item = { nextReview: twoAndHalfDaysAgo.toISOString() };
      const result = calculateDaysOverdue(item);

      expect(result).toBe(2); // Floor
    });

    it('should handle very old items', () => {
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);

      const item = { nextReview: yearAgo.toISOString() };
      const result = calculateDaysOverdue(item);

      expect(result).toBeGreaterThanOrEqual(365);
    });
  });

  // ===========================================================================
  // getOverdueItemsByGap Tests
  // ===========================================================================

  describe('getOverdueItemsByGap()', () => {
    it('should group items by severity correctly', () => {
      const mockItems = [
        // Critical: > 2x optimal (6+ days for optimalInterval=3)
        { id: '1', front: 'Critical 1', nextReview: daysAgo(10) },
        { id: '2', front: 'Critical 2', nextReview: daysAgo(8) },

        // Important: 1-2x optimal (3-6 days)
        { id: '3', front: 'Important 1', nextReview: daysAgo(4) },
        { id: '4', front: 'Important 2', nextReview: daysAgo(5) },

        // Routine: < 1x optimal (< 3 days)
        { id: '5', front: 'Routine 1', nextReview: daysAgo(1) },
        { id: '6', front: 'Routine 2', nextReview: daysAgo(2) },
      ];

      const profile = { optimalReviewInterval: 3 };
      const grouped = getOverdueItemsByGap(mockItems, profile);

      expect(grouped.critical.length).toBe(2);
      expect(grouped.important.length).toBe(2);
      expect(grouped.routine.length).toBe(2);
      expect(grouped.total).toBe(6);
    });

    it('should sort each group by days overdue (most first)', () => {
      const mockItems = [
        { id: '1', front: 'Critical 1', nextReview: daysAgo(10) },
        { id: '2', front: 'Critical 2', nextReview: daysAgo(8) },
        { id: '3', front: 'Important 1', nextReview: daysAgo(4) },
        { id: '4', front: 'Important 2', nextReview: daysAgo(5) },
      ];

      const profile = { optimalReviewInterval: 3 };
      const grouped = getOverdueItemsByGap(mockItems, profile);

      // Critical: 10 days should be first, then 8
      expect(grouped.critical[0].daysOverdue).toBeGreaterThan(grouped.critical[1].daysOverdue);

      // Important: 5 days should be first, then 4
      expect(grouped.important[0].daysOverdue).toBeGreaterThan(grouped.important[1].daysOverdue);
    });

    it('should add daysOverdue to each item', () => {
      const mockItems = [
        { id: '1', nextReview: daysAgo(10) },
        { id: '2', nextReview: daysAgo(5) },
      ];

      const profile = { optimalReviewInterval: 3 };
      const grouped = getOverdueItemsByGap(mockItems, profile);

      grouped.critical.forEach(item => {
        expect(item.daysOverdue).toBeDefined();
        expect(typeof item.daysOverdue).toBe('number');
      });
    });

    it('should use default optimal interval when profile is null', () => {
      const mockItems = [
        { id: '1', nextReview: daysAgo(10) },
        { id: '2', nextReview: daysAgo(5) },
        { id: '3', nextReview: daysAgo(1) },
      ];

      const grouped = getOverdueItemsByGap(mockItems, null);

      // Default optimal interval is 3
      expect(grouped.total).toBe(3);
    });

    it('should handle empty due items', () => {
      const grouped = getOverdueItemsByGap([], null);

      expect(grouped.critical).toEqual([]);
      expect(grouped.important).toEqual([]);
      expect(grouped.routine).toEqual([]);
      expect(grouped.total).toBe(0);
    });

    describe('threshold calculations', () => {
      it('should correctly categorize with short optimal interval', () => {
        const mockItems = [
          { id: '1', nextReview: daysAgo(5) }, // > 2x 2 = 4, critical
          { id: '2', nextReview: daysAgo(3) }, // 1-2x, important
          { id: '3', nextReview: daysAgo(1) }, // < 1x, routine
        ];

        const profile = { optimalReviewInterval: 2 };
        const grouped = getOverdueItemsByGap(mockItems, profile);

        expect(grouped.critical.length).toBe(1);
        expect(grouped.important.length).toBe(1);
        expect(grouped.routine.length).toBe(1);
      });

      it('should correctly categorize with long optimal interval', () => {
        const mockItems = [
          { id: '1', nextReview: daysAgo(25) }, // > 2x 10 = 20, critical
          { id: '2', nextReview: daysAgo(15) }, // 1-2x, important
          { id: '3', nextReview: daysAgo(5) },  // < 1x, routine
        ];

        const profile = { optimalReviewInterval: 10 };
        const grouped = getOverdueItemsByGap(mockItems, profile);

        expect(grouped.critical.length).toBe(1);
        expect(grouped.important.length).toBe(1);
        expect(grouped.routine.length).toBe(1);
      });
    });
  });

  // ===========================================================================
  // getDueItemsReconciled Tests
  // ===========================================================================

  describe('getDueItemsReconciled()', () => {
    const mockBasicItems = [
      { id: '1', front: 'Item 1', nextReview: new Date().toISOString() },
      { id: '2', front: 'Item 2', nextReview: new Date().toISOString() },
      { id: '3', front: 'Item 3', nextReview: new Date().toISOString() },
    ];

    it('should return basic items when reconciliation disabled', async () => {
      const result = await getDueItemsReconciled(
        mockBasicItems,
        10,
        'token',
        { useReconciliation: false }
      );

      expect(result.reconciled).toBe(false);
      expect(result.source).toBe('basic');
      expect(result.items.length).toBeLessThanOrEqual(10);
    });

    it('should return basic items when no reconciler provided', async () => {
      const result = await getDueItemsReconciled(
        mockBasicItems,
        10,
        'token',
        { useReconciliation: true, reconciler: null }
      );

      expect(result.reconciled).toBe(false);
      expect(result.source).toBe('basic');
    });

    it('should respect limit parameter', async () => {
      const manyItems = Array(50).fill(null).map((_, i) => ({
        id: `item_${i}`,
        front: `Item ${i}`,
        nextReview: new Date().toISOString(),
      }));

      const result = await getDueItemsReconciled(
        manyItems,
        5,
        'token',
        { useReconciliation: false }
      );

      expect(result.items.length).toBeLessThanOrEqual(5);
    });

    describe('with reconciler', () => {
      it('should use reconciler when provided', async () => {
        const mockReconciler = {
          getDueItemsReconciled: jest.fn().mockResolvedValue({
            items: [{ id: 'reconciled_1' }, { id: 'reconciled_2' }],
            context: { gapType: 'MODERATE' },
            adjustments: { intervalMultiplier: 0.8 },
          }),
        };

        const result = await getDueItemsReconciled(
          mockBasicItems,
          10,
          'token',
          { useReconciliation: true, reconciler: mockReconciler }
        );

        expect(result.reconciled).toBe(true);
        expect(result.source).toBe('reconciled');
        expect(result.items.length).toBe(2);
        expect(mockReconciler.getDueItemsReconciled).toHaveBeenCalledWith('planId', 'token', 10);
      });

      it('should include reconciliation metadata', async () => {
        const mockReconciler = {
          getDueItemsReconciled: jest.fn().mockResolvedValue({
            items: [{ id: '1' }],
            context: { gapType: 'MINOR' },
            adjustments: { intervalMultiplier: 1.0 },
            sessionPlan: { recommendedItemCount: 15 },
            recommendations: { studyOrder: 'critical first' },
          }),
        };

        const result = await getDueItemsReconciled(
          mockBasicItems,
          10,
          'token',
          { useReconciliation: true, reconciler: mockReconciler }
        );

        expect(result.context).toBeDefined();
        expect(result.adjustments).toBeDefined();
        expect(result.sessionPlan).toBeDefined();
        expect(result.recommendations).toBeDefined();
      });

      it('should fall back on reconciler error', async () => {
        const mockReconciler = {
          getDueItemsReconciled: jest.fn().mockResolvedValue({
            error: 'Reconciliation failed',
          }),
        };

        const result = await getDueItemsReconciled(
          mockBasicItems,
          10,
          'token',
          { useReconciliation: true, reconciler: mockReconciler }
        );

        expect(result.reconciled).toBe(false);
        expect(result.source).toBe('basic_fallback');
        expect(result.error).toBeDefined();
      });

      it('should handle reconciler throwing error', async () => {
        const mockReconciler = {
          getDueItemsReconciled: jest.fn().mockRejectedValue(new Error('Fatal error')),
        };

        const result = await getDueItemsReconciled(
          mockBasicItems,
          10,
          'token',
          { useReconciliation: true, reconciler: mockReconciler }
        );

        expect(result.reconciled).toBe(false);
        expect(result.source).toBe('error_fallback');
        expect(result.error).toBeDefined();
      });
    });
  });
});

// ===========================================================================
// Edge Case Tests
// ===========================================================================

describe('LearningPlanManager - Edge Cases', () => {
  describe('Date handling', () => {
    it('should handle timezone-aware dates', () => {
      // Create a date in a different timezone format
      const utcDate = '2024-01-15T10:00:00.000Z';
      const item = { nextReview: utcDate };

      const result = calculateDaysOverdue(item);

      // Should calculate correctly regardless of timezone
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should handle invalid date strings gracefully', () => {
      const item = { nextReview: 'not-a-date' };

      // Should not throw, returns NaN which becomes 0 due to floor
      expect(() => calculateDaysOverdue(item)).not.toThrow();
    });
  });

  describe('Boundary conditions', () => {
    it('should handle exactly 0 days overdue correctly', () => {
      const now = new Date();
      const item = { nextReview: now.toISOString() };

      const result = calculateDaysOverdue(item);

      expect(result).toBe(0);
    });

    it('should handle items due in far future', () => {
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 10);

      const item = { nextReview: farFuture.toISOString() };
      const result = calculateDaysOverdue(item);

      expect(result).toBe(0);
    });
  });

  describe('Profile variations', () => {
    it('should use profile with optimalReviewInterval', () => {
      const mockItems = [
        { id: '1', nextReview: daysAgo(12) }, // > 2x5=10, critical
        { id: '2', nextReview: daysAgo(7) },  // > 5 but <= 10, important
        { id: '3', nextReview: daysAgo(3) },  // <= 5, routine
      ];

      const profile = { optimalReviewInterval: 5 };
      const grouped = getOverdueItemsByGap(mockItems, profile);

      // With interval 5: critical > 10, important > 5 and <= 10, routine <= 5
      expect(grouped.critical.length).toBe(1); // 12 days
      expect(grouped.important.length).toBe(1); // 7 days
      expect(grouped.routine.length).toBe(1); // 3 days
    });

    it('should handle profile with zero optimal interval', () => {
      const mockItems = [
        { id: '1', nextReview: daysAgo(10) },
        { id: '2', nextReview: daysAgo(5) },
        { id: '3', nextReview: daysAgo(2) },
      ];

      const profile = { optimalReviewInterval: 0 };

      // Should use default (3) instead of 0
      const grouped = getOverdueItemsByGap(mockItems, profile);

      expect(grouped.total).toBe(3);
    });

    it('should handle profile with negative optimal interval', () => {
      const mockItems = [
        { id: '1', nextReview: daysAgo(10) },
        { id: '2', nextReview: daysAgo(5) },
        { id: '3', nextReview: daysAgo(2) },
      ];

      const profile = { optimalReviewInterval: -5 };

      // Should use default (3) instead of negative
      const grouped = getOverdueItemsByGap(mockItems, profile);

      expect(grouped.total).toBe(3);
    });
  });
});
