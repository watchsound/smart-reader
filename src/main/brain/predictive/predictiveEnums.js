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

// Phase 14d: nominal time-per-event for the Budget Session Planner. Hardcoded
// constants for v1; v2 may switch to a measured estimate from learning_session
// duration data. Seconds.
// Phase 15b — anomaly detection thresholds. Hardcoded for v1; surfaced
// in one place so tuning needs only one edit. All windows in days; all
// monetary thresholds in USD.
const ANOMALY = Object.freeze({
  MASTERY_REGRESSION_DROP: 10,       // points lost
  MASTERY_REGRESSION_WINDOW_DAYS: 7,
  ZERO_ROI_SPEND_USD: 0.05,          // intent burned this much…
  ZERO_ROI_WINDOW_DAYS: 7,           // …with zero mastery moves in window
  PROVIDER_ERROR_RATE_THRESHOLD: 0.20,
  PROVIDER_ERROR_WINDOW_HOURS: 24,
  PROVIDER_ERROR_MIN_CALLS: 5,       // ignore providers with too few calls
  STALLED_CONCEPT_DAYS: 14,
  STALLED_CONCEPT_MASTERY_MAX: 80,
  ACK_TTL_DAYS: 7,                   // muted-anomaly silence window
});

const TIME_PER_EVENT_SEC = Object.freeze({
  'production-prompt': 180,
  'comprehension': 120,
  'pre-reading-diagnostic': 60,
  'director-session': 30,
  'reading-microcard': 10,
});
const DEFAULT_TIME_PER_EVENT_SEC = 60;

module.exports = {
  SHRINKAGE_LEVELS,
  KAPPA_0,
  ALPHA_0,
  BETA_0,
  EXCLUDED_SURFACES,
  COVERAGE_MIN_N,
  REFRESH_INTERVAL_MS,
  DEFAULT_WINDOW_DAYS,
  TIME_PER_EVENT_SEC,
  DEFAULT_TIME_PER_EVENT_SEC,
  ANOMALY,
};
