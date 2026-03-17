import { useState, useEffect } from 'react';
import { useTheme, alpha, styled } from '@mui/material/styles';
import { Box, Typography, Pagination, Chip, Tooltip, IconButton } from '@mui/material';

// Icons
import NoteIcon from '@mui/icons-material/Note';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArticleIcon from '@mui/icons-material/Article';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import DescriptionIcon from '@mui/icons-material/Description';

import { getNotesByQuery } from '../../api/notesApi';

// Note colors
const NOTE_COLORS = [
  { bg: '#FFF9C4', accent: '#F9A825', icon: '#F57F17' },
  { bg: '#E1F5FE', accent: '#03A9F4', icon: '#0277BD' },
  { bg: '#F3E5F5', accent: '#AB47BC', icon: '#7B1FA2' },
  { bg: '#E8F5E9', accent: '#66BB6A', icon: '#2E7D32' },
  { bg: '#FFEBEE', accent: '#EF5350', icon: '#C62828' },
  { bg: '#E0F2F1', accent: '#26A69A', icon: '#00695C' },
  { bg: '#FFF3E0', accent: '#FFA726', icon: '#E65100' },
  { bg: '#E8EAF6', accent: '#5C6BC0', icon: '#283593' },
];

const NOTE_COLORS_DARK = [
  { bg: '#3D3200', accent: '#F9A825', icon: '#FFD54F' },
  { bg: '#01395D', accent: '#03A9F4', icon: '#4FC3F7' },
  { bg: '#311B38', accent: '#AB47BC', icon: '#CE93D8' },
  { bg: '#1B3A1B', accent: '#66BB6A', icon: '#81C784' },
  { bg: '#3D1515', accent: '#EF5350', icon: '#E57373' },
  { bg: '#0A2A2D', accent: '#26A69A', icon: '#4DB6AC' },
  { bg: '#3D2600', accent: '#FFA726', icon: '#FFB74D' },
  { bg: '#1A1D38', accent: '#5C6BC0', icon: '#7986CB' },
];

const NOTE_ICONS = [NoteIcon, StickyNote2Icon, ArticleIcon, DescriptionIcon];

function getColorIndex(str) {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % NOTE_COLORS.length;
}

function getIconForNote(id) {
  if (!id) return NoteIcon;
  let hash = 0;
  const str = String(id);
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return NOTE_ICONS[Math.abs(hash) % NOTE_ICONS.length];
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getPreviewText(note) {
  if (note.title) return note.title;
  if (note.cards && note.cards.length > 0 && note.cards[0].text) {
    const text = note.cards[0].text;
    return text.length > 50 ? `${text.slice(0, 50)}...` : text;
  }
  return 'Untitled Note';
}

const NoteCard = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'stretch',
  height: 56,
  borderRadius: 8,
  cursor: 'pointer',
  position: 'relative',
  overflow: 'hidden',
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateX(3px)',
    boxShadow: theme.palette.mode === 'dark'
      ? `0 3px 12px ${alpha('#000', 0.35)}`
      : `0 3px 12px ${alpha('#000', 0.08)}`,
  },
}));

function NotesListPanelInMoodBoard({ query, noteSelectionHandler }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [notes, setNotes] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(8);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    async function loadNotes() {
      const result = await getNotesByQuery({
        query: query || '',
        tag: '',
        star: 0,
        page,
        limit,
      });
      setNotes(result.data || []);
      setTotal(result.total);
    }
    loadNotes();
  }, [query, page, limit]);

  const handleSelectNote = (note) => {
    noteSelectionHandler(note);
  };

  const colorPalette = isDark ? NOTE_COLORS_DARK : NOTE_COLORS;

  if (notes.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
        <NoteIcon sx={{ fontSize: 36, color: alpha(theme.palette.text.secondary, 0.3), mb: 1 }} />
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
          {query ? 'No notes found' : 'No notes yet'}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          Create notes in the Notes view
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {notes.map((note) => {
        const colorIndex = getColorIndex(note.id);
        const colors = colorPalette[colorIndex];
        const IconComponent = getIconForNote(note.id);
        const isHovered = hoveredId === note.id;

        return (
          <NoteCard
            key={note.id}
            onMouseEnter={() => setHoveredId(note.id)}
            onMouseLeave={() => setHoveredId(null)}
            sx={{
              borderColor: isHovered ? alpha(colors.accent, 0.4) : alpha(theme.palette.divider, 0.08),
            }}
          >
            {/* Left icon section */}
            <Box
              sx={{
                width: 48,
                minWidth: 48,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                bgcolor: colors.bg,
                borderRadius: '8px 0 0 8px',
              }}
            >
              {/* Left accent stripe */}
              <Box
                sx={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  bgcolor: colors.accent,
                  borderRadius: '8px 0 0 8px',
                }}
              />
              <IconComponent sx={{ fontSize: 20, color: colors.icon }} />
            </Box>

            {/* Content section */}
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                px: 1.5,
                py: 0.5,
                minWidth: 0,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: '0.8rem',
                  color: theme.palette.text.primary,
                }}
              >
                {getPreviewText(note)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                <AccessTimeIcon sx={{ fontSize: 10, color: theme.palette.text.disabled }} />
                <Typography
                  variant="caption"
                  sx={{ color: theme.palette.text.disabled, fontSize: '0.65rem' }}
                >
                  {formatDate(note.createdAt)}
                </Typography>
                {note.tags && note.tags.length > 0 && (
                  <Chip
                    label={note.tags[0]}
                    size="small"
                    sx={{
                      height: 14,
                      fontSize: '0.6rem',
                      bgcolor: alpha(colors.accent, 0.15),
                      color: colors.accent,
                      '& .MuiChip-label': { px: 0.5 },
                    }}
                  />
                )}
              </Box>
            </Box>

            {/* Add to board button */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                pr: 0.75,
                opacity: isHovered ? 1 : 0,
                transition: 'opacity 0.15s ease',
              }}
            >
              <Tooltip title="Add to board">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectNote(note);
                  }}
                  sx={{
                    p: 0.5,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.2),
                    },
                  }}
                >
                  <AddCircleOutlineIcon
                    sx={{ fontSize: 18, color: theme.palette.primary.main }}
                  />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Right accent */}
            <Box
              sx={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: 3,
                bgcolor: colors.accent,
                opacity: 0.4,
                borderRadius: '0 8px 8px 0',
              }}
            />
          </NoteCard>
        );
      })}

      {/* Pagination */}
      {total > limit && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1.5, mb: 1 }}>
          <Pagination
            count={Math.ceil(total / limit)}
            page={page}
            size="small"
            onChange={(e, value) => setPage(value)}
            sx={{
              '& .MuiPaginationItem-root': {
                fontSize: '0.7rem',
                minWidth: 24,
                height: 24,
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
}

export default NotesListPanelInMoodBoard;
