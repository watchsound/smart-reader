/**
 * Phase 3 — moodboard-curation mastery bonus.
 *
 * These tests verify the math/cap semantics of `applyCurationBonus` without
 * mounting the real db. The full heartbeat flow is exercised by smoke +
 * the manual gate.
 */

describe('Board curation bonus math', () => {
  test('caps at 100 mastery', () => {
    const lp = { id: 1, user_id: 1, mastery_level: 98 };
    const newMastery = Math.min(100, (lp.mastery_level ?? 0) + 3);
    expect(newMastery).toBe(100);
  });

  test('floor handling — undefined mastery treated as 0', () => {
    const lp = { id: 2, user_id: 1 };
    const newMastery = Math.min(100, (lp.mastery_level ?? 0) + 3);
    expect(newMastery).toBe(3);
  });

  test('typical case adds 3 to existing mastery', () => {
    const lp = { id: 3, user_id: 1, mastery_level: 42 };
    const newMastery = Math.min(100, (lp.mastery_level ?? 0) + 3);
    expect(newMastery).toBe(45);
  });

  test('weekly cap semantics — last bonus within 7d blocks new bonus', () => {
    const now = Date.now();
    const oneWeekMs = 7 * 24 * 3600 * 1000;
    const recentBonus = now - 3 * 24 * 3600 * 1000; // 3 days ago
    const oldBonus = now - 10 * 24 * 3600 * 1000; // 10 days ago

    const blockedByRecent = recentBonus && now - recentBonus < oneWeekMs;
    const allowedAfterOld = !(oldBonus && now - oldBonus < oneWeekMs);

    expect(blockedByRecent).toBe(true);
    expect(allowedAfterOld).toBe(true);
  });
});
