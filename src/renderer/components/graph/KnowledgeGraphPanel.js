/**
 * KnowledgeGraphPanel.js
 *
 * A professionally styled interactive knowledge graph visualization panel.
 * Features force-directed layout, smooth animations, glass-morphism design,
 * and intuitive pan/zoom controls for exploring concept relationships.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme, alpha } from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';

import HubIcon from '@mui/icons-material/Hub';
import RefreshIcon from '@mui/icons-material/Refresh';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import FilterListIcon from '@mui/icons-material/FilterList';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import ArticleIcon from '@mui/icons-material/Article';
import TranslateIcon from '@mui/icons-material/Translate';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import SchoolIcon from '@mui/icons-material/School';

import graphApi from '../../api/graphApi';
import customStorage from '../../store/customStorage';

// Mastery level colors - Light mode
const MASTERY_COLORS = {
  excellent: { fill: '#43A047', glow: 'rgba(67, 160, 71, 0.5)', label: 'Mastered' },
  good: { fill: '#1E88E5', glow: 'rgba(30, 136, 229, 0.5)', label: 'Good' },
  learning: { fill: '#FFA726', glow: 'rgba(255, 167, 38, 0.5)', label: 'Learning' },
  weak: { fill: '#EF5350', glow: 'rgba(239, 83, 80, 0.5)', label: 'Weak' },
};

// Dark mode mastery colors
const MASTERY_COLORS_DARK = {
  excellent: { fill: '#66BB6A', glow: 'rgba(102, 187, 106, 0.4)', label: 'Mastered' },
  good: { fill: '#42A5F5', glow: 'rgba(66, 165, 245, 0.4)', label: 'Good' },
  learning: { fill: '#FFB74D', glow: 'rgba(255, 183, 77, 0.4)', label: 'Learning' },
  weak: { fill: '#E57373', glow: 'rgba(229, 115, 115, 0.4)', label: 'Weak' },
};

// Node type styling
const NODE_TYPES = {
  Concept: { color: '#1E88E5', darkColor: '#42A5F5', icon: AccountTreeIcon, label: 'Concept' },
  Note: { color: '#43A047', darkColor: '#66BB6A', icon: ArticleIcon, label: 'Note' },
  Book: { color: '#8E24AA', darkColor: '#AB47BC', icon: AutoStoriesIcon, label: 'Book' },
  Vocabulary: { color: '#FFA726', darkColor: '#FFB74D', icon: TranslateIcon, label: 'Vocabulary' },
  default: { color: '#757575', darkColor: '#9E9E9E', icon: HubIcon, label: 'Node' },
};

// Filter options
const FILTER_OPTIONS = [
  { value: 'all', label: 'All Nodes', icon: HubIcon },
  { value: 'Concept', label: 'Concepts', icon: AccountTreeIcon },
  { value: 'Note', label: 'Notes', icon: ArticleIcon },
  { value: 'Book', label: 'Books', icon: AutoStoriesIcon },
  { value: 'Vocabulary', label: 'Vocabulary', icon: TranslateIcon },
];

const getMasteryLevel = (mastery) => {
  if (mastery >= 80) return 'excellent';
  if (mastery >= 60) return 'good';
  if (mastery >= 40) return 'learning';
  return 'weak';
};

export default function KnowledgeGraphPanel({
  centerConceptId = null,
  onNodeSelect,
  height = 400,
}) {
  const canvasRef = useRef(null);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState('all');

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const masteryColors = isDark ? MASTERY_COLORS_DARK : MASTERY_COLORS;

  const token = customStorage.getSessionToken();

  useEffect(() => {
    loadGraphData();
  }, [centerConceptId]);

  const loadGraphData = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await graphApi.getKnowledgeGraphData(centerConceptId, token);
      if (result) {
        const processedData = processGraphData(result);
        setGraphData(processedData);
      } else {
        setGraphData({ nodes: [], edges: [] });
      }
    } catch (e) {
      setError(e.message || 'Failed to load knowledge graph');
    } finally {
      setLoading(false);
    }
  };

  const processGraphData = (data) => {
    if (!data.nodes?.length) return { nodes: [], edges: [] };

    // Initialize node positions in a circle
    const nodes = data.nodes.map((node, i) => {
      const angle = (2 * Math.PI * i) / data.nodes.length;
      const radius = 120 + Math.random() * 60;
      return {
        ...node,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        radius: 10 + (node.masteryLevel || 50) / 12,
      };
    });

    // Force-directed layout simulation
    for (let iter = 0; iter < 50; iter++) {
      // Repulsion between nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 500 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          nodes[i].x -= fx;
          nodes[i].y -= fy;
          nodes[j].x += fx;
          nodes[j].y += fy;
        }
      }

      // Attraction along edges
      for (const edge of data.edges || []) {
        const source = nodes.find((n) => n.id === edge.source);
        const target = nodes.find((n) => n.id === edge.target);
        if (source && target) {
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - 80) * 0.01;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          source.x += fx;
          source.y += fy;
          target.x -= fx;
          target.y -= fy;
        }
      }

      // Center gravity
      for (const node of nodes) {
        node.x *= 0.99;
        node.y *= 0.99;
      }
    }

    return { nodes, edges: data.edges || [] };
  };

  const getFilteredData = useCallback(() => {
    if (filterType === 'all') return graphData;
    return {
      nodes: graphData.nodes.filter((n) => n.type === filterType),
      edges: graphData.edges.filter((e) => {
        const sourceNode = graphData.nodes.find((n) => n.id === e.source);
        const targetNode = graphData.nodes.find((n) => n.id === e.target);
        return sourceNode?.type === filterType || targetNode?.type === filterType;
      }),
    };
  }, [graphData, filterType]);

  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.2, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.2, 0.3));
  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleMouseDown = (e) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2 - offset.x) / zoom;
    const y = (e.clientY - rect.top - rect.height / 2 - offset.y) / zoom;

    const filteredData = getFilteredData();
    const hovered = filteredData.nodes.find((node) => {
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) < node.radius + 4;
    });
    setHoveredNode(hovered || null);

    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = () => {
    if (hoveredNode) {
      setSelectedNode(hoveredNode);
      if (onNodeSelect) {
        onNodeSelect(hoveredNode);
      }
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.3, Math.min(3, z * delta)));
  };

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const { width, height: canvasHeight } = rect;
    canvas.width = width * window.devicePixelRatio;
    canvas.height = canvasHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear with gradient background
    const bgGradient = ctx.createRadialGradient(
      width / 2,
      canvasHeight / 2,
      0,
      width / 2,
      canvasHeight / 2,
      Math.max(width, canvasHeight)
    );
    if (isDark) {
      bgGradient.addColorStop(0, 'rgba(30, 33, 38, 0.4)');
      bgGradient.addColorStop(1, 'rgba(20, 22, 26, 0.6)');
    } else {
      bgGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
      bgGradient.addColorStop(1, 'rgba(240, 242, 245, 0.8)');
    }
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, canvasHeight);

    // Transform
    ctx.save();
    ctx.translate(width / 2 + offset.x, canvasHeight / 2 + offset.y);
    ctx.scale(zoom, zoom);

    const filteredData = getFilteredData();

    // Draw edges with gradient
    for (const edge of filteredData.edges) {
      const source = filteredData.nodes.find((n) => n.id === edge.source);
      const target = filteredData.nodes.find((n) => n.id === edge.target);
      if (source && target) {
        const gradient = ctx.createLinearGradient(source.x, source.y, target.x, target.y);
        gradient.addColorStop(0, alpha(isDark ? '#fff' : '#000', 0.15));
        gradient.addColorStop(0.5, alpha(isDark ? '#fff' : '#000', 0.25));
        gradient.addColorStop(1, alpha(isDark ? '#fff' : '#000', 0.15));

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
      }
    }

    // Draw nodes
    for (const node of filteredData.nodes) {
      const isHovered = hoveredNode?.id === node.id;
      const isSelected = selectedNode?.id === node.id;
      const nodeType = NODE_TYPES[node.type] || NODE_TYPES.default;

      let fillColor;
      let glowColor;

      if (node.masteryLevel !== undefined) {
        const level = getMasteryLevel(node.masteryLevel);
        fillColor = masteryColors[level].fill;
        glowColor = masteryColors[level].glow;
      } else {
        fillColor = isDark ? nodeType.darkColor : nodeType.color;
        glowColor = alpha(fillColor, 0.5);
      }

      // Glow effect for hovered/selected
      if (isHovered || isSelected) {
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = isSelected ? 20 : 15;
      }

      // Node circle with gradient
      const nodeGradient = ctx.createRadialGradient(
        node.x - node.radius / 3,
        node.y - node.radius / 3,
        0,
        node.x,
        node.y,
        node.radius
      );
      nodeGradient.addColorStop(0, alpha(fillColor, 1));
      nodeGradient.addColorStop(1, alpha(fillColor, 0.7));

      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = nodeGradient;
      ctx.fill();

      // Border
      if (isHovered || isSelected) {
        ctx.strokeStyle = isSelected ? '#fff' : alpha('#fff', 0.8);
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.stroke();
      }

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      // Label
      if (zoom > 0.5 || isHovered || isSelected) {
        ctx.fillStyle = isDark ? '#E8E8E8' : '#333333';
        ctx.font = `${isHovered || isSelected ? 'bold ' : ''}${11 / Math.max(zoom, 0.7)}px "Lato", -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const label = node.name?.length > 14 ? node.name.substring(0, 12) + '...' : node.name;
        const labelY = node.y + node.radius + 14 / zoom;

        // Label background for readability
        const metrics = ctx.measureText(label || '');
        ctx.fillStyle = alpha(isDark ? '#1E2126' : '#fff', 0.85);
        ctx.fillRect(
          node.x - metrics.width / 2 - 4,
          labelY - 6,
          metrics.width + 8,
          14
        );

        ctx.fillStyle = isDark ? '#E8E8E8' : '#333333';
        ctx.fillText(label || '', node.x, labelY);
      }
    }

    ctx.restore();
  }, [graphData, zoom, offset, hoveredNode, selectedNode, filterType, getFilteredData, isDark, masteryColors]);

  // Loading state
  if (loading) {
    return (
      <Box
        sx={{
          borderRadius: '16px',
          background: isDark
            ? 'rgba(30, 33, 38, 0.85)'
            : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${alpha(isDark ? '#fff' : '#000', 0.08)}`,
          height,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress
            size={40}
            thickness={4}
            sx={{
              color: '#1E88E5',
              '& .MuiCircularProgress-circle': {
                strokeLinecap: 'round',
              },
            }}
          />
          <Typography
            variant="body2"
            sx={{ mt: 2, color: 'text.secondary', fontWeight: 500 }}
          >
            Loading knowledge graph...
          </Typography>
        </Box>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box
        sx={{
          borderRadius: '16px',
          background: isDark
            ? 'rgba(30, 33, 38, 0.85)'
            : 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${alpha('#E53935', 0.3)}`,
          height,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          p: 3,
        }}
      >
        <Box sx={{ textAlign: 'center' }}>
          <ErrorOutlineIcon
            sx={{ fontSize: 48, color: '#E53935', opacity: 0.8, mb: 2 }}
          />
          <Typography variant="body2" color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={loadGraphData}
            sx={{
              borderRadius: '20px',
              textTransform: 'none',
              borderColor: '#E53935',
              color: '#E53935',
              '&:hover': {
                borderColor: '#C62828',
                background: alpha('#E53935', 0.08),
              },
            }}
          >
            Try Again
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        borderRadius: '16px',
        background: isDark
          ? 'rgba(30, 33, 38, 0.85)'
          : 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${alpha(isDark ? '#fff' : '#000', 0.08)}`,
        overflow: 'hidden',
        boxShadow: isDark
          ? '0 4px 24px rgba(0, 0, 0, 0.4)'
          : '0 4px 24px rgba(0, 0, 0, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        height: height + 120,
      }}
    >
      {/* Header Section */}
      <Box
        sx={{
          p: 2,
          background: isDark
            ? 'linear-gradient(135deg, rgba(66, 165, 245, 0.12) 0%, rgba(102, 187, 106, 0.12) 100%)'
            : 'linear-gradient(135deg, rgba(30, 136, 229, 0.08) 0%, rgba(67, 160, 71, 0.08) 100%)',
          borderBottom: `1px solid ${alpha(isDark ? '#fff' : '#000', 0.06)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #1E88E5 0%, #43A047 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(30, 136, 229, 0.4)',
            }}
          >
            <HubIcon sx={{ color: 'white', fontSize: 22 }} />
          </Box>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, lineHeight: 1.2 }}
              >
                Knowledge Graph
              </Typography>
              <Box
                sx={{
                  px: 1,
                  py: 0.25,
                  borderRadius: '8px',
                  background: alpha(isDark ? '#42A5F5' : '#1E88E5', 0.15),
                  color: isDark ? '#42A5F5' : '#1E88E5',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}
              >
                {graphData.nodes.length} nodes
              </Box>
            </Box>
            <Typography variant="caption" color="text.secondary">
              Interactive concept visualization
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title={showFilters ? 'Hide filters' : 'Show filters'}>
            <IconButton
              size="small"
              onClick={() => setShowFilters(!showFilters)}
              sx={{
                background: showFilters
                  ? alpha(isDark ? '#42A5F5' : '#1E88E5', 0.2)
                  : alpha(isDark ? '#fff' : '#000', 0.05),
                color: showFilters ? (isDark ? '#42A5F5' : '#1E88E5') : 'inherit',
                '&:hover': {
                  background: alpha(isDark ? '#42A5F5' : '#1E88E5', 0.15),
                },
                transition: 'all 0.2s ease',
              }}
            >
              <FilterListIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh graph">
            <IconButton
              size="small"
              onClick={loadGraphData}
              sx={{
                background: alpha(isDark ? '#fff' : '#000', 0.05),
                '&:hover': {
                  background: alpha(isDark ? '#fff' : '#000', 0.1),
                  transform: 'rotate(180deg)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Filters Bar */}
      {showFilters && (
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            p: 1.5,
            borderBottom: `1px solid ${alpha(isDark ? '#fff' : '#000', 0.06)}`,
            overflowX: 'auto',
            animation: 'slideDown 0.2s ease',
            '@keyframes slideDown': {
              from: { opacity: 0, maxHeight: 0 },
              to: { opacity: 1, maxHeight: 60 },
            },
          }}
        >
          {FILTER_OPTIONS.map((option) => {
            const FilterIcon = option.icon;
            const isActive = filterType === option.value;
            const typeStyle = NODE_TYPES[option.value] || NODE_TYPES.default;
            const optionColor = isDark ? typeStyle.darkColor : typeStyle.color;

            return (
              <Box
                key={option.value}
                onClick={() => setFilterType(option.value)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: isActive
                    ? alpha(optionColor, 0.15)
                    : 'transparent',
                  border: `1px solid ${isActive ? alpha(optionColor, 0.3) : 'transparent'}`,
                  color: isActive ? optionColor : 'text.secondary',
                  fontSize: '0.75rem',
                  fontWeight: isActive ? 600 : 500,
                  whiteSpace: 'nowrap',
                  '&:hover': {
                    background: alpha(optionColor, isActive ? 0.2 : 0.08),
                  },
                }}
              >
                <FilterIcon sx={{ fontSize: 16 }} />
                {option.label}
              </Box>
            );
          })}
        </Box>
      )}

      {/* Legend Bar */}
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          px: 2,
          py: 1,
          borderBottom: `1px solid ${alpha(isDark ? '#fff' : '#000', 0.06)}`,
          flexWrap: 'wrap',
        }}
      >
        {Object.entries(masteryColors).map(([key, value]) => (
          <Box
            key={key}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
            }}
          >
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: value.fill,
                boxShadow: `0 0 6px ${value.glow}`,
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {value.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Canvas Container */}
      <Box
        sx={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            cursor: isDragging ? 'grabbing' : hoveredNode ? 'pointer' : 'grab',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleClick}
          onWheel={handleWheel}
        />

        {/* Node Tooltip */}
        {hoveredNode && (
          <Box
            sx={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(${hoveredNode.x * zoom + offset.x - 80}px, ${hoveredNode.y * zoom + offset.y - 70}px)`,
              pointerEvents: 'none',
              zIndex: 20,
              animation: 'fadeIn 0.15s ease',
              '@keyframes fadeIn': {
                from: { opacity: 0, transform: `translate(${hoveredNode.x * zoom + offset.x - 80}px, ${hoveredNode.y * zoom + offset.y - 60}px)` },
                to: { opacity: 1, transform: `translate(${hoveredNode.x * zoom + offset.x - 80}px, ${hoveredNode.y * zoom + offset.y - 70}px)` },
              },
            }}
          >
            <Box
              sx={{
                background: isDark
                  ? 'rgba(30, 33, 38, 0.95)'
                  : 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(8px)',
                borderRadius: '10px',
                p: 1.5,
                minWidth: 160,
                border: `1px solid ${alpha(isDark ? '#fff' : '#000', 0.1)}`,
                boxShadow: isDark
                  ? '0 4px 16px rgba(0, 0, 0, 0.4)'
                  : '0 4px 16px rgba(0, 0, 0, 0.12)',
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                {hoveredNode.name}
              </Typography>
              {hoveredNode.type && (
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: '4px',
                    background: alpha(
                      isDark
                        ? (NODE_TYPES[hoveredNode.type]?.darkColor || '#9E9E9E')
                        : (NODE_TYPES[hoveredNode.type]?.color || '#757575'),
                      0.15
                    ),
                    color: isDark
                      ? (NODE_TYPES[hoveredNode.type]?.darkColor || '#9E9E9E')
                      : (NODE_TYPES[hoveredNode.type]?.color || '#757575'),
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    mb: 0.5,
                  }}
                >
                  {hoveredNode.type}
                </Box>
              )}
              {hoveredNode.masteryLevel !== undefined && (
                <Box sx={{ mt: 0.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                    <Typography variant="caption" color="text.secondary">
                      Mastery
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 600,
                        color: masteryColors[getMasteryLevel(hoveredNode.masteryLevel)].fill,
                      }}
                    >
                      {Math.round(hoveredNode.masteryLevel)}%
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      height: 4,
                      borderRadius: 2,
                      background: alpha(isDark ? '#fff' : '#000', 0.1),
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        height: '100%',
                        width: `${hoveredNode.masteryLevel}%`,
                        borderRadius: 2,
                        background: masteryColors[getMasteryLevel(hoveredNode.masteryLevel)].fill,
                      }}
                    />
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Zoom Controls */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 12,
            right: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            zIndex: 10,
          }}
        >
          {[
            { icon: ZoomInIcon, action: handleZoomIn, label: 'Zoom In' },
            { icon: ZoomOutIcon, action: handleZoomOut, label: 'Zoom Out' },
            { icon: CenterFocusStrongIcon, action: handleReset, label: 'Reset View' },
          ].map((control, index) => {
            const ControlIcon = control.icon;
            return (
              <Tooltip key={index} title={control.label} placement="left">
                <IconButton
                  size="small"
                  onClick={control.action}
                  sx={{
                    width: 36,
                    height: 36,
                    background: isDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.05)',
                    backdropFilter: 'blur(8px)',
                    border: `1px solid ${alpha(isDark ? '#fff' : '#000', 0.1)}`,
                    '&:hover': {
                      background: isDark
                        ? 'rgba(255, 255, 255, 0.2)'
                        : 'rgba(0, 0, 0, 0.1)',
                      transform: 'scale(1.05)',
                    },
                    transition: 'all 0.2s ease',
                  }}
                >
                  <ControlIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            );
          })}
        </Box>

        {/* Help hint */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.5,
            py: 0.75,
            borderRadius: '8px',
            background: alpha(isDark ? '#fff' : '#000', 0.05),
            backdropFilter: 'blur(8px)',
            opacity: graphData.nodes.length > 0 ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        >
          <TouchAppIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
          <Typography variant="caption" color="text.secondary">
            Drag to pan • Scroll to zoom
          </Typography>
        </Box>

        {/* Empty State */}
        {graphData.nodes.length === 0 && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Box sx={{ textAlign: 'center', px: 3 }}>
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: isDark
                    ? 'linear-gradient(135deg, rgba(66, 165, 245, 0.15) 0%, rgba(102, 187, 106, 0.15) 100%)'
                    : 'linear-gradient(135deg, rgba(30, 136, 229, 0.12) 0%, rgba(67, 160, 71, 0.12) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                }}
              >
                <SchoolIcon
                  sx={{
                    fontSize: 40,
                    color: isDark ? '#64B5F6' : '#1E88E5',
                    opacity: 0.8,
                  }}
                />
              </Box>
              <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                No Knowledge Graph Yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Start learning to build your personalized knowledge graph
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Selected Node Footer */}
      {selectedNode && (
        <Box
          sx={{
            p: 2,
            borderTop: `1px solid ${alpha(isDark ? '#fff' : '#000', 0.08)}`,
            background: alpha(isDark ? '#fff' : '#000', 0.02),
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            animation: 'slideUp 0.2s ease',
            '@keyframes slideUp': {
              from: { opacity: 0, transform: 'translateY(10px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
          }}
        >
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              background: `linear-gradient(135deg, ${
                isDark
                  ? (NODE_TYPES[selectedNode.type]?.darkColor || '#9E9E9E')
                  : (NODE_TYPES[selectedNode.type]?.color || '#757575')
              } 0%, ${alpha(
                isDark
                  ? (NODE_TYPES[selectedNode.type]?.darkColor || '#9E9E9E')
                  : (NODE_TYPES[selectedNode.type]?.color || '#757575'),
                0.7
              )} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {(() => {
              const TypeIcon = NODE_TYPES[selectedNode.type]?.icon || HubIcon;
              return <TypeIcon sx={{ color: 'white', fontSize: 20 }} />;
            })()}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary">
              Selected Node
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {selectedNode.name}
            </Typography>
          </Box>
          {selectedNode.domain && (
            <Box
              sx={{
                px: 1.25,
                py: 0.5,
                borderRadius: '8px',
                background: alpha(isDark ? '#fff' : '#000', 0.08),
                fontSize: '0.7rem',
                fontWeight: 500,
                color: 'text.secondary',
              }}
            >
              {selectedNode.domain}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
