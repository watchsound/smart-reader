import type { LearningDomain } from './LearningPointDomains';

export const MINDMAP_NODE_TYPES = ['concept', 'person', 'place', 'event', 'object'] as const;
export type MindmapNodeType = (typeof MINDMAP_NODE_TYPES)[number];

export const MINDMAP_LAYOUTS = ['right-tree', 'radial'] as const;
export type MindmapLayout = (typeof MINDMAP_LAYOUTS)[number];

export interface MindmapNodeData {
  text: string;
  detail?: string;
  sourcePhrase?: string;
  type?: MindmapNodeType;
  domain?: LearningDomain;
  level: number;
  parentId?: string | null;
  collapsed?: boolean;
  learningPointId?: string;
  masteryLevel?: number;
}

export interface MindmapEdgeData {
  relation?: string;
}

export interface MindmapData {
  id: string;
  title: string;
  bookId?: string;
  sourceTextHash?: string;
  rootId: string;
  nodes: Array<{ id: string; data: MindmapNodeData }>;
  edges: Array<{ id: string; source: string; target: string; data?: MindmapEdgeData }>;
  layout?: MindmapLayout;
}

const LIVE_WRITABLE: ReadonlyArray<LearningDomain> = [
  'vocabulary', 'knowledge', 'math', 'reading', 'language', 'skill',
];

export function coerceToLiveDomain(d: LearningDomain | undefined): LearningDomain {
  if (d && LIVE_WRITABLE.includes(d)) return d;
  return 'knowledge';
}
