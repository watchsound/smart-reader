/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  type Node,
  type Edge,
  type OnConnect,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/base.css';
import { useSelector, useDispatch } from 'react-redux';
import { useTheme, alpha, styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import SaveIcon from '@mui/icons-material/Save';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import PanToolIcon from '@mui/icons-material/PanTool';
import NearMeIcon from '@mui/icons-material/NearMe';
import ImageIcon from '@mui/icons-material/Image';
import TitleIcon from '@mui/icons-material/Title';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';

import { NoteNode } from './nodes/NoteNode';
import { StickyNode } from './nodes/StickyNode';
import { ImageNode } from './nodes/ImageNode';
import { HeadingNode } from './nodes/HeadingNode';
import { RelationEdge } from './edges/RelationEdge';
import { isLegacyStormJson } from './legacyDetect';
import NoteDetailModal from '../../note/NoteDetailModal';

// ---------------------------------------------------------------------------
// Inline theme types
// ---------------------------------------------------------------------------
export type PaletteId = 'warm-roman' | 'cold-noir' | 'austere-mono' | 'golden-vellum' | 'paper-and-ink' | 'custom';
export interface Palette { accent: string; bg: string; ink: string; muted: string; }
export interface BoardTheme {
  paletteId: PaletteId;
  customPalette?: Palette;
  fontFamily?: string;
  backgroundLayer?: { mode: 'none' | 'image' | 'pattern'; imageAssetId?: string; patternKey?: string; opacity?: number };
}
export interface ColorZone { id: string; color: string; opacity: number; x: number; y: number; width: number; height: number; label?: string; }
const PALETTES: Record<Exclude<PaletteId, 'custom'>, Palette> = {
  'warm-roman':    { accent: '#b85c38', bg: '#f6ecd9', ink: '#3a2618', muted: '#8a6b4d' },
  'cold-noir':     { accent: '#5a9bd5', bg: '#1a1f2b', ink: '#e8eef4', muted: '#8a93a4' },
  'austere-mono':  { accent: '#444444', bg: '#f4f4f4', ink: '#1a1a1a', muted: '#777777' },
  'golden-vellum': { accent: '#c79a4b', bg: '#fdf6e3', ink: '#3b3225', muted: '#9c8569' },
  'paper-and-ink': { accent: '#2c3e50', bg: '#fafaf6', ink: '#1c2b3a', muted: '#6c7a89' },
};
export const DEFAULT_BOARD_THEME: BoardTheme = { paletteId: 'paper-and-ink' };
function resolvePalette(theme: BoardTheme): Palette {
  if (theme.paletteId === 'custom' && theme.customPalette) return theme.customPalette;
  return PALETTES[(theme.paletteId as Exclude<PaletteId, 'custom'>) in PALETTES ? theme.paletteId as Exclude<PaletteId, 'custom'> : 'paper-and-ink'];
}
import { updateMoodBoard } from '../../../api/moodBoardApi';
import {
  noteAdded,
  moodBoardUpdated,
  diagramNoteHandled,
} from '../../../store/reducers/moodBoardSlice';
import spineApi from '../../../api/spineApi';
import { createMoodBoardLayoutPrompt } from '../../../../commons/utils/AIPrompts';
import { getNoteById } from '../../../api/notesApi';
import store from '../../../store/store';

// ---------------------------------------------------------------------------
// Node / edge type registries — module-level so RF never remounts nodes
// ---------------------------------------------------------------------------
const NODE_TYPES = {
  mbNote:    NoteNode,
  mbSticky:  StickyNode,
  mbImage:   ImageNode,
  mbHeading: HeadingNode,
};
const EDGE_TYPES = { mbRelation: RelationEdge };

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------
export interface RFBoardJson {
  rfVersion: 1;
  nodes: Node[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };
  theme: BoardTheme;
  colorZones: ColorZone[];
}

function deserializeBoard(diagram: unknown) {
  const empty = {
    nodes: [] as Node[],
    edges: [] as Edge[],
    viewport: null as { x: number; y: number; zoom: number } | null,
    theme: DEFAULT_BOARD_THEME,
    colorZones: [] as ColorZone[],
    isLegacy: false,
  };
  if (!diagram || typeof diagram !== 'object') return empty;
  if (isLegacyStormJson(diagram)) return { ...empty, isLegacy: true };
  const d = diagram as Partial<RFBoardJson>;
  if (d.rfVersion !== 1) return empty;
  return {
    nodes: d.nodes ?? [],
    edges: d.edges ?? [],
    viewport: d.viewport ?? null,
    theme: d.theme ?? DEFAULT_BOARD_THEME,
    colorZones: d.colorZones ?? [],
    isLegacy: false,
  };
}

function makeNoteNode(note: any): Node {
  return {
    id: `note-${note.id}-${Date.now()}`,
    type: 'mbNote',
    position: { x: 250 + Math.random() * 60, y: 300 + Math.random() * 60 },
    style: { width: 220, height: 160 },
    data: { noteId: note.id },
  };
}

// ---------------------------------------------------------------------------
// Styled toolbar
// ---------------------------------------------------------------------------
const ToolbarContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  padding: '5px 12px',
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  gap: theme.spacing(0.5),
  flexShrink: 0,
}));

const ToolbarSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.spacing(0.5),
}));

const ToolbarButton = styled(IconButton, {
  shouldForwardProp: (p) => p !== 'isActive',
})<{ isActive?: boolean }>(({ theme, isActive }) => ({
  width: 30,
  height: 30,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: isActive
    ? alpha(theme.palette.primary.main, 0.12)
    : 'transparent',
  color: isActive
    ? theme.palette.primary.main
    : theme.palette.text.secondary,
  '&:hover': {
    backgroundColor: isActive
      ? alpha(theme.palette.primary.main, 0.18)
      : alpha(theme.palette.text.primary, 0.05),
  },
}));

const ToolbarDivider = styled(Divider)(() => ({
  height: 22,
  alignSelf: 'center',
  margin: '0 3px',
}));

const AddButton = styled(Button)(({ theme }) => ({
  height: 28,
  fontSize: '0.72rem',
  fontWeight: 500,
  textTransform: 'none',
  borderRadius: theme.shape.borderRadius,
  padding: '3px 10px',
  minWidth: 'auto',
  gap: 4,
}));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface CurMoodBoard {
  id: number;
  name?: string;
  pinned?: boolean;
  diagram?: Record<string, unknown> | null;
}
interface Props { curMoodBoard: CurMoodBoard; }

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function MoodBoardCanvas({ curMoodBoard }: Props) {
  const theme = useTheme();
  const dispatch = useDispatch();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [boardTheme, setBoardTheme] = useState<BoardTheme>(DEFAULT_BOARD_THEME);
  const [colorZones, setColorZones] = useState<ColorZone[]>([]);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [inProcess, setInProcess] = useState(false);
  const [openNoteModal, setOpenNoteModal] = useState(false);
  const [curNote, setCurNote] = useState<any>(null);
  // Hand tool mode — when true, left-drag pans instead of selecting
  const [panMode, setPanMode] = useState(false);

  const rfRef = useRef<ReactFlowInstance | null>(null);

  // Redux
  const addedNote = useSelector((s: any) => s.moodBoard.addedNote);
  const curEditState = useSelector((s: any) => s.moodBoard.editState);
  const curDiagramNote = useSelector((s: any) => s.moodBoard.curDiagramNote);

  // Open note detail modal
  useEffect(() => {
    if (!curDiagramNote) return;
    setCurNote(curDiagramNote);
    setOpenNoteModal(true);
    dispatch(diagramNoteHandled(null));
  }, [curDiagramNote, dispatch]);

  // Load board
  useEffect(() => {
    if (!curMoodBoard) return;
    const { nodes: n, edges: e, viewport: vp, theme: t, colorZones: z, isLegacy } =
      deserializeBoard(curMoodBoard.diagram ?? null);

    if (isLegacy) { setShowResetDialog(true); return; }

    const pending = (store.getState() as any).moodBoard?.addedNote;
    setNodes(pending ? [...n, makeNoteNode(pending)] : n);
    setEdges(e);
    setBoardTheme(t);
    setColorZones(z);
    if (pending) dispatch(noteAdded(null));
    if (vp) setTimeout(() => rfRef.current?.setViewport(vp), 50);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [curMoodBoard?.id]);

  // Live note additions
  useEffect(() => {
    if (!addedNote) return;
    const currentPending = (store.getState() as any).moodBoard?.addedNote;
    if (!currentPending) return;
    setNodes((prev) => [...prev, makeNoteNode(addedNote)]);
    dispatch(noteAdded(null));
  }, [addedNote, dispatch]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const onConnect: OnConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge(
          { ...params, type: 'mbRelation', data: { relationType: 'supports' } },
          eds,
        ),
      ),
    [setEdges],
  );

  const onSave = useCallback(async () => {
    const rf = rfRef.current;
    const vp = rf?.getViewport() ?? { x: 0, y: 0, zoom: 1 };
    const allNodes = rf?.getNodes() ?? nodes;
    const allEdges = rf?.getEdges() ?? edges;
    const payload: RFBoardJson = {
      rfVersion: 1,
      nodes: allNodes,
      edges: allEdges,
      viewport: vp,
      theme: boardTheme,
      colorZones,
    };
    const updated = await updateMoodBoard(
      curMoodBoard.id,
      'react_diagram',
      JSON.stringify(payload),
    );
    if (updated) dispatch(moodBoardUpdated(updated));
  }, [nodes, edges, boardTheme, colorZones, curMoodBoard?.id, dispatch]);

  const addSticky = useCallback(() => {
    const offset = nodes.filter((n) => n.type === 'mbSticky').length * 24;
    setNodes((prev) => [
      ...prev,
      {
        id: `sticky-${Date.now()}`,
        type: 'mbSticky',
        position: { x: 180 + offset, y: 180 + offset },
        style: { width: 160, height: 140 },
        data: { text: '', color: '#FFF9C4' },
      },
    ]);
  }, [nodes, setNodes]);

  const addImage = useCallback(() => {
    const offset = nodes.filter((n) => n.type === 'mbImage').length * 24;
    setNodes((prev) => [
      ...prev,
      {
        id: `image-${Date.now()}`,
        type: 'mbImage',
        position: { x: 400 + offset, y: 180 + offset },
        style: { width: 220, height: 200 },
        data: { url: '', caption: '' },
      },
    ]);
  }, [nodes, setNodes]);

  const addHeading = useCallback(() => {
    const offset = nodes.filter((n) => n.type === 'mbHeading').length * 30;
    setNodes((prev) => [
      ...prev,
      {
        id: `heading-${Date.now()}`,
        type: 'mbHeading',
        position: { x: 140 + offset, y: 100 + offset },
        data: { text: '', level: 'h2' },
      },
    ]);
  }, [nodes, setNodes]);

  const createLayoutByAI = useCallback(async () => {
    if (inProcess) return;
    setInProcess(true);
    try {
      const noteNodes = (rfRef.current?.getNodes() ?? nodes).filter(
        (n) => n.type === 'mbNote',
      );
      if (noteNodes.length === 0) return;

      const noteContents = await Promise.all(
        noteNodes.map(async (n) => {
          try {
            const result = await getNoteById(n.data.noteId as number);
            return result?.note ?? null;
          } catch { return null; }
        }),
      );

      let notesList = '';
      noteContents.forEach((note, i) => {
        if (!note) return;
        const text = note.cards?.[0]?.text ?? note.title ?? '';
        notesList += `${i + 1}. ${text}\n`;
      });
      if (!notesList) return;

      const rf = rfRef.current;
      const vp = rf?.getViewport();
      const w = vp ? Math.round(800 / vp.zoom) : 800;
      const h = vp ? Math.round(600 / vp.zoom) : 600;

      const layoutJson = await spineApi.generateContentWithJson(
        createMoodBoardLayoutPrompt(w, h, notesList),
        null,
        { label: 'moodboard-diagram-layout' },
      );
      if (!layoutJson?.layout) return;

      const others = (rfRef.current?.getNodes() ?? nodes).filter(
        (n) => n.type !== 'mbNote',
      );
      setNodes([
        ...others,
        ...layoutJson.layout.map((item: any, i: number) => {
          const orig = noteNodes[item.cardIndex - 1] ?? noteNodes[i];
          return {
            id: orig?.id ?? `note-ai-${i}`,
            type: 'mbNote',
            position: { x: item.x, y: item.y },
            style: { width: item.width, height: item.height },
            data: orig?.data ?? { noteId: 0 },
          } as Node;
        }),
      ]);
    } catch (e) {
      console.error('AI layout failed:', e);
    } finally {
      setInProcess(false);
    }
  }, [inProcess, nodes, setNodes]);

  const handleResetBoard = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setBoardTheme(DEFAULT_BOARD_THEME);
    setColorZones([]);
    setShowResetDialog(false);
    const payload: RFBoardJson = {
      rfVersion: 1,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      theme: DEFAULT_BOARD_THEME,
      colorZones: [],
    };
    updateMoodBoard(curMoodBoard.id, 'react_diagram', JSON.stringify(payload)).then(
      (updated: any) => { if (updated) dispatch(moodBoardUpdated(updated)); },
    );
  }, [curMoodBoard?.id, dispatch]);

  // ---------------------------------------------------------------------------
  // Theme CSS vars
  // ---------------------------------------------------------------------------
  const palette = resolvePalette(boardTheme);
  const cssVars: CSSProperties = {
    '--mb-accent': palette.accent,
    '--mb-bg':     palette.bg,
    '--mb-ink':    palette.ink,
    '--mb-muted':  palette.muted,
  } as CSSProperties;

  // Dot color adapts to board background (dark boards get lighter dots)
  const isDarkBoard = boardTheme.paletteId === 'cold-noir';
  const dotColor = isDarkBoard ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
      style={cssVars}
    >
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <ToolbarContainer>
        {/* Left: tool mode + element creation */}
        <ToolbarSection>
          {/* Hand / Select toggle */}
          <Tooltip title={panMode ? 'Switch to Select (V)' : 'Switch to Pan (H)'}>
            <ToolbarButton
              isActive={panMode}
              onClick={() => setPanMode((m) => !m)}
              size="small"
            >
              {panMode
                ? <PanToolIcon sx={{ fontSize: 16 }} />
                : <NearMeIcon sx={{ fontSize: 16 }} />}
            </ToolbarButton>
          </Tooltip>

          <ToolbarDivider orientation="vertical" flexItem />

          {/* Add element buttons */}
          <Tooltip title="Add sticky note">
            <AddButton
              variant="outlined"
              onClick={addSticky}
              startIcon={<StickyNote2Icon sx={{ fontSize: 14 }} />}
              sx={{
                borderColor: alpha('#f59e0b', 0.45),
                color: '#b45309',
                '&:hover': { borderColor: '#f59e0b', bgcolor: alpha('#f59e0b', 0.05) },
              }}
            >
              Sticky
            </AddButton>
          </Tooltip>

          <Tooltip title="Add image card">
            <AddButton
              variant="outlined"
              onClick={addImage}
              startIcon={<ImageIcon sx={{ fontSize: 14 }} />}
              sx={{
                borderColor: alpha(theme.palette.info.main, 0.35),
                color: theme.palette.info.dark,
                '&:hover': { borderColor: theme.palette.info.main, bgcolor: alpha(theme.palette.info.main, 0.05) },
              }}
            >
              Image
            </AddButton>
          </Tooltip>

          <Tooltip title="Add section heading">
            <AddButton
              variant="outlined"
              onClick={addHeading}
              startIcon={<TitleIcon sx={{ fontSize: 14 }} />}
              sx={{
                borderColor: alpha(theme.palette.text.secondary, 0.25),
                color: theme.palette.text.secondary,
                '&:hover': { borderColor: theme.palette.text.secondary, bgcolor: alpha(theme.palette.text.primary, 0.04) },
              }}
            >
              Heading
            </AddButton>
          </Tooltip>
        </ToolbarSection>

        {/* Center: board name */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mx: 'auto' }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              color: theme.palette.text.primary,
              maxWidth: 220,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {curMoodBoard.name || 'Untitled Board'}
          </Typography>
          {curMoodBoard.pinned && (
            <Chip
              label="Pinned"
              size="small"
              sx={{ height: 18, fontSize: '0.6rem', bgcolor: alpha(theme.palette.warning.main, 0.1), color: theme.palette.warning.main }}
            />
          )}
        </Box>

        {/* Right: AI + Save */}
        <ToolbarSection>
          <Tooltip title="Auto-arrange with AI">
            <AddButton
              variant="outlined"
              startIcon={inProcess ? <CircularProgress size={12} /> : <AutoFixHighIcon sx={{ fontSize: 14 }} />}
              onClick={createLayoutByAI}
              disabled={inProcess}
              sx={{
                borderColor: alpha(theme.palette.primary.main, 0.3),
                color: theme.palette.primary.main,
                '&:hover': { borderColor: theme.palette.primary.main, bgcolor: alpha(theme.palette.primary.main, 0.05) },
              }}
            >
              {inProcess ? 'Thinking…' : 'AI Layout'}
            </AddButton>
          </Tooltip>

          <AddButton
            variant="contained"
            startIcon={<SaveIcon sx={{ fontSize: 14 }} />}
            onClick={onSave}
            sx={{ bgcolor: theme.palette.primary.main, '&:hover': { bgcolor: theme.palette.primary.dark } }}
          >
            Save
          </AddButton>
        </ToolbarSection>
      </ToolbarContainer>

      {/* ── Canvas ──────────────────────────────────────────────────────── */}
      <Box
        sx={{ flex: 1, minHeight: 0, position: 'relative' }}
        style={{ background: 'var(--mb-bg)' }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={(inst) => { rfRef.current = inst; }}
          connectionMode={ConnectionMode.Loose}
          nodesDraggable={curEditState}
          nodesConnectable={curEditState}
          elementsSelectable
          // Pan mode: left drag pans; Select mode: left drag lasso-selects, middle/right drag pans
          panOnDrag={panMode ? true : [1, 2]}
          selectionOnDrag={!panMode}
          // Space key temporarily activates pan regardless of mode
          panActivationKeyCode="Space"
          deleteKeyCode="Delete"
          fitView
          minZoom={0.1}
          maxZoom={3}
          style={{ background: 'transparent', width: '100%', height: '100%' }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1.5}
            color={dotColor}
          />
          <Controls />
          <MiniMap pannable zoomable nodeColor={() => palette.muted} />
        </ReactFlow>
      </Box>

      {openNoteModal && curNote && (
        <NoteDetailModal
          note={curNote}
          open
          callback={() => setOpenNoteModal(false)}
        />
      )}

      <Dialog open={showResetDialog} onClose={() => setShowResetDialog(false)}>
        <DialogTitle>Board format not compatible</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This board was saved with an older format and cannot be displayed.
            Reset it to start fresh, or keep it empty for now.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowResetDialog(false)}>Keep empty</Button>
          <Button variant="contained" onClick={handleResetBoard}>Reset board</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
