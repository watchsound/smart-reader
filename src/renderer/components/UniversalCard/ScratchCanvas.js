/**
 * ScratchCanvas.js
 *
 * Simple HTML5 Canvas-based scratch pad for problem-solving.
 * Allows drawing, erasing, and basic tools during study sessions.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
  Typography,
  Collapse,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Brush as PencilIcon,
  Delete as EraserIcon,
  Clear as ClearIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  ExpandMore as CollapseIcon,
  ExpandLess as ExpandIcon,
  ColorLens as ColorIcon,
} from '@mui/icons-material';

// Limited color palette for simplicity
const COLORS = [
  '#000000', // Black
  '#F44336', // Red
  '#2196F3', // Blue
  '#4CAF50', // Green
  '#FF9800', // Orange
  '#9C27B0', // Purple
  '#795548', // Brown
  '#607D8B', // Gray
];

/**
 * ScratchCanvas Component
 *
 * @param {Object} props
 * @param {number} props.width - Canvas width (default: 100%)
 * @param {number} props.height - Canvas height (default: 300)
 * @param {boolean} props.collapsed - Initial collapsed state
 * @param {Function} props.onToggle - Callback when toggled
 * @param {Function} props.onExport - Callback with base64 data when exported
 * @param {string} props.domainColor - Theme color for accents
 */
function ScratchCanvas({
  width = '100%',
  height = 300,
  collapsed: initialCollapsed = false,
  onToggle,
  onExport,
  domainColor = '#2196F3',
}) {
  const theme = useTheme();
  const canvasRef = useRef(null);
  const contextRef = useRef(null);

  // State
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(3);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [showColors, setShowColors] = useState(false);

  // Undo/Redo history
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get actual dimensions
    const rect = canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;

    // Set canvas dimensions for high DPI
    canvas.width = rect.width * scale;
    canvas.height = height * scale;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext('2d');
    context.scale(scale, scale);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = color;
    context.lineWidth = brushSize;
    contextRef.current = context;

    // Fill with white background
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, rect.width, height);

    // Save initial state
    saveToHistory();
  }, [height]);

  // Update context when tool/color/size changes
  useEffect(() => {
    if (!contextRef.current) return;

    if (tool === 'eraser') {
      contextRef.current.strokeStyle = '#FFFFFF';
      contextRef.current.lineWidth = brushSize * 3; // Larger eraser
    } else {
      contextRef.current.strokeStyle = color;
      contextRef.current.lineWidth = brushSize;
    }
  }, [tool, color, brushSize]);

  /**
   * Save current canvas state to history
   */
  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const imageData = canvas.toDataURL('image/png');

    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(imageData);
      return newHistory.slice(-20); // Keep last 20 states
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 19));
  }, [historyIndex]);

  /**
   * Restore canvas from history
   */
  const restoreFromHistory = useCallback((index) => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context || !history[index]) return;

    const img = new Image();
    img.onload = () => {
      const rect = canvas.getBoundingClientRect();
      context.clearRect(0, 0, rect.width, height);
      context.drawImage(img, 0, 0, rect.width, height);
    };
    img.src = history[index];
  }, [history, height]);

  /**
   * Get coordinates from event
   */
  const getCoordinates = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    if (e.touches) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }

    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  /**
   * Start drawing
   */
  const startDrawing = useCallback(
    (e) => {
      const { x, y } = getCoordinates(e);
      contextRef.current?.beginPath();
      contextRef.current?.moveTo(x, y);
      setIsDrawing(true);
    },
    [getCoordinates],
  );

  /**
   * Draw on canvas
   */
  const draw = useCallback(
    (e) => {
      if (!isDrawing || !contextRef.current) return;

      e.preventDefault();
      const { x, y } = getCoordinates(e);
      contextRef.current.lineTo(x, y);
      contextRef.current.stroke();
    },
    [isDrawing, getCoordinates],
  );

  /**
   * Stop drawing
   */
  const stopDrawing = useCallback(() => {
    if (isDrawing) {
      contextRef.current?.closePath();
      setIsDrawing(false);
      saveToHistory();
    }
  }, [isDrawing, saveToHistory]);

  /**
   * Clear canvas
   */
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    const rect = canvas.getBoundingClientRect();
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, rect.width, height);
    saveToHistory();
  }, [height, saveToHistory]);

  /**
   * Undo last action
   */
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1);
      restoreFromHistory(historyIndex - 1);
    }
  }, [historyIndex, restoreFromHistory]);

  /**
   * Redo last undone action
   */
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((prev) => prev + 1);
      restoreFromHistory(historyIndex + 1);
    }
  }, [historyIndex, history.length, restoreFromHistory]);

  /**
   * Toggle collapsed state
   */
  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => !prev);
    onToggle?.(!collapsed);
  }, [collapsed, onToggle]);

  /**
   * Export canvas as base64
   */
  const exportCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const dataUrl = canvas.toDataURL('image/png');
    onExport?.(dataUrl);
    return dataUrl;
  }, [onExport]);

  /**
   * Handle tool change
   */
  const handleToolChange = (event, newTool) => {
    if (newTool !== null) {
      setTool(newTool);
    }
  };

  return (
    <Paper
      elevation={2}
      sx={{
        width,
        overflow: 'hidden',
        borderRadius: 2,
        border: `1px solid ${alpha(domainColor, 0.2)}`,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 1,
          bgcolor: alpha(domainColor, 0.05),
          borderBottom: collapsed ? 'none' : `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, color: domainColor }}>
          Scratch Pad
        </Typography>
        <IconButton size="small" onClick={toggleCollapse}>
          {collapsed ? <ExpandIcon fontSize="small" /> : <CollapseIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={!collapsed}>
        {/* Toolbar */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.5,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            flexWrap: 'wrap',
          }}
        >
          {/* Tool selection */}
          <ToggleButtonGroup
            value={tool}
            exclusive
            onChange={handleToolChange}
            size="small"
          >
            <ToggleButton value="pencil" aria-label="pencil">
              <Tooltip title="Pencil">
                <PencilIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="eraser" aria-label="eraser">
              <Tooltip title="Eraser">
                <EraserIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Color picker toggle */}
          <Tooltip title="Color">
            <IconButton
              size="small"
              onClick={() => setShowColors(!showColors)}
              sx={{
                bgcolor: alpha(color, 0.1),
                border: `2px solid ${color}`,
              }}
            >
              <ColorIcon fontSize="small" style={{ color }} />
            </IconButton>
          </Tooltip>

          {/* Brush size slider */}
          <Box sx={{ width: 80, ml: 1 }}>
            <Slider
              value={brushSize}
              onChange={(e, val) => setBrushSize(val)}
              min={1}
              max={10}
              size="small"
              valueLabelDisplay="auto"
              sx={{ color: domainColor }}
            />
          </Box>

          {/* Spacer */}
          <Box sx={{ flex: 1 }} />

          {/* Actions */}
          <Tooltip title="Undo">
            <span>
              <IconButton
                size="small"
                onClick={undo}
                disabled={historyIndex <= 0}
              >
                <UndoIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo">
            <span>
              <IconButton
                size="small"
                onClick={redo}
                disabled={historyIndex >= history.length - 1}
              >
                <RedoIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Clear">
            <IconButton size="small" onClick={clearCanvas}>
              <ClearIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Color palette (collapsible) */}
        <Collapse in={showColors}>
          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
              px: 1.5,
              py: 0.5,
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            }}
          >
            {COLORS.map((c) => (
              <IconButton
                key={c}
                size="small"
                onClick={() => {
                  setColor(c);
                  setTool('pencil');
                }}
                sx={{
                  width: 24,
                  height: 24,
                  bgcolor: c,
                  border: color === c ? `2px solid ${domainColor}` : '1px solid #ccc',
                  '&:hover': {
                    bgcolor: c,
                    opacity: 0.8,
                  },
                }}
              />
            ))}
          </Box>
        </Collapse>

        {/* Canvas */}
        <Box
          sx={{
            width: '100%',
            height,
            cursor: tool === 'eraser' ? 'crosshair' : 'crosshair',
            touchAction: 'none', // Prevent scrolling while drawing
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{
              width: '100%',
              height,
              display: 'block',
            }}
          />
        </Box>
      </Collapse>
    </Paper>
  );
}

export default ScratchCanvas;
