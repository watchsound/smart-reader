/* eslint-disable react/require-default-props */
/* eslint-disable prettier/prettier */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Chip,
  IconButton,
  CircularProgress,
  Collapse,
  Tooltip,
  Switch,
  FormControlLabel,
  Divider,
} from '@mui/material';
import { styled, useTheme, alpha } from '@mui/material/styles';

// Icons
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LinkIcon from '@mui/icons-material/Link';
import HubIcon from '@mui/icons-material/Hub';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PersonIcon from '@mui/icons-material/Person';
import PlaceIcon from '@mui/icons-material/Place';
import EventIcon from '@mui/icons-material/Event';
import BusinessIcon from '@mui/icons-material/Business';
import CategoryIcon from '@mui/icons-material/Category';

import graphApi from '../../api/graphApi';

// Types
interface ConceptNode {
  id: string;
  name: string;
  type: string;
  level?: number;
  isRoot?: boolean;
  sourcePhrase?: string;
  selected?: boolean;
}

interface ConceptEdge {
  from: string;
  to: string;
  relation: string;
  type: string;
  selected?: boolean;
}

interface ExistingConcept {
  id: string;
  name: string;
  mastery: number;
  type: string;
}

interface RelationshipSuggestion {
  type: string;
  newConcept: string;
  existingConcept: string;
  existingConceptId: string;
  suggestedRelation: string;
  confidence: number;
}

interface ExtractionResult {
  title: string;
  nodes: ConceptNode[];
  edges: ConceptEdge[];
  existingConcepts: ExistingConcept[];
  suggestions: RelationshipSuggestion[];
}

interface ConceptReviewPanelProps {
  text: string;
  onExtracted?: (result: ExtractionResult) => void;
  onSave?: (nodes: ConceptNode[], edges: ConceptEdge[]) => void;
  autoExtract?: boolean;
  compact?: boolean;
}

// Color palette for concept types (matching bookmark style)
const CONCEPT_COLORS = {
  person: { bg: '#FCE4EC', accent: '#E91E63', icon: '#AD1457' },
  concept: { bg: '#E3F2FD', accent: '#2196F3', icon: '#1565C0' },
  location: { bg: '#E8F5E9', accent: '#4CAF50', icon: '#2E7D32' },
  event: { bg: '#FFF3E0', accent: '#FF9800', icon: '#E65100' },
  organization: { bg: '#F3E5F5', accent: '#9C27B0', icon: '#6A1B9A' },
  object: { bg: '#ECEFF1', accent: '#607D8B', icon: '#455A64' },
};

const CONCEPT_COLORS_DARK = {
  person: { bg: '#2D1520', accent: '#E91E63', icon: '#F06292' },
  concept: { bg: '#0D2137', accent: '#2196F3', icon: '#64B5F6' },
  location: { bg: '#1B3A1B', accent: '#4CAF50', icon: '#81C784' },
  event: { bg: '#2D1B00', accent: '#FF9800', icon: '#FFB74D' },
  organization: { bg: '#2A1B2E', accent: '#9C27B0', icon: '#BA68C8' },
  object: { bg: '#263238', accent: '#607D8B', icon: '#90A4AE' },
};

// Get icon for concept type
function getIconForType(type: string) {
  const icons: Record<string, React.ElementType> = {
    person: PersonIcon,
    location: PlaceIcon,
    event: EventIcon,
    organization: BusinessIcon,
    concept: HubIcon,
    object: CategoryIcon,
  };
  return icons[type] || HubIcon;
}

// Styled Components
const PanelContainer = styled(Box)(({ theme }) => ({
  background: theme.palette.background.paper,
  borderRadius: 12,
  border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  overflow: 'hidden',
  transition: 'all 0.2s ease',
  '&:hover': {
    boxShadow: theme.palette.mode === 'dark'
      ? `0 4px 20px ${alpha('#000', 0.4)}`
      : `0 4px 20px ${alpha('#000', 0.08)}`,
  },
}));

const PanelHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  background: alpha(theme.palette.primary.main, 0.04),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  position: 'relative',
  '&::before': {
    content: '""',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    background: `linear-gradient(180deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main || '#9C27B0'} 100%)`,
    borderRadius: '12px 0 0 0',
  },
}));

const PanelBody = styled(Box)(({ theme }) => ({
  padding: '16px',
  maxHeight: '320px',
  overflowY: 'auto',
  '&::-webkit-scrollbar': {
    width: 6,
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    background: alpha(theme.palette.text.primary, 0.15),
    borderRadius: 3,
    '&:hover': {
      background: alpha(theme.palette.text.primary, 0.25),
    },
  },
}));

const Section = styled(Box)(() => ({
  marginBottom: 16,
  '&:last-child': {
    marginBottom: 0,
  },
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: '0.7rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: theme.palette.text.disabled,
  marginBottom: 10,
}));

const ConceptChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'conceptType' && prop !== 'isSelected' && prop !== 'colorPalette',
})<{ conceptType?: string; isSelected?: boolean; colorPalette?: typeof CONCEPT_COLORS }>(
  ({ conceptType, isSelected, colorPalette }) => {
    const colors = colorPalette || CONCEPT_COLORS;
    const typeColors = colors[conceptType as keyof typeof colors] || colors.concept;

    return {
      height: 28,
      fontSize: '0.75rem',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      backgroundColor: typeColors.bg,
      border: isSelected
        ? `2px solid ${typeColors.accent}`
        : `1px solid ${typeColors.accent}40`,
      color: typeColors.icon,
      opacity: isSelected === false ? 0.5 : 1,
      '&:hover': {
        backgroundColor: typeColors.bg,
        transform: 'translateY(-1px)',
        boxShadow: `0 2px 8px ${typeColors.accent}30`,
      },
      '& .MuiChip-icon': {
        color: typeColors.icon,
        marginLeft: 4,
      },
      '& .MuiChip-deleteIcon': {
        color: typeColors.icon,
        opacity: 0.7,
        '&:hover': {
          opacity: 1,
        },
      },
    };
  }
);

const RelationshipCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isSelected',
})<{ isSelected?: boolean }>(({ theme, isSelected }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 14px',
  background: alpha(theme.palette.text.primary, 0.02),
  borderRadius: 10,
  border: `1px solid ${isSelected ? alpha(theme.palette.success.main, 0.4) : alpha(theme.palette.divider, 0.08)}`,
  marginBottom: 8,
  transition: 'all 0.2s ease',
  cursor: 'pointer',
  opacity: isSelected === false ? 0.5 : 1,
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    background: isSelected ? theme.palette.success.main : alpha(theme.palette.primary.main, 0.3),
    borderRadius: '10px 0 0 10px',
    transition: 'all 0.2s ease',
  },
  '&:hover': {
    background: alpha(theme.palette.text.primary, 0.04),
    transform: 'translateX(2px)',
    '&::before': {
      background: theme.palette.primary.main,
    },
  },
  '&:last-child': {
    marginBottom: 0,
  },
}));

const ExistingConceptBadge = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 10px',
  background: alpha(theme.palette.success.main, 0.1),
  color: theme.palette.success.main,
  borderRadius: 6,
  fontSize: '0.7rem',
  fontWeight: 500,
  border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
  transition: 'all 0.15s ease',
  '&:hover': {
    background: alpha(theme.palette.success.main, 0.15),
  },
}));

const EmptyState = styled(Box)(() => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 32,
  textAlign: 'center',
}));

const EmptyStateIcon = styled(Box)(({ theme }) => ({
  width: 64,
  height: 64,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: alpha(theme.palette.primary.main, 0.08),
  marginBottom: 16,
}));

const LoadingOverlay = styled(Box)(() => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 40,
  gap: 16,
}));

const ActionButton = styled(IconButton)(() => ({
  borderRadius: 8,
  transition: 'all 0.15s ease',
  '&:hover': {
    transform: 'translateY(-1px)',
  },
}));

const QuickFilterChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'selected',
})<{ selected?: boolean }>(({ theme, selected }) => ({
  height: 26,
  fontSize: '0.7rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  backgroundColor: selected
    ? alpha(theme.palette.primary.main, 0.12)
    : 'transparent',
  border: `1px solid ${selected
    ? theme.palette.primary.main
    : alpha(theme.palette.divider, 0.3)}`,
  color: selected ? theme.palette.primary.main : theme.palette.text.secondary,
  '&:hover': {
    backgroundColor: selected
      ? alpha(theme.palette.primary.main, 0.16)
      : alpha(theme.palette.text.primary, 0.04),
  },
}));

function ConceptReviewPanel({
  text,
  onExtracted,
  onSave,
  autoExtract = false,
  compact = false,
}: ConceptReviewPanelProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const colorPalette = isDark ? CONCEPT_COLORS_DARK : CONCEPT_COLORS;

  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [extracted, setExtracted] = useState<ExtractionResult | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [selectedEdges, setSelectedEdges] = useState<Set<string>>(new Set());
  const [autoSave, setAutoSave] = useState(false);

  // Race guard: handleExtract is invoked from both the auto-extract
  // useEffect (when `text` changes) and from an explicit extract button.
  // A slow earlier AI extraction can land after a faster newer one and
  // overwrite the newly-selected nodes/edges with stale results.
  const extractGenRef = useRef(0);

  const handleExtract = useCallback(async () => {
    if (!text || text.length < 20) return;

    const myGen = extractGenRef.current + 1;
    extractGenRef.current = myGen;
    const isStale = () => myGen !== extractGenRef.current;

    setLoading(true);
    try {
      const result = await graphApi.aiFullExtraction(text);
      if (isStale()) return;
      setExtracted(result);

      // Select all nodes and edges by default
      const nodeIds = new Set(result.nodes?.map((n: ConceptNode) => n.id) || []);
      const edgeIds = new Set(
        result.edges?.map((e: ConceptEdge) => `${e.from}-${e.to}`) || []
      );
      setSelectedNodes(nodeIds);
      setSelectedEdges(edgeIds);

      if (onExtracted) {
        onExtracted(result);
      }
    } catch (error) {
      if (isStale()) return;
      // eslint-disable-next-line no-console
      console.error('Concept extraction failed:', error);
    } finally {
      if (!isStale()) {
        setLoading(false);
      }
    }
  }, [text, onExtracted]);

  // Auto-extract on mount if enabled
  useEffect(() => {
    if (autoExtract && text && text.length >= 50 && !extracted) {
      handleExtract();
    }
  }, [autoExtract, text, extracted, handleExtract]);

  const toggleNodeSelection = (nodeId: string) => {
    const newSet = new Set(selectedNodes);
    if (newSet.has(nodeId)) {
      newSet.delete(nodeId);
    } else {
      newSet.add(nodeId);
    }
    setSelectedNodes(newSet);
  };

  const toggleEdgeSelection = (from: string, to: string) => {
    const edgeId = `${from}-${to}`;
    const newSet = new Set(selectedEdges);
    if (newSet.has(edgeId)) {
      newSet.delete(edgeId);
    } else {
      newSet.add(edgeId);
    }
    setSelectedEdges(newSet);
  };

  const handleSave = () => {
    if (!extracted || !onSave) return;

    const selectedNodesList = extracted.nodes.filter((n) =>
      selectedNodes.has(n.id)
    );
    const selectedEdgesList = extracted.edges.filter((e) =>
      selectedEdges.has(`${e.from}-${e.to}`)
    );

    onSave(selectedNodesList, selectedEdgesList);
  };

  const selectAll = () => {
    if (!extracted) return;
    setSelectedNodes(new Set(extracted.nodes.map((n) => n.id)));
    setSelectedEdges(new Set(extracted.edges.map((e) => `${e.from}-${e.to}`)));
  };

  const deselectAll = () => {
    setSelectedNodes(new Set());
    setSelectedEdges(new Set());
  };

  if (!graphApi.isAIExtractionAvailable()) {
    return null;
  }

  return (
    <PanelContainer>
      <PanelHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: 1 }}>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(theme.palette.primary.main, 0.1),
            }}
          >
            <HubIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.875rem', lineHeight: 1.2 }}>
              Knowledge Extraction
            </Typography>
            {extracted && (
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.7rem' }}>
                {selectedNodes.size} of {extracted.nodes?.length || 0} concepts selected
              </Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {!extracted && !loading && (
            <Tooltip title="Extract concepts using AI">
              <ActionButton
                size="small"
                onClick={handleExtract}
                disabled={!text || text.length < 20}
                sx={{
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary?.main || '#9C27B0'})`,
                  color: '#fff',
                  px: 1.5,
                  '&:hover': {
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.9)}, ${alpha(theme.palette.secondary?.main || '#9C27B0', 0.9)})`,
                  },
                  '&:disabled': {
                    background: alpha(theme.palette.text.primary, 0.1),
                    color: alpha(theme.palette.text.primary, 0.3),
                  },
                }}
              >
                <AutoAwesomeIcon sx={{ fontSize: 16, mr: 0.5 }} />
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 600 }}>Extract</Typography>
              </ActionButton>
            </Tooltip>
          )}
          {extracted && (
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              sx={{
                color: theme.palette.text.secondary,
                transition: 'all 0.2s ease',
                transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              }}
            >
              <ExpandMoreIcon />
            </IconButton>
          )}
        </Box>
      </PanelHeader>

      <Collapse in={expanded}>
        <PanelBody>
          {loading && (
            <LoadingOverlay>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  position: 'relative',
                }}
              >
                <CircularProgress
                  size={56}
                  thickness={2}
                  sx={{
                    color: theme.palette.primary.main,
                    position: 'absolute',
                  }}
                />
                <AutoAwesomeIcon sx={{ fontSize: 24, color: theme.palette.primary.main }} />
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Analyzing content...
                </Typography>
                <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                  Extracting concepts and relationships
                </Typography>
              </Box>
            </LoadingOverlay>
          )}

          {!loading && !extracted && (
            <EmptyState>
              <EmptyStateIcon>
                <LightbulbIcon sx={{ fontSize: 28, color: theme.palette.primary.main, opacity: 0.7 }} />
              </EmptyStateIcon>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Ready to Extract
              </Typography>
              <Typography variant="body2" sx={{ color: theme.palette.text.secondary, maxWidth: 240, fontSize: '0.8rem' }}>
                Click the Extract button to identify concepts and relationships in your content
              </Typography>
            </EmptyState>
          )}

          {!loading && extracted && (
            <>
              {/* Title */}
              {extracted.title && (
                <Box
                  sx={{
                    mb: 2,
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                    borderLeft: `3px solid ${theme.palette.primary.main}`,
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 600,
                      color: theme.palette.text.primary,
                    }}
                  >
                    {extracted.title}
                  </Typography>
                </Box>
              )}

              {/* Existing Concepts */}
              {extracted.existingConcepts?.length > 0 && (
                <Section>
                  <SectionTitle>
                    <CheckCircleOutlineIcon sx={{ fontSize: 12, color: theme.palette.success.main }} />
                    Already in Knowledge Graph
                  </SectionTitle>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {extracted.existingConcepts.map((concept) => (
                      <ExistingConceptBadge key={concept.id}>
                        <CheckCircleIcon sx={{ fontSize: 10 }} />
                        {concept.name}
                      </ExistingConceptBadge>
                    ))}
                  </Box>
                </Section>
              )}

              {/* New Concepts */}
              {extracted.nodes?.length > 0 && (
                <Section>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                    <SectionTitle sx={{ mb: 0 }}>
                      <AutoAwesomeIcon sx={{ fontSize: 12 }} />
                      Extracted Concepts
                    </SectionTitle>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <QuickFilterChip
                        label="All"
                        size="small"
                        selected={selectedNodes.size === extracted.nodes.length}
                        onClick={selectAll}
                      />
                      <QuickFilterChip
                        label="None"
                        size="small"
                        selected={selectedNodes.size === 0}
                        onClick={deselectAll}
                      />
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {extracted.nodes.map((node) => {
                      const IconComp = getIconForType(node.type);
                      return (
                        <ConceptChip
                          key={node.id}
                          icon={<IconComp sx={{ fontSize: '14px !important' }} />}
                          label={node.name}
                          conceptType={node.type}
                          colorPalette={colorPalette}
                          isSelected={selectedNodes.has(node.id)}
                          onClick={() => toggleNodeSelection(node.id)}
                          size="small"
                        />
                      );
                    })}
                  </Box>
                </Section>
              )}

              {/* Relationships */}
              {extracted.edges?.length > 0 && (
                <Section>
                  <SectionTitle>
                    <LinkIcon sx={{ fontSize: 12 }} />
                    Relationships ({selectedEdges.size}/{extracted.edges.length})
                  </SectionTitle>
                  {extracted.edges.slice(0, compact ? 3 : 6).map((edge) => {
                    const fromNode = extracted.nodes.find((n) => n.id === edge.from);
                    const toNode = extracted.nodes.find((n) => n.id === edge.to);
                    const edgeId = `${edge.from}-${edge.to}`;
                    const isSelected = selectedEdges.has(edgeId);
                    const fromColors = colorPalette[fromNode?.type as keyof typeof colorPalette] || colorPalette.concept;
                    const toColors = colorPalette[toNode?.type as keyof typeof colorPalette] || colorPalette.concept;

                    return (
                      <RelationshipCard
                        key={edgeId}
                        isSelected={isSelected}
                        onClick={() => toggleEdgeSelection(edge.from, edge.to)}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            px: 1,
                            py: 0.5,
                            bgcolor: fromColors.bg,
                            borderRadius: 1,
                            border: `1px solid ${fromColors.accent}40`,
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{ fontSize: '0.75rem', fontWeight: 600, color: fromColors.icon }}
                          >
                            {fromNode?.name || edge.from}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            px: 1.5,
                            py: 0.5,
                            background: alpha(theme.palette.text.primary, 0.06),
                            borderRadius: 1,
                            fontSize: '0.65rem',
                            fontWeight: 500,
                            color: theme.palette.text.secondary,
                            textTransform: 'lowercase',
                          }}
                        >
                          {edge.relation}
                        </Box>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            px: 1,
                            py: 0.5,
                            bgcolor: toColors.bg,
                            borderRadius: 1,
                            border: `1px solid ${toColors.accent}40`,
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{ fontSize: '0.75rem', fontWeight: 600, color: toColors.icon }}
                          >
                            {toNode?.name || edge.to}
                          </Typography>
                        </Box>
                        {isSelected && (
                          <CheckCircleIcon
                            sx={{
                              fontSize: 14,
                              color: theme.palette.success.main,
                              ml: 'auto',
                            }}
                          />
                        )}
                      </RelationshipCard>
                    );
                  })}
                  {extracted.edges.length > (compact ? 3 : 6) && (
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        textAlign: 'center',
                        color: theme.palette.text.disabled,
                        mt: 1,
                      }}
                    >
                      +{extracted.edges.length - (compact ? 3 : 6)} more relationships
                    </Typography>
                  )}
                </Section>
              )}

              {/* Suggestions */}
              {extracted.suggestions?.length > 0 && (
                <Section>
                  <SectionTitle>
                    <InfoOutlinedIcon sx={{ fontSize: 12 }} />
                    Suggested Links
                  </SectionTitle>
                  {extracted.suggestions.slice(0, 3).map((suggestion) => (
                    <Box
                      key={`${suggestion.newConcept}-${suggestion.existingConcept}`}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 1.5,
                        background: alpha(theme.palette.warning.main, 0.08),
                        borderRadius: 2,
                        mb: 1,
                        border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                        transition: 'all 0.15s ease',
                        cursor: 'pointer',
                        '&:hover': {
                          background: alpha(theme.palette.warning.main, 0.12),
                          transform: 'translateX(2px)',
                        },
                        '&:last-child': {
                          mb: 0,
                        },
                      }}
                    >
                      <LightbulbIcon
                        sx={{
                          fontSize: 16,
                          color: theme.palette.warning.main,
                          flexShrink: 0,
                        }}
                      />
                      <Typography variant="body2" sx={{ fontSize: '0.75rem', flex: 1 }}>
                        Link <strong>{suggestion.newConcept}</strong> to existing{' '}
                        <strong>{suggestion.existingConcept}</strong>
                      </Typography>
                      <LinkIcon
                        sx={{
                          fontSize: 14,
                          color: theme.palette.text.disabled,
                        }}
                      />
                    </Box>
                  ))}
                </Section>
              )}

              <Divider sx={{ my: 2, borderColor: alpha(theme.palette.divider, 0.08) }} />

              {/* Actions */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 1,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.text.primary, 0.02),
                }}
              >
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={autoSave}
                      onChange={(e) => setAutoSave(e.target.checked)}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: theme.palette.success.main,
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: theme.palette.success.main,
                        },
                      }}
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>
                      Auto-save to graph
                    </Typography>
                  }
                  sx={{ m: 0 }}
                />
                {onSave && (
                  <Tooltip title={selectedNodes.size > 0 ? `Save ${selectedNodes.size} concepts to knowledge graph` : 'Select concepts to save'}>
                    <span>
                      <ActionButton
                        size="small"
                        onClick={handleSave}
                        disabled={selectedNodes.size === 0}
                        sx={{
                          background: selectedNodes.size > 0
                            ? `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.primary.main})`
                            : alpha(theme.palette.text.primary, 0.1),
                          color: '#fff',
                          px: 2,
                          '&:hover': {
                            background: selectedNodes.size > 0
                              ? `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.9)}, ${alpha(theme.palette.primary.main, 0.9)})`
                              : alpha(theme.palette.text.primary, 0.1),
                          },
                          '&:disabled': {
                            color: alpha(theme.palette.text.primary, 0.3),
                          },
                        }}
                      >
                        <CheckCircleIcon sx={{ fontSize: 16, mr: 0.5 }} />
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
                          Save
                        </Typography>
                      </ActionButton>
                    </span>
                  </Tooltip>
                )}
              </Box>
            </>
          )}
        </PanelBody>
      </Collapse>
    </PanelContainer>
  );
}

export default ConceptReviewPanel;
