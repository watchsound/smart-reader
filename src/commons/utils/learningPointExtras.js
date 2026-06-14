/**
 * learningPointExtras — typed read/write helpers for the `extras` JSON
 * column on the `learning_point` table.
 *
 * Eliminates hand-rolled `JSON.parse(row.extras)` / `JSON.stringify(...)`
 * boilerplate from callers, and gives a per-domain getter that returns
 * the typed shape declared in LearningPointDomains.ts.
 *
 * The schema permits any JSON in `extras`, so these helpers never throw on
 * malformed legacy data — they return an empty object instead. Callers that
 * need strict validation should layer it on top.
 */

/**
 * Parse the raw extras value off a row (might be a string, an object, or null).
 * Always returns a plain object.
 */
export function parseExtras(rawExtras) {
  if (!rawExtras) return {};
  if (typeof rawExtras === 'object') return rawExtras;
  if (typeof rawExtras !== 'string') return {};
  try {
    const parsed = JSON.parse(rawExtras);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (_err) {
    return {};
  }
}

/**
 * Serialize extras to a JSON string suitable for the SQLite `extras` column.
 * Returns null when there's nothing to store (so the column stays NULL).
 */
export function serializeExtras(extras) {
  if (!extras || typeof extras !== 'object') return null;
  const keys = Object.keys(extras);
  if (keys.length === 0) return null;
  try {
    return JSON.stringify(extras);
  } catch (_err) {
    return null;
  }
}

/**
 * Get the domain-scoped slice of extras. Today `extras` is a flat object —
 * the per-domain shape lives at the top level (e.g. `extras.snippet`,
 * `extras.definitionLatex`). This helper returns the whole extras object
 * so callers can pull the fields relevant to their domain.
 *
 * Identical to `parseExtras` today — exposed under a domain-suggestive
 * name so callers signal intent (and so per-domain validation can be added
 * here later without changing call sites).
 *
 * @param {Object|string|null} rawExtras
 * @returns {Object}
 */
export function getDomainExtras(rawExtras) {
  return parseExtras(rawExtras);
}

/**
 * Merge new domain-specific fields into existing extras without losing
 * unrelated keys. Returns the merged object (not the serialized string —
 * call serializeExtras() before writing to SQLite).
 */
export function mergeExtras(existing, additions) {
  const base = parseExtras(existing);
  if (!additions || typeof additions !== 'object') return base;
  return { ...base, ...additions };
}

/**
 * Check whether a row's extras has at least one of the named fields populated.
 * Useful for "is this row already domain-enriched?" gates.
 */
export function hasAnyExtrasField(rawExtras, fieldNames = []) {
  const obj = parseExtras(rawExtras);
  return fieldNames.some(
    (f) => obj[f] !== undefined && obj[f] !== null && obj[f] !== '',
  );
}
