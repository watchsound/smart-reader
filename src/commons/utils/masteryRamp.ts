import type { LearningDomain } from '../model/LearningPointDomains';

export const MASTERY_BANDS = [
  { range: [0, 19], alpha: 0.06, glow: false },
  { range: [20, 39], alpha: 0.15, glow: false },
  { range: [40, 59], alpha: 0.28, glow: false },
  { range: [60, 79], alpha: 0.45, glow: false },
  { range: [80, 100], alpha: 0.62, glow: true },
] as const;

const DOMAIN_HEX: Record<LearningDomain, string> = {
  vocabulary: '#3b82f6',
  knowledge: '#8b5cf6',
  math: '#ef4444',
  reading: '#f59e0b',
  language: '#10b981',
  skill: '#06b6d4',
  programming: '#6366f1',
  physics: '#dc2626',
  chemistry: '#16a34a',
  biology: '#22c55e',
  history: '#a16207',
  geography: '#0891b2',
  custom: '#64748b',
};

function hexToRgb(hex: string) {
  const m = hex.replace('#', '');
  return {
    r: parseInt(m.slice(0, 2), 16),
    g: parseInt(m.slice(2, 4), 16),
    b: parseInt(m.slice(4, 6), 16),
  };
}

export function getMasteryBand(
  domain: LearningDomain | undefined,
  level: number | undefined,
) {
  const hex = (domain && DOMAIN_HEX[domain]) || DOMAIN_HEX.custom;
  if (level == null) {
    return {
      bandIndex: 0,
      tint: 'rgba(100,100,100,0.04)',
      glow: false,
      accent: hex,
    };
  }
  const bandIndex = MASTERY_BANDS.findIndex(
    (b) => level >= b.range[0] && level <= b.range[1],
  );
  const safe = bandIndex < 0 ? 0 : bandIndex;
  const { alpha, glow } = MASTERY_BANDS[safe];
  const { r, g, b } = hexToRgb(hex);
  return {
    bandIndex: safe,
    tint: `rgba(${r},${g},${b},${alpha})`,
    glow,
    accent: hex,
  };
}
