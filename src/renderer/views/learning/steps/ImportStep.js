/**
 * ImportStep.js
 *
 * Step 3: Import/create learning points
 * - Parse imported file and display preview
 * - Manual card creation form
 * - Bulk editing capabilities
 * - Column mapping for CSV/Excel
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Pagination,
  LinearProgress,
  Fade,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ArrowForward as NextIcon,
  ArrowBack as BackIcon,
  Upload as ImportIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';

import { DOMAIN_COLORS } from '../LearningPlanWizard';

// Styled components
const StepContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  minHeight: 400,
}));

const StatsBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: theme.spacing(1.5, 2),
  borderRadius: 8,
  background:
    theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
}));

const CardPreview = styled(Box)(({ theme, color }) => ({
  display: 'flex',
  border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
  borderRadius: 8,
  overflow: 'hidden',
  '& .front': {
    flex: 1,
    padding: theme.spacing(1.5),
    background: alpha(color, 0.05),
    borderRight: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  },
  '& .back': {
    flex: 1,
    padding: theme.spacing(1.5),
  },
}));

const NavigationBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: 'auto',
  paddingTop: theme.spacing(2),
}));

const ITEMS_PER_PAGE = 10;

function ImportStep({ data, updateData, onNext, onBack, isValid }) {
  const [isLoading, setIsLoading] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [columnMapping, setColumnMapping] = useState({
    front: null,
    back: null,
    tags: null,
    difficulty: null,
  });
  const [availableColumns, setAvailableColumns] = useState([]);
  const [page, setPage] = useState(1);
  const [newItem, setNewItem] = useState({ front: '', back: '', tags: '' });

  const domainColor = DOMAIN_COLORS[data.domainType]?.primary || '#666';

  // Parse imported file
  useEffect(() => {
    const parseFile = async () => {
      if (!data.sourceFile && data.sourceType !== 'manual' && !data.sourceId && !data.sourceUrl) {
        return;
      }

      // Skip if manual mode
      if (data.sourceType === 'manual') {
        return;
      }

      setIsLoading(true);
      setParseError(null);

      try {
        let result;

        if (data.sourceFile) {
          // Parse file using LearningPointImporter
          result = await window.electron.ipcRenderer.invoke('learning-point-import-file', {
            filePath: data.sourceFile.path,
            fileType: data.sourceFile.type,
            domain: data.domainType,
            columnMapping: columnMapping.front ? columnMapping : null,
          });
        } else if (data.sourceId && data.sourceType === 'book') {
          // Extract from book
          result = await window.electron.ipcRenderer.invoke('learning-point-extract-from-book', {
            bookId: data.sourceId,
            domain: data.domainType,
          });
        } else if (data.sourceId && data.sourceType === 'vocabulary_set') {
          // Load from vocabulary set
          result = await window.electron.ipcRenderer.invoke('learning-point-from-vocabulary', {
            setId: data.sourceId,
          });
        } else if (data.sourceUrl) {
          // Import from URL
          result = await window.electron.ipcRenderer.invoke('learning-point-import-url', {
            url: data.sourceUrl,
            domain: data.domainType,
          });
        }

        if (result?.success) {
          updateData({
            learningPoints: result.items,
            totalCount: result.items.length,
          });

          // If CSV/Excel, store available columns for mapping
          if (result.columns) {
            setAvailableColumns(result.columns);
            if (!columnMapping.front) {
              setShowColumnMapping(true);
            }
          }
        } else {
          setParseError(result?.error || 'Failed to parse source');
        }
      } catch (err) {
        console.error('Error parsing source:', err);
        setParseError(err.message || 'Failed to parse source');
      } finally {
        setIsLoading(false);
      }
    };

    parseFile();
  }, [data.sourceFile, data.sourceId, data.sourceUrl, data.sourceType, data.domainType, columnMapping, updateData]);

  // Add manual item
  const handleAddItem = useCallback(() => {
    if (!newItem.front.trim() || !newItem.back.trim()) return;

    const item = {
      id: `manual_${Date.now()}`,
      front: newItem.front.trim(),
      back: newItem.back.trim(),
      tags: newItem.tags
        ? newItem.tags.split(',').map((t) => t.trim())
        : [],
      difficulty: 'medium',
      source: 'manual',
    };

    const updatedPoints = [...data.learningPoints, item];
    updateData({
      learningPoints: updatedPoints,
      totalCount: updatedPoints.length,
    });

    setNewItem({ front: '', back: '', tags: '' });
  }, [newItem, data.learningPoints, updateData]);

  // Delete item
  const handleDeleteItem = useCallback(
    (itemId) => {
      const updatedPoints = data.learningPoints.filter((p) => p.id !== itemId);
      updateData({
        learningPoints: updatedPoints,
        totalCount: updatedPoints.length,
      });
    },
    [data.learningPoints, updateData]
  );

  // Edit item
  const handleSaveEdit = useCallback(() => {
    if (!editingItem) return;

    const updatedPoints = data.learningPoints.map((p) =>
      p.id === editingItem.id ? editingItem : p
    );
    updateData({ learningPoints: updatedPoints });
    setEditingItem(null);
  }, [editingItem, data.learningPoints, updateData]);

  // Apply column mapping
  const handleApplyMapping = useCallback(async () => {
    if (!columnMapping.front || !columnMapping.back) return;

    setShowColumnMapping(false);
    setIsLoading(true);

    try {
      const result = await window.electron.ipcRenderer.invoke('learning-point-import-file', {
        filePath: data.sourceFile.path,
        fileType: data.sourceFile.type,
        domain: data.domainType,
        columnMapping,
      });

      if (result?.success) {
        updateData({
          learningPoints: result.items,
          totalCount: result.items.length,
        });
      }
    } catch (err) {
      setParseError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [columnMapping, data.sourceFile, data.domainType, updateData]);

  // Pagination
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return data.learningPoints.slice(start, start + ITEMS_PER_PAGE);
  }, [data.learningPoints, page]);

  const totalPages = Math.ceil(data.learningPoints.length / ITEMS_PER_PAGE);

  return (
    <StepContainer>
      {/* Stats Bar */}
      <StatsBar>
        <Chip
          icon={<CheckIcon sx={{ fontSize: 16 }} />}
          label={`${data.learningPoints.length} items`}
          color={data.learningPoints.length > 0 ? 'success' : 'default'}
          size="small"
        />
        {data.sourceType !== 'manual' && data.sourceFile && (
          <Chip
            label={data.sourceFile.name}
            size="small"
            onDelete={() => updateData({ sourceFile: null, learningPoints: [], totalCount: 0 })}
          />
        )}
        {availableColumns.length > 0 && (
          <Tooltip title="Configure column mapping">
            <IconButton size="small" onClick={() => setShowColumnMapping(true)}>
              <SettingsIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Box sx={{ flex: 1 }} />
        {isLoading && <CircularProgress size={20} />}
      </StatsBar>

      {/* Loading indicator */}
      <Collapse in={isLoading}>
        <Box sx={{ width: '100%' }}>
          <LinearProgress color="primary" />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            Processing source material...
          </Typography>
        </Box>
      </Collapse>

      {/* Error display */}
      <Collapse in={!!parseError}>
        <Alert severity="error" onClose={() => setParseError(null)}>
          {parseError}
        </Alert>
      </Collapse>

      {/* Manual entry form */}
      {data.sourceType === 'manual' && (
        <Paper
          elevation={0}
          sx={{
            p: 2,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 2 }}>
            Add New Learning Item
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="Front (Question/Term)"
              value={newItem.front}
              onChange={(e) => setNewItem({ ...newItem, front: e.target.value })}
              size="small"
              sx={{ flex: 1, minWidth: 200 }}
            />
            <TextField
              label="Back (Answer/Definition)"
              value={newItem.back}
              onChange={(e) => setNewItem({ ...newItem, back: e.target.value })}
              size="small"
              sx={{ flex: 1, minWidth: 200 }}
            />
            <TextField
              label="Tags (comma-separated)"
              value={newItem.tags}
              onChange={(e) => setNewItem({ ...newItem, tags: e.target.value })}
              size="small"
              sx={{ width: 150 }}
            />
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddItem}
              disabled={!newItem.front.trim() || !newItem.back.trim()}
              sx={{
                bgcolor: domainColor,
                '&:hover': { bgcolor: alpha(domainColor, 0.9) },
              }}
            >
              Add
            </Button>
          </Box>
        </Paper>
      )}

      {/* Items table */}
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          flex: 1,
          minHeight: 200,
          maxHeight: 350,
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 50 }}>#</TableCell>
              <TableCell>Front (Question/Term)</TableCell>
              <TableCell>Back (Answer/Definition)</TableCell>
              <TableCell sx={{ width: 100 }}>Tags</TableCell>
              <TableCell sx={{ width: 80 }} align="right">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {data.sourceType === 'manual'
                      ? 'Add items using the form above'
                      : 'No items imported yet'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((item, index) => (
                <TableRow key={item.id} hover>
                  <TableCell sx={{ color: 'text.secondary' }}>
                    {(page - 1) * ITEMS_PER_PAGE + index + 1}
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {typeof item.front === 'object' ? item.front?.text : item.front}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {typeof item.back === 'object' ? item.back?.text : item.back}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {item.tags?.slice(0, 2).map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.65rem',
                          mr: 0.5,
                          bgcolor: alpha(domainColor, 0.1),
                        }}
                      />
                    ))}
                    {item.tags?.length > 2 && (
                      <Chip
                        label={`+${item.tags.length - 2}`}
                        size="small"
                        sx={{ height: 18, fontSize: '0.65rem' }}
                      />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => setEditingItem(item)}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteItem(item.id)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, p) => setPage(p)}
            size="small"
            color="primary"
          />
        </Box>
      )}

      {/* Navigation */}
      <NavigationBox>
        <Button startIcon={<BackIcon />} onClick={onBack} sx={{ px: 3 }}>
          Back
        </Button>
        <Button
          variant="contained"
          endIcon={<NextIcon />}
          onClick={onNext}
          disabled={!isValid}
          sx={{
            px: 4,
            py: 1,
            borderRadius: 2,
            background: `linear-gradient(135deg, ${domainColor}, ${alpha(domainColor, 0.8)})`,
            '&:hover': {
              background: `linear-gradient(135deg, ${domainColor}, ${domainColor})`,
            },
            '&.Mui-disabled': {
              background: 'rgba(0, 0, 0, 0.12)',
            },
          }}
        >
          Continue
        </Button>
      </NavigationBox>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Edit Learning Item</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Front (Question/Term)"
              value={typeof editingItem?.front === 'object' ? editingItem?.front?.text || '' : editingItem?.front || ''}
              onChange={(e) =>
                setEditingItem({ ...editingItem, front: e.target.value })
              }
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="Back (Answer/Definition)"
              value={typeof editingItem?.back === 'object' ? editingItem?.back?.text || '' : editingItem?.back || ''}
              onChange={(e) =>
                setEditingItem({ ...editingItem, back: e.target.value })
              }
              fullWidth
              multiline
              rows={3}
            />
            <TextField
              label="Tags (comma-separated)"
              value={editingItem?.tags?.join(', ') || ''}
              onChange={(e) =>
                setEditingItem({
                  ...editingItem,
                  tags: e.target.value.split(',').map((t) => t.trim()),
                })
              }
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingItem(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            sx={{
              bgcolor: domainColor,
              '&:hover': { bgcolor: alpha(domainColor, 0.9) },
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Column Mapping Dialog */}
      <Dialog
        open={showColumnMapping}
        onClose={() => setShowColumnMapping(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Configure Column Mapping</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Map your file columns to learning item fields
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Front (Question/Term) *</InputLabel>
              <Select
                value={columnMapping.front || ''}
                label="Front (Question/Term) *"
                onChange={(e) =>
                  setColumnMapping({ ...columnMapping, front: e.target.value })
                }
              >
                {availableColumns.map((col) => (
                  <MenuItem key={col} value={col}>
                    {col}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Back (Answer/Definition) *</InputLabel>
              <Select
                value={columnMapping.back || ''}
                label="Back (Answer/Definition) *"
                onChange={(e) =>
                  setColumnMapping({ ...columnMapping, back: e.target.value })
                }
              >
                {availableColumns.map((col) => (
                  <MenuItem key={col} value={col}>
                    {col}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Tags (Optional)</InputLabel>
              <Select
                value={columnMapping.tags || ''}
                label="Tags (Optional)"
                onChange={(e) =>
                  setColumnMapping({ ...columnMapping, tags: e.target.value })
                }
              >
                <MenuItem value="">None</MenuItem>
                {availableColumns.map((col) => (
                  <MenuItem key={col} value={col}>
                    {col}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowColumnMapping(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleApplyMapping}
            disabled={!columnMapping.front || !columnMapping.back}
            sx={{
              bgcolor: domainColor,
              '&:hover': { bgcolor: alpha(domainColor, 0.9) },
            }}
          >
            Apply Mapping
          </Button>
        </DialogActions>
      </Dialog>
    </StepContainer>
  );
}

export default ImportStep;
