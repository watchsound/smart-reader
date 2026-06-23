/* eslint-disable react/require-default-props */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { Box } from '@mui/material';
import { MindNode, MindNodeRuntimeData } from './nodes/MindNode';
import { MindRootNode } from './nodes/MindRootNode';
import { SaveConceptsBar } from './SaveConceptsBar';
import { useMindmapLayout } from './hooks/useMindmapLayout';
import { legacyToCanonical } from '../../../commons/utils/content/mindmapMigration';
import * as mindmapApi from '../../api/mindmapApi';
import type { MindmapData } from '../../../commons/model/MindmapData';

const NODE_TYPES = { mind: MindNode, mindRoot: MindRootNode };

interface Props {
  data: MindmapData | any;
  mode?: 'inline' | 'expanded' | 'card';
  bookId?: string;
  readOnly?: boolean;
  onNodeClick?: (nodeId: string, lpId?: string) => void;
}

const MODE_SIZE: Record<
  NonNullable<Props['mode']>,
  { width: string | number; height: string | number }
> = {
  inline: { width: '100%', height: 240 },
  card: { width: 360, height: 260 },
  expanded: { width: '100%', height: '70vh' },
};

function looksLegacy(d: any): boolean {
  return (
    !!d?.nodes?.[0]?.data &&
    'label' in d.nodes[0].data &&
    !('text' in d.nodes[0].data)
  );
}

export default function MindmapSurface({
  data: rawData,
  mode = 'inline',
  bookId,
  readOnly,
  onNodeClick,
}: Props) {
  const navigate = useNavigate();
  const data: MindmapData = useMemo(
    () =>
      looksLegacy(rawData)
        ? legacyToCanonical(rawData, rawData?.id ?? `m-${Date.now()}`)
        : rawData,
    [rawData],
  );

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [mastery, setMastery] = useState<Record<string, number>>({});
  const [linkedIds, setLinkedIds] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      data.nodes
        .filter((n) => n.data.learningPointId)
        .map((n) => [n.id, n.data.learningPointId!]),
    ),
  );
  const [barDismissed, setBarDismissed] = useState(
    () => localStorage.getItem(`mindmap:${data.id}:dismissed`) === '1',
  );

  // Mastery hydration: on mount + on window focus.
  useEffect(() => {
    let cancelled = false;
    const fetchMastery = async () => {
      const lpIds = Object.values(linkedIds);
      if (lpIds.length === 0) return;
      const snap = await mindmapApi.masterySnapshot({ lpIds });
      if (!cancelled) setMastery(snap || {});
    };
    fetchMastery();
    window.addEventListener('focus', fetchMastery);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', fetchMastery);
    };
  }, [linkedIds]);

  const childrenOf = useMemo(() => {
    const m = new Map<string, string[]>();
    data.edges.forEach((e) => {
      if (!m.has(e.source)) m.set(e.source, []);
      m.get(e.source)!.push(e.target);
    });
    return m;
  }, [data.edges]);

  const visibleIds = useMemo(() => {
    const hidden = new Set<string>();
    const walk = (id: string) => {
      if (collapsed.has(id)) {
        (childrenOf.get(id) ?? []).forEach((c) => {
          hidden.add(c);
          walk(c);
        });
      } else {
        (childrenOf.get(id) ?? []).forEach(walk);
      }
    };
    walk(data.rootId);
    return new Set(data.nodes.map((n) => n.id).filter((id) => !hidden.has(id)));
  }, [data.nodes, data.rootId, collapsed, childrenOf]);

  const { positioned } = useMindmapLayout(data, visibleIds);

  const handleActivate = useCallback(
    (nodeId: string, lpId?: string) => {
      if (onNodeClick) {
        onNodeClick(nodeId, lpId);
        return;
      }
      if (lpId) {
        navigate(
          `/study?lpId=${encodeURIComponent(lpId)}&source=mindmap&mindmapId=${encodeURIComponent(data.id)}`,
        );
      }
    },
    [onNodeClick, navigate, data.id],
  );

  const handleToggleCollapse = useCallback((nodeId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const rfNodes = useMemo(() => {
    const posMap = new Map(positioned.map((p) => [p.id, p.position]));
    return data.nodes
      .filter((n) => visibleIds.has(n.id))
      .map((n) => {
        const lpId = linkedIds[n.id];
        const runtime: MindNodeRuntimeData = {
          ...n.data,
          learningPointId: lpId,
          masteryLevel: lpId ? mastery[lpId] : undefined,
          childCount: (childrenOf.get(n.id) ?? []).length,
          isCollapsed: collapsed.has(n.id),
          onActivate: handleActivate,
          onToggleCollapse: handleToggleCollapse,
        };
        return {
          id: n.id,
          type: n.id === data.rootId ? 'mindRoot' : 'mind',
          position: posMap.get(n.id) ?? { x: 0, y: 0 },
          data: runtime,
        };
      });
  }, [
    data.nodes,
    data.rootId,
    visibleIds,
    positioned,
    linkedIds,
    mastery,
    collapsed,
    childrenOf,
    handleActivate,
    handleToggleCollapse,
  ]);

  const rfEdges = useMemo(
    () =>
      data.edges
        .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
        .map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.data?.relation,
        })),
    [data.edges, visibleIds],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes as any);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges as any);
  useEffect(() => setNodes(rfNodes as any), [rfNodes, setNodes]);
  useEffect(() => setEdges(rfEdges as any), [rfEdges, setEdges]);

  const unsavedNodeIds = useMemo(
    () => data.nodes.filter((n) => !linkedIds[n.id]).map((n) => n.id),
    [data.nodes, linkedIds],
  );
  const showBar = !readOnly && !barDismissed && unsavedNodeIds.length > 0;

  const handleSave = async (nodeIds: string[]) => {
    const nodesToSave = data.nodes
      .filter((n) => nodeIds.includes(n.id))
      .map((n) => ({ id: n.id, data: n.data }));
    const res = await mindmapApi.saveAsLearningPoints({
      mindmapId: data.id,
      bookId,
      nodes: nodesToSave,
    });
    const newLinks = { ...linkedIds };
    nodesToSave.forEach((n, i) => {
      const lpId = res?.lpIds?.[i];
      if (lpId) newLinks[n.id] = lpId;
    });
    setLinkedIds(newLinks);
  };

  const handleDismiss = () => {
    localStorage.setItem(`mindmap:${data.id}:dismissed`, '1');
    setBarDismissed(true);
  };

  const size = MODE_SIZE[mode];

  return (
    <Box
      sx={{
        width: size.width,
        height: size.height,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {showBar && (
        <SaveConceptsBar
          data={data}
          unsavedNodeIds={unsavedNodeIds}
          onSave={handleSave}
          onDismiss={handleDismiss}
        />
      )}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES as any}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          nodesDraggable={mode === 'expanded' && !readOnly}
          panOnDrag
          zoomOnScroll
        >
          <Background />
          {mode === 'expanded' && <Controls />}
          {mode === 'expanded' && <MiniMap pannable zoomable />}
        </ReactFlow>
      </Box>
    </Box>
  );
}
