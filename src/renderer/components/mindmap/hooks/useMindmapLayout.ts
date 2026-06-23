import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  MindmapData,
  MindmapLayout,
} from '../../../../commons/model/MindmapData';

interface PositionedNode {
  id: string;
  position: { x: number; y: number };
}

const ELK_OPTIONS: Record<MindmapLayout, Record<string, string>> = {
  'right-tree': {
    'elk.algorithm': 'mrtree',
    'elk.direction': 'RIGHT',
    'elk.spacing.nodeNode': '60',
    'elk.layered.spacing.nodeNodeBetweenLayers': '100',
  },
  radial: {
    'elk.algorithm': 'radial',
    'elk.spacing.nodeNode': '50',
  },
};

// eslint-disable-next-line import/prefer-default-export
export function useMindmapLayout(data: MindmapData, visibleIds: Set<string>) {
  const [positioned, setPositioned] = useState<PositionedNode[]>([]);
  const [isLayouting, setIsLayouting] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    // Project tsconfig uses module:"node16" with no package.json "type":"module",
    // so .ts files are treated as CommonJS and TS forbids import.meta. Webpack 5
    // still parses `new Worker(new URL(..., import.meta.url))` as the worker
    // chunk request at bundle time, which is the canonical webpack 5 pattern.
    workerRef.current = new Worker(
      // @ts-expect-error - import.meta.url is processed by webpack 5 native worker support
      new URL('../layout/elk.worker.ts', import.meta.url),
    );
    return () => workerRef.current?.terminate();
  }, []);

  const graph = useMemo(() => {
    const nodes = data.nodes
      .filter((n) => visibleIds.has(n.id))
      .map((n) => ({ id: n.id, width: 200, height: 60 }));
    const edges = data.edges
      .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] }));
    return {
      id: 'root',
      layoutOptions: ELK_OPTIONS[data.layout ?? 'right-tree'],
      children: nodes,
      edges,
    };
  }, [data.nodes, data.edges, data.layout, visibleIds]);

  useEffect(() => {
    if (!workerRef.current) return undefined;
    reqId.current += 1;
    const myId = reqId.current;
    setIsLayouting(true);
    const handler = (e: MessageEvent) => {
      if (e.data.id !== String(myId)) return;
      setIsLayouting(false);
      if (e.data.ok) {
        setPositioned(
          (e.data.result.children ?? []).map((n: any) => ({
            id: n.id,
            position: { x: n.x ?? 0, y: n.y ?? 0 },
          })),
        );
      }
    };
    workerRef.current.addEventListener('message', handler);
    workerRef.current.postMessage({ id: String(myId), graph });
    return () => workerRef.current?.removeEventListener('message', handler);
  }, [graph]);

  return { positioned, isLayouting };
}
