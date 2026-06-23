// Jest mock — prevents import.meta.url SyntaxError in CommonJS mode.
// The real hook uses new Worker(new URL(..., import.meta.url)) which webpack 5
// processes at bundle time but ts-jest (CJS) cannot parse as a syntax node.
export function useMindmapLayout() {
  return { positioned: [], isLayouting: false };
}
