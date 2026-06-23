import type { MindmapData, MindmapNodeData } from '../../../commons/model/MindmapData';

interface LegacyNode {
  id: string;
  data?: { label?: string; detail?: string };
  position?: { x: number; y: number };
}
interface LegacyEdge {
  id?: string;
  source: string;
  target: string;
  label?: string;
}
interface LegacyMindmap {
  width?: number;
  height?: number;
  nodes: LegacyNode[];
  edges: LegacyEdge[];
}

export function legacyToCanonical(legacy: LegacyMindmap, fallbackId: string): MindmapData {
  const nodes = legacy.nodes ?? [];
  const edges = legacy.edges ?? [];

  if (nodes.length === 0) {
    return { id: fallbackId, title: '', rootId: '', nodes: [], edges: [] };
  }

  const parentOf = new Map<string, string>();
  edges.forEach((e) => parentOf.set(e.target, e.source));

  const childrenOf = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!childrenOf.has(e.source)) childrenOf.set(e.source, []);
    childrenOf.get(e.source)!.push(e.target);
  });

  const rootId = nodes.find((n) => !parentOf.has(n.id))?.id ?? nodes[0].id;

  const levelOf = new Map<string, number>([[rootId, 0]]);
  const queue: string[] = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    const lvl = levelOf.get(id)!;
    (childrenOf.get(id) ?? []).forEach((c) => {
      if (!levelOf.has(c)) {
        levelOf.set(c, lvl + 1);
        queue.push(c);
      }
    });
  }

  const canonicalNodes = nodes.map((n) => {
    const data: MindmapNodeData = {
      text: n.data?.label ?? '',
      detail: n.data?.detail,
      level: levelOf.get(n.id) ?? 1,
      parentId: parentOf.get(n.id) ?? (n.id === rootId ? null : rootId),
    };
    return { id: n.id, data };
  });

  const canonicalEdges = edges.map((e, i) => ({
    id: e.id ?? `e${i}`,
    source: e.source,
    target: e.target,
    data: e.label ? { relation: e.label } : undefined,
  }));

  return {
    id: fallbackId,
    title: canonicalNodes.find((n) => n.id === rootId)?.data.text ?? '',
    rootId,
    nodes: canonicalNodes,
    edges: canonicalEdges,
  };
}
