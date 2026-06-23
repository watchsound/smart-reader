/* eslint-disable no-restricted-globals */
// Web Worker entrypoint - `self` is the canonical worker global scope.
import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

self.addEventListener('message', async (e: MessageEvent) => {
  const { id, graph } = e.data as { id: string; graph: any };
  try {
    const result = await elk.layout(graph);
    (self as unknown as Worker).postMessage({ id, ok: true, result });
  } catch (err: any) {
    (self as unknown as Worker).postMessage({
      id,
      ok: false,
      error: err?.message ?? String(err),
    });
  }
});
