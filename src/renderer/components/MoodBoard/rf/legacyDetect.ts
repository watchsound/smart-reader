// Detects storm (react-diagrams) boards so we can offer a reset prompt
// instead of silently rendering nothing or crashing.
// Storm boards always have a `layers` array; new RF boards always have `rfVersion`.
export function isLegacyStormJson(diagram: unknown): boolean {
  if (!diagram || typeof diagram !== 'object') return false;
  const d = diagram as Record<string, unknown>;
  return !d.rfVersion && (Array.isArray(d.layers) || typeof d.id === 'string');
}
