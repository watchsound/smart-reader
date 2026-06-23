import { getMasteryBand, MASTERY_BANDS } from '../../commons/utils/masteryRamp';

describe('getMasteryBand', () => {
  it('returns band 0 (faint) for unlinked nodes', () => {
    const b = getMasteryBand('knowledge', undefined);
    expect(b.bandIndex).toBe(0);
    expect(b.tint).toMatch(/rgba|#/);
  });
  it('returns band 0 for mastery 0-19', () => {
    expect(getMasteryBand('knowledge', 0).bandIndex).toBe(0);
    expect(getMasteryBand('knowledge', 19).bandIndex).toBe(0);
  });
  it('returns band 4 for mastery 80-100', () => {
    expect(getMasteryBand('knowledge', 80).bandIndex).toBe(4);
    expect(getMasteryBand('knowledge', 100).bandIndex).toBe(4);
  });
  it('exposes 5 bands', () => {
    expect(MASTERY_BANDS).toHaveLength(5);
  });
});
