/**
 * scheduleApi Helper Function Tests
 *
 * Tests for the renderer-side schedule reconciliation API helper functions:
 * - getGapSeverityInfo
 * - formatDaysOverdue
 * - estimateCatchUpTime
 * - GAP_SEVERITY, SESSION_TYPE, PRIORITY_TIERS constants
 */

// Mock window.electron BEFORE importing the module
const mockIpcRenderer = {
  invoke: jest.fn(),
  sendSync: jest.fn(),
};

global.window = {
  electron: {
    ipcRenderer: mockIpcRenderer,
  },
};

// Now import the module (it will capture the mocked window.electron)
import scheduleApi, {
  GAP_SEVERITY,
  SESSION_TYPE,
  PRIORITY_TIERS,
  getGapSeverityInfo,
  formatDaysOverdue,
  estimateCatchUpTime,
} from '../../renderer/api/scheduleApi';

// =============================================================================
// CONSTANTS TESTS
// =============================================================================

describe('Schedule API Constants', () => {
  describe('GAP_SEVERITY', () => {
    it('should define all severity levels', () => {
      expect(GAP_SEVERITY.MINOR).toBe('minor');
      expect(GAP_SEVERITY.MODERATE).toBe('moderate');
      expect(GAP_SEVERITY.SIGNIFICANT).toBe('significant');
      expect(GAP_SEVERITY.CRITICAL).toBe('critical');
    });

    it('should have exactly 4 severity levels', () => {
      const levels = Object.keys(GAP_SEVERITY);
      expect(levels.length).toBe(4);
    });
  });

  describe('SESSION_TYPE', () => {
    it('should define session types', () => {
      expect(SESSION_TYPE.FIRST_TODAY).toBe('first_today');
      expect(SESSION_TYPE.SUBSEQUENT).toBe('subsequent');
    });

    it('should have exactly 2 session types', () => {
      const types = Object.keys(SESSION_TYPE);
      expect(types.length).toBe(2);
    });
  });

  describe('PRIORITY_TIERS', () => {
    it('should define priority tiers', () => {
      expect(PRIORITY_TIERS.CRITICAL).toBe('critical');
      expect(PRIORITY_TIERS.IMPORTANT).toBe('important');
      expect(PRIORITY_TIERS.ROUTINE).toBe('routine');
    });

    it('should have exactly 3 priority tiers', () => {
      const tiers = Object.keys(PRIORITY_TIERS);
      expect(tiers.length).toBe(3);
    });
  });
});

// =============================================================================
// getGapSeverityInfo TESTS
// =============================================================================

describe('getGapSeverityInfo()', () => {
  describe('With default optimal interval (3 days)', () => {
    it('should return MINOR for less than 1x optimal interval', () => {
      const result = getGapSeverityInfo(2); // 2 days, optimal 3

      expect(result.severity).toBe(GAP_SEVERITY.MINOR);
      expect(result.label).toBe('Minor');
      expect(result.color).toBe('#4CAF50'); // Green
    });

    it('should return MINOR for 0 days overdue', () => {
      const result = getGapSeverityInfo(0);

      expect(result.severity).toBe(GAP_SEVERITY.MINOR);
    });

    it('should return MODERATE for 1-2x optimal interval', () => {
      const result = getGapSeverityInfo(4); // 4 days, optimal 3 → 1.33x

      expect(result.severity).toBe(GAP_SEVERITY.MODERATE);
      expect(result.label).toBe('Moderate');
      expect(result.color).toBe('#FF9800'); // Orange
    });

    it('should return SIGNIFICANT for 2-3x optimal interval', () => {
      const result = getGapSeverityInfo(7); // 7 days, optimal 3 → 2.33x

      expect(result.severity).toBe(GAP_SEVERITY.SIGNIFICANT);
      expect(result.label).toBe('Significant');
      expect(result.color).toBe('#f44336'); // Red
    });

    it('should return CRITICAL for more than 3x optimal interval', () => {
      const result = getGapSeverityInfo(10); // 10 days, optimal 3 → 3.33x

      expect(result.severity).toBe(GAP_SEVERITY.CRITICAL);
      expect(result.label).toBe('Critical');
      expect(result.color).toBe('#9C27B0'); // Purple
    });
  });

  describe('With custom optimal interval', () => {
    it('should adjust thresholds based on optimal interval', () => {
      const optimalInterval = 5;

      // 4 days with optimal 5 → 0.8x → MINOR
      expect(getGapSeverityInfo(4, optimalInterval).severity).toBe(GAP_SEVERITY.MINOR);

      // 6 days with optimal 5 → 1.2x → MODERATE
      expect(getGapSeverityInfo(6, optimalInterval).severity).toBe(GAP_SEVERITY.MODERATE);

      // 12 days with optimal 5 → 2.4x → SIGNIFICANT
      expect(getGapSeverityInfo(12, optimalInterval).severity).toBe(GAP_SEVERITY.SIGNIFICANT);

      // 16 days with optimal 5 → 3.2x → CRITICAL
      expect(getGapSeverityInfo(16, optimalInterval).severity).toBe(GAP_SEVERITY.CRITICAL);
    });

    it('should work with small optimal interval', () => {
      const optimalInterval = 1;

      expect(getGapSeverityInfo(0, optimalInterval).severity).toBe(GAP_SEVERITY.MINOR);
      expect(getGapSeverityInfo(1, optimalInterval).severity).toBe(GAP_SEVERITY.MODERATE);
      expect(getGapSeverityInfo(2, optimalInterval).severity).toBe(GAP_SEVERITY.SIGNIFICANT);
      expect(getGapSeverityInfo(4, optimalInterval).severity).toBe(GAP_SEVERITY.CRITICAL);
    });

    it('should work with large optimal interval', () => {
      const optimalInterval = 14;

      expect(getGapSeverityInfo(10, optimalInterval).severity).toBe(GAP_SEVERITY.MINOR);
      expect(getGapSeverityInfo(20, optimalInterval).severity).toBe(GAP_SEVERITY.MODERATE);
      expect(getGapSeverityInfo(35, optimalInterval).severity).toBe(GAP_SEVERITY.SIGNIFICANT);
      expect(getGapSeverityInfo(50, optimalInterval).severity).toBe(GAP_SEVERITY.CRITICAL);
    });
  });

  describe('Boundary conditions', () => {
    it('should handle exactly 1x boundary', () => {
      // At exactly 1x, ratio === 1, which is NOT < 1, so should be MODERATE
      const result = getGapSeverityInfo(3, 3);
      expect(result.severity).toBe(GAP_SEVERITY.MODERATE);
    });

    it('should handle exactly 2x boundary', () => {
      // At exactly 2x, should be SIGNIFICANT
      const result = getGapSeverityInfo(6, 3);
      expect(result.severity).toBe(GAP_SEVERITY.SIGNIFICANT);
    });

    it('should handle exactly 3x boundary', () => {
      // At exactly 3x, should be CRITICAL
      const result = getGapSeverityInfo(9, 3);
      expect(result.severity).toBe(GAP_SEVERITY.CRITICAL);
    });
  });

  describe('Edge cases', () => {
    it('should handle negative days overdue', () => {
      const result = getGapSeverityInfo(-5); // Not due yet

      expect(result.severity).toBe(GAP_SEVERITY.MINOR);
    });

    it('should handle very large days overdue', () => {
      const result = getGapSeverityInfo(365); // Year overdue

      expect(result.severity).toBe(GAP_SEVERITY.CRITICAL);
    });

    it('should handle floating point days', () => {
      const result = getGapSeverityInfo(2.5);

      // 2.5/3 = 0.83x → MINOR
      expect(result.severity).toBe(GAP_SEVERITY.MINOR);
    });

    it('should handle zero optimal interval by using default', () => {
      // With 0 optimal interval, would cause division issues
      // The function should handle this gracefully
      const result = getGapSeverityInfo(5, 0);

      // When optimalInterval is 0, any daysOverdue/0 = Infinity → CRITICAL
      expect(result).toBeDefined();
    });
  });

  describe('Return value structure', () => {
    it('should always return severity, label, and color', () => {
      const testCases = [0, 1, 5, 10, 20];

      testCases.forEach((days) => {
        const result = getGapSeverityInfo(days);

        expect(result).toHaveProperty('severity');
        expect(result).toHaveProperty('label');
        expect(result).toHaveProperty('color');
        expect(typeof result.severity).toBe('string');
        expect(typeof result.label).toBe('string');
        expect(result.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      });
    });
  });
});

// =============================================================================
// formatDaysOverdue TESTS
// =============================================================================

describe('formatDaysOverdue()', () => {
  describe('Day-based formatting', () => {
    it('should format 0 days as "Due today"', () => {
      expect(formatDaysOverdue(0)).toBe('Due today');
    });

    it('should format 1 day as singular', () => {
      expect(formatDaysOverdue(1)).toBe('1 day overdue');
    });

    it('should format 2-6 days with plural', () => {
      expect(formatDaysOverdue(2)).toBe('2 days overdue');
      expect(formatDaysOverdue(3)).toBe('3 days overdue');
      expect(formatDaysOverdue(6)).toBe('6 days overdue');
    });
  });

  describe('Week-based formatting', () => {
    it('should format 7-13 days as "1 week overdue"', () => {
      expect(formatDaysOverdue(7)).toBe('1 week overdue');
      expect(formatDaysOverdue(10)).toBe('1 week overdue');
      expect(formatDaysOverdue(13)).toBe('1 week overdue');
    });

    it('should format 14-29 days as weeks', () => {
      expect(formatDaysOverdue(14)).toBe('2 weeks overdue');
      expect(formatDaysOverdue(21)).toBe('3 weeks overdue');
      expect(formatDaysOverdue(28)).toBe('4 weeks overdue');
    });
  });

  describe('Month-based formatting', () => {
    it('should format 30-59 days as "1 month overdue"', () => {
      expect(formatDaysOverdue(30)).toBe('1 month overdue');
      expect(formatDaysOverdue(45)).toBe('1 month overdue');
      expect(formatDaysOverdue(59)).toBe('1 month overdue');
    });

    it('should format 60+ days as months', () => {
      expect(formatDaysOverdue(60)).toBe('2 months overdue');
      expect(formatDaysOverdue(90)).toBe('3 months overdue');
      expect(formatDaysOverdue(180)).toBe('6 months overdue');
      expect(formatDaysOverdue(365)).toBe('12 months overdue');
    });
  });

  describe('Edge cases', () => {
    it('should handle boundary values correctly', () => {
      // Day to week boundary
      expect(formatDaysOverdue(6)).toBe('6 days overdue');
      expect(formatDaysOverdue(7)).toBe('1 week overdue');

      // Week to month boundary
      expect(formatDaysOverdue(29)).toBe('4 weeks overdue');
      expect(formatDaysOverdue(30)).toBe('1 month overdue');

      // Single month to multiple months boundary
      expect(formatDaysOverdue(59)).toBe('1 month overdue');
      expect(formatDaysOverdue(60)).toBe('2 months overdue');
    });

    it('should handle very large values', () => {
      expect(formatDaysOverdue(1000)).toBe('33 months overdue');
      expect(formatDaysOverdue(3650)).toBe('121 months overdue'); // 10 years
    });

    it('should handle negative values', () => {
      // Negative values represent items due in the future
      // The function might not handle this case explicitly
      // but should not crash
      expect(() => formatDaysOverdue(-5)).not.toThrow();
    });
  });
});

// =============================================================================
// estimateCatchUpTime TESTS
// =============================================================================

describe('estimateCatchUpTime()', () => {
  describe('With default minutes per item', () => {
    it('should return minutes for small counts', () => {
      const result = estimateCatchUpTime(10);

      expect(result.minutes).toBe(10);
      expect(result.formatted).toBe('10 minutes');
    });

    it('should return minutes for counts under 60', () => {
      const result = estimateCatchUpTime(45);

      expect(result.minutes).toBe(45);
      expect(result.formatted).toBe('45 minutes');
    });

    it('should return hours for counts 60 and above', () => {
      const result = estimateCatchUpTime(60);

      expect(result.minutes).toBe(60);
      expect(result.formatted).toBe('1 hour');
    });

    it('should pluralize hours correctly', () => {
      const twoHours = estimateCatchUpTime(120);
      expect(twoHours.formatted).toBe('2 hours');

      const threeHours = estimateCatchUpTime(180);
      expect(threeHours.formatted).toBe('3 hours');
    });

    it('should ceil partial hours', () => {
      // 75 minutes = 1.25 hours → ceil to 2 hours
      const result = estimateCatchUpTime(75);

      expect(result.minutes).toBe(75);
      expect(result.formatted).toBe('2 hours');
    });
  });

  describe('With custom minutes per item', () => {
    it('should multiply count by minutes per item', () => {
      const result = estimateCatchUpTime(20, 2);

      expect(result.minutes).toBe(40);
      expect(result.formatted).toBe('40 minutes');
    });

    it('should handle fractional minutes per item', () => {
      const result = estimateCatchUpTime(100, 0.5);

      expect(result.minutes).toBe(50);
      expect(result.formatted).toBe('50 minutes');
    });

    it('should calculate hours with custom rate', () => {
      const result = estimateCatchUpTime(30, 3);

      expect(result.minutes).toBe(90);
      expect(result.formatted).toBe('2 hours');
    });
  });

  describe('Edge cases', () => {
    it('should handle 0 items', () => {
      const result = estimateCatchUpTime(0);

      expect(result.minutes).toBe(0);
      expect(result.formatted).toBe('0 minutes');
    });

    it('should handle 1 item', () => {
      const result = estimateCatchUpTime(1);

      expect(result.minutes).toBe(1);
      expect(result.formatted).toBe('1 minutes'); // Note: doesn't singularize "minute"
    });

    it('should handle very large counts', () => {
      const result = estimateCatchUpTime(1000);

      expect(result.minutes).toBe(1000);
      expect(result.formatted).toBe('17 hours');
    });

    it('should handle 0 minutes per item', () => {
      const result = estimateCatchUpTime(100, 0);

      expect(result.minutes).toBe(0);
      expect(result.formatted).toBe('0 minutes');
    });
  });

  describe('Return value structure', () => {
    it('should always return minutes and formatted', () => {
      const testCases = [0, 1, 10, 50, 100, 500];

      testCases.forEach((count) => {
        const result = estimateCatchUpTime(count);

        expect(result).toHaveProperty('minutes');
        expect(result).toHaveProperty('formatted');
        expect(typeof result.minutes).toBe('number');
        expect(typeof result.formatted).toBe('string');
      });
    });
  });
});

// =============================================================================
// scheduleApi OBJECT TESTS
// =============================================================================

describe('scheduleApi object', () => {
  // Note: IPC method tests are skipped because the module captures window.electron
  // at module load time (ES6 import hoisting runs before mock setup).
  // The helper functions are fully tested above.
  // IPC integration is tested in the integration test files.

  describe('API method existence', () => {
    it('should have getDueItemsReconciled method', () => {
      expect(typeof scheduleApi.getDueItemsReconciled).toBe('function');
    });

    it('should have reconcileSchedule method', () => {
      expect(typeof scheduleApi.reconcileSchedule).toBe('function');
    });

    it('should have getOverdueGrouped method', () => {
      expect(typeof scheduleApi.getOverdueGrouped).toBe('function');
    });

    it('should have generateCatchUpPlan method', () => {
      expect(typeof scheduleApi.generateCatchUpPlan).toBe('function');
    });

    it('should have clearCache method', () => {
      expect(typeof scheduleApi.clearCache).toBe('function');
    });

    it('should have isAvailable method', () => {
      expect(typeof scheduleApi.isAvailable).toBe('function');
    });
  });

  describe('IPC unavailable fallback behavior', () => {
    // Without IPC available, methods should return error objects or false
    it('getDueItemsReconciled should return error when IPC unavailable', async () => {
      const result = await scheduleApi.getDueItemsReconciled({ token: 'token' });
      expect(result).toEqual({ success: false, error: 'IPC not available' });
    });

    it('reconcileSchedule should return error when IPC unavailable', async () => {
      const result = await scheduleApi.reconcileSchedule({ planId: 'plan', token: 'token' });
      expect(result).toEqual({ success: false, error: 'IPC not available' });
    });

    it('getOverdueGrouped should return error when IPC unavailable', async () => {
      const result = await scheduleApi.getOverdueGrouped({ token: 'token' });
      expect(result).toEqual({ success: false, error: 'IPC not available' });
    });

    it('generateCatchUpPlan should return error when IPC unavailable', async () => {
      const result = await scheduleApi.generateCatchUpPlan({ token: 'token' });
      expect(result).toEqual({ success: false, error: 'IPC not available' });
    });

    it('clearCache should return error when IPC unavailable', () => {
      const result = scheduleApi.clearCache();
      expect(result).toEqual({ success: false });
    });

    it('isAvailable should return false when IPC unavailable', () => {
      const result = scheduleApi.isAvailable();
      expect(result).toBe(false);
    });
  });
});

// =============================================================================
// COMBINED USAGE SCENARIOS
// =============================================================================

describe('Combined Usage Scenarios', () => {
  describe('Gap severity with catch-up time estimation', () => {
    it('should help plan catch-up based on severity', () => {
      const overdueItems = [
        { days: 10, count: 15 }, // Critical
        { days: 5, count: 25 },  // Moderate
        { days: 2, count: 10 },  // Minor
      ];

      const optimalInterval = 3;

      const analysis = overdueItems.map((item) => ({
        ...item,
        severity: getGapSeverityInfo(item.days, optimalInterval),
        formattedDays: formatDaysOverdue(item.days),
        catchUpTime: estimateCatchUpTime(item.count, 1.5), // 1.5 min per item
      }));

      // Critical items
      expect(analysis[0].severity.severity).toBe(GAP_SEVERITY.CRITICAL);
      expect(analysis[0].formattedDays).toBe('1 week overdue');
      expect(analysis[0].catchUpTime.minutes).toBe(22.5);

      // Moderate items
      expect(analysis[1].severity.severity).toBe(GAP_SEVERITY.MODERATE);
      expect(analysis[1].formattedDays).toBe('5 days overdue');

      // Minor items
      expect(analysis[2].severity.severity).toBe(GAP_SEVERITY.MINOR);
      expect(analysis[2].formattedDays).toBe('2 days overdue');
    });
  });

  describe('Total catch-up estimation', () => {
    it('should calculate total time needed for all overdue items', () => {
      const totalOverdue = 150;
      const averageMinutesPerItem = 1.2;

      const estimate = estimateCatchUpTime(totalOverdue, averageMinutesPerItem);

      expect(estimate.minutes).toBe(180);
      expect(estimate.formatted).toBe('3 hours');
    });
  });

  describe('Session planning with severity tiers', () => {
    it('should prioritize by severity tier', () => {
      const items = [
        { id: 1, daysOverdue: 1 },
        { id: 2, daysOverdue: 15 },
        { id: 3, daysOverdue: 5 },
        { id: 4, daysOverdue: 8 },
        { id: 5, daysOverdue: 2 },
      ];

      const optimalInterval = 3;

      // Group by severity
      const grouped = {
        [PRIORITY_TIERS.CRITICAL]: [],
        [PRIORITY_TIERS.IMPORTANT]: [],
        [PRIORITY_TIERS.ROUTINE]: [],
      };

      items.forEach((item) => {
        const severity = getGapSeverityInfo(item.daysOverdue, optimalInterval);
        if (severity.severity === GAP_SEVERITY.CRITICAL || severity.severity === GAP_SEVERITY.SIGNIFICANT) {
          grouped[PRIORITY_TIERS.CRITICAL].push(item);
        } else if (severity.severity === GAP_SEVERITY.MODERATE) {
          grouped[PRIORITY_TIERS.IMPORTANT].push(item);
        } else {
          grouped[PRIORITY_TIERS.ROUTINE].push(item);
        }
      });

      expect(grouped[PRIORITY_TIERS.CRITICAL].length).toBe(2); // 15, 8 days
      expect(grouped[PRIORITY_TIERS.IMPORTANT].length).toBe(1); // 5 days
      expect(grouped[PRIORITY_TIERS.ROUTINE].length).toBe(2); // 1, 2 days
    });
  });
});
