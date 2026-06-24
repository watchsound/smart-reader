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
    'elk.spacing.nodeNode': '50',
    // elk.spacing.nodeNodeBetweenLayers is the generic ELK option for inter-level
    // gap; mrtree respects it. The old elk.layered.* variant is layered-only and
    // was silently ignored by mrtree, giving zero horizontal level separation.
    'elk.spacing.nodeNodeBetweenLayers': '120',
  },
  radial: {
    'elk.algorithm': 'radial',
    'elk.spacing.nodeNode': '50',
  },
};

// eslint-disable-next-line import/prefer-default-export
export function useMindmapLayout(data: MindmapData, visibleIds: Set<string>) {
  const [positioned, setPositioned] = useState<PositionedNode[]>([]);
  const [layoutVersion, setLayoutVersion] = useState(0);
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
      .map((n) => {
        // Match actual CSS bounds:
        //   MindRootNode — minWidth 160, maxWidth 260, two-line title + subtitle
        //   MindNode     — minWidth 120, maxWidth 220, 2-line clamped body text
        // Use each type's upper-bound width and a height that covers 2-line text
        // plus padding so ELK never allocates less space than the real DOM needs.
        const isRoot = n.id === data.rootId;
        return { id: n.id, width: isRoot ? 260 : 220, height: isRoot ? 80 : 64 };
      });
    const edges = data.edges
      .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] }));
    return {
      id: 'root',
      layoutOptions: ELK_OPTIONS[data.layout ?? 'right-tree'],
      children: nodes,
      edges,
    };
  }, [data.nodes, data.edges, data.layout, data.rootId, visibleIds]);

  useEffect(() => {
    if (!workerRef.current) return undefined;
    reqId.current += 1;
    const myId = reqId.current;
    const visibleNodes = data.nodes.filter((n) => visibleIds.has(n.id));

    const applyFallback = () => {
      const lvlGroups = new Map<number, string[]>();
      visibleNodes.forEach((n) => {
        const lvl = n.data.level ?? 0;
        if (!lvlGroups.has(lvl)) lvlGroups.set(lvl, []);
        lvlGroups.get(lvl)!.push(n.id);
      });
      const fb: PositionedNode[] = [];
      lvlGroups.forEach((ids, level) => {
        ids.forEach((id, idx) => {
          fb.push({
            id,
            position: {
              // 260 (max node width) + 120 (inter-level gap) = 380 per level;
              // 64 (node height) + 50 (sibling gap) = 114 per row.
              x: level * 380,
              y: (idx - (ids.length - 1) / 2) * 114,
            },
          });
        });
      });
      setPositioned(fb);
    };

    // Seed positions synchronously from the level field so the first render
    // never stacks every node at (0, 0) while ELK is computing. ELK's async
    // result replaces these positions and bumps layoutVersion.
    applyFallback();
    setLayoutVersion((v) => v + 1);

    setIsLayouting(true);
    const handler = (e: MessageEvent) => {
      if (e.data.id !== String(myId)) return;
      setIsLayouting(false);
      if (e.data.ok) {
        const children = e.data.result.children ?? [];
        // Guard against ELK returning all (0, 0) — happens with disconnected
        // graphs or empty edge sets. Keep the seeded fallback in that case.
        const allAtOrigin =
          children.length > 1 &&
          children.every((n: any) => (n.x ?? 0) === 0 && (n.y ?? 0) === 0);
        if (!allAtOrigin) {
          setPositioned(
            children.map((n: any) => ({
              id: n.id,
              position: { x: n.x ?? 0, y: n.y ?? 0 },
            })),
          );
        }
        setLayoutVersion((v) => v + 1);
      } else {
        console.error('[mindmap] ELK layout failed:', e.data.error);
        applyFallback();
        setLayoutVersion((v) => v + 1);
      }
    };

    const errorHandler = () => {
      setIsLayouting(false);
      applyFallback();
    };

    workerRef.current.addEventListener('message', handler);
    workerRef.current.addEventListener('error', errorHandler);
    workerRef.current.postMessage({ id: String(myId), graph });
    return () => {
      workerRef.current?.removeEventListener('message', handler);
      workerRef.current?.removeEventListener('error', errorHandler);
    };
  }, [graph, data.nodes, visibleIds]);

  return { positioned, layoutVersion, isLayouting };
}
