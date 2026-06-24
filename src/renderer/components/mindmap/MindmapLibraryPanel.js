import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Tooltip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { listMindmaps, deleteMindmap, getMindmap } from '../../api/mindmapApi';
import MindmapSurface from './MindmapSurface';

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function MindmapCard({ entry, onDelete, onOpen }) {
  const theme = useTheme();
  return (
    <Card
      sx={{
        borderRadius: 3,
        border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
        background: alpha(theme.palette.background.paper, 0.8),
        backdropFilter: 'blur(8px)',
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.12)}` },
      }}
    >
      <CardContent sx={{ p: 2, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
          <AccountTreeIcon sx={{ fontSize: 16, color: theme.palette.info.main, mt: 0.3, flexShrink: 0 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.3, wordBreak: 'break-word' }}>
            {entry.title || 'Untitled'}
          </Typography>
        </Box>
        {entry.query && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'block',
              mb: 0.5,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            "{entry.query}"
          </Typography>
        )}
        <Typography variant="caption" color="text.disabled">
          {formatDate(entry.createdAt)}
        </Typography>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 1.5, pt: 0, justifyContent: 'flex-end' }}>
        <Tooltip title="Open full-screen">
          <IconButton size="small" onClick={() => onOpen(entry.id)}>
            <OpenInFullIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" onClick={() => onDelete(entry.id)} sx={{ color: theme.palette.error.light }}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </CardActions>
    </Card>
  );
}

export default function MindmapLibraryPanel() {
  const theme = useTheme();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null); // { id, data }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listMindmaps();
      setEntries(list || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = useCallback(async (id) => {
    await deleteMindmap(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleOpen = useCallback(async (id) => {
    const full = await getMindmap(id);
    if (full) setExpanded(full);
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (entries.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 8,
          borderRadius: 3,
          border: `1px dashed ${alpha(theme.palette.primary.main, 0.25)}`,
          background: alpha(theme.palette.primary.main, 0.02),
        }}
      >
        <AccountTreeIcon sx={{ fontSize: 48, color: alpha(theme.palette.primary.main, 0.25), mb: 1 }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No saved mind maps yet
        </Typography>
        <Typography variant="body2" color="text.disabled">
          Generate a mind map in Learn About and click the bookmark icon to save it here.
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Grid container spacing={2}>
        {entries.map((entry) => (
          <Grid item xs={12} sm={6} md={4} key={entry.id}>
            <MindmapCard entry={entry} onDelete={handleDelete} onOpen={handleOpen} />
          </Grid>
        ))}
      </Grid>

      <Dialog
        open={!!expanded}
        onClose={() => setExpanded(null)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, height: '80vh' } }}
      >
        {expanded && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccountTreeIcon sx={{ color: theme.palette.info.main }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {expanded.title || 'Mind Map'}
                </Typography>
              </Box>
              {expanded.query && (
                <Typography variant="caption" color="text.secondary">
                  "{expanded.query}"
                </Typography>
              )}
            </DialogTitle>
            <DialogContent sx={{ p: 0, flex: 1, overflow: 'hidden' }}>
              <MindmapSurface data={expanded.data} mode="expanded" readOnly />
            </DialogContent>
          </>
        )}
      </Dialog>
    </>
  );
}
