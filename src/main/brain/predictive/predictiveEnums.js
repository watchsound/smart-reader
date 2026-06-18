const SHRINKAGE_LEVELS = Object.freeze({
  CELL: 'cell',
  SURFACE_BOX: 'surface-box',
  SURFACE: 'surface',
  GLOBAL: 'global',
});

const KAPPA_0 = 4;
const ALPHA_0 = 2;
const BETA_0 = 2;

const EXCLUDED_SURFACES = Object.freeze(['unknown', 'backfill']);

const COVERAGE_MIN_N = 10;
const REFRESH_INTERVAL_MS = 24 * 3600 * 1000;
const DEFAULT_WINDOW_DAYS = 30;

module.exports = {
  SHRINKAGE_LEVELS,
  KAPPA_0,
  ALPHA_0,
  BETA_0,
  EXCLUDED_SURFACES,
  COVERAGE_MIN_N,
  REFRESH_INTERVAL_MS,
  DEFAULT_WINDOW_DAYS,
};
