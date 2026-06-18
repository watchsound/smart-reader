/**
 * triggerToCell — map a Trigger to a `{ featureSurface, currentBox, domain }`
 * cell for the Phase 14a Predictive Engine. Returns `null` for Triggers whose
 * source has no causally-meaningful surface or whose payload lacks the
 * `learning_point` context needed to pick `currentBox` and `domain`.
 *
 * Phase 14b spec: docs/superpowers/specs/2026-06-18-phase-14b-roi-ranked-queue-design.md
 *
 * Adding a new Trigger source = add a case below. This is the single source of
 * truth for the source → surface mapping.
 */

function pickLp(payload) {
  if (!payload) return null;
  // Some payloads embed the lp object; others just an id (no DB lookup here —
  // we degrade gracefully if only the id is available, since the renderer
  // doesn't synchronously read SQLite).
  if (payload.learningPoint && typeof payload.learningPoint === 'object') {
    return payload.learningPoint;
  }
  return null;
}

function cellFromLp(lp, fallback) {
  if (!lp) return fallback;
  const box = typeof lp.box === 'number' ? lp.box : (fallback && fallback.currentBox);
  const domain = lp.domain_type || lp.domainType || (fallback && fallback.domain);
  if (!box || !domain) return fallback;
  return { ...fallback, currentBox: box, domain };
}

function triggerToCell(trigger) {
  if (!trigger || !trigger.source) return null;
  const { source, payload = {} } = trigger;
  const lp = pickLp(payload);

  switch (source) {
    case 'production-prompt-schedule': {
      const cell = cellFromLp(lp, { featureSurface: 'production-prompt' });
      return cell && cell.currentBox && cell.domain ? cell : null;
    }
    case 'reread-queue-schedule': {
      const cell = cellFromLp(lp, { featureSurface: 'pre-reading-diagnostic' });
      return cell && cell.currentBox && cell.domain ? cell : null;
    }
    case 'learning-path-plan': {
      // Phase 7 doesn't carry an lp; degrade to null. Future: pass first
      // book's top concept through the trigger payload.
      return null;
    }
    case 'director-session-step':
    case 'director-session': {
      const cell = cellFromLp(lp, { featureSurface: 'director-session' });
      return cell && cell.currentBox && cell.domain ? cell : null;
    }
    case 'organize-cluster':
    case 'mood-board-organize-suggest':
    default:
      // Organize and unmapped sources have no per-event mastery move.
      return null;
  }
}

module.exports = { triggerToCell };
