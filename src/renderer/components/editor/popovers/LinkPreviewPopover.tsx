/**
 * LinkPreviewPopover.tsx
 *
 * Hover popover for wiki-link preview.
 * Shows vocabulary definition, concept info, or note preview.
 */

import React, { useEffect, useState } from 'react';
import Popover from '@mui/material/Popover';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import LinearProgress from '@mui/material/LinearProgress';
import { styled, useTheme } from '@mui/material/styles';

// Icons
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SchoolIcon from '@mui/icons-material/School';
import NotesIcon from '@mui/icons-material/Notes';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';

// Styled components
const PreviewCard = styled(Box)(({ theme }) => ({
  padding: '16px',
  maxWidth: 320,
  minWidth: 250,
}));

const PreviewHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '12px',
}));

const TypeIcon = styled(Box)<{ linkType: string }>(({ theme, linkType }) => ({
  width: 36,
  height: 36,
  borderRadius: '8px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  ...(linkType === 'vocabulary' && {
    background: 'rgba(76, 175, 80, 0.15)',
    color: '#4CAF50',
  }),
  ...(linkType === 'concept' && {
    background: 'rgba(33, 150, 243, 0.15)',
    color: '#2196F3',
  }),
  ...(linkType === 'note' && {
    background: theme.palette.mode === 'dark' ? 'rgba(189, 189, 189, 0.15)' : 'rgba(117, 117, 117, 0.15)',
    color: theme.palette.mode === 'dark' ? '#BDBDBD' : '#757575',
  }),
}));

const LeitnerBadge = styled(Box)<{ box: number }>(({ box }) => {
  const colors = ['#ff5722', '#ff9800', '#ffc107', '#8bc34a', '#4caf50'];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 600,
    background: `${colors[Math.min(box - 1, 4)]}20`,
    color: colors[Math.min(box - 1, 4)],
  };
});

interface LinkPreviewPopoverProps {
  type: string;
  id: string;
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

interface VocabularyPreview {
  type: 'vocabulary';
  word: string;
  definition: string;
  example?: string;
  relatedWords?: string[];
  leitnerBox?: number;
  nextReview?: string;
}

interface ConceptPreview {
  type: 'concept';
  name: string;
  description?: string;
  mastery?: number;
  exposureCount?: number;
}

interface NotePreview {
  type: 'note';
  title?: string;
  content?: string;
  tags?: string[];
  createdAt?: string;
  sourceType?: string;
}

type PreviewData = VocabularyPreview | ConceptPreview | NotePreview | null;

export default function LinkPreviewPopover({
  type,
  id,
  anchorEl,
  onClose,
}: LinkPreviewPopoverProps) {
  const theme = useTheme();
  const [preview, setPreview] = useState<PreviewData>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch preview data
  useEffect(() => {
    if (!anchorEl || !id) return;

    setLoading(true);
    setError(null);

    // Use IPC to fetch preview data
    const fetchPreview = async () => {
      try {
        // @ts-ignore - window.electron is defined in preload
        const data = window.electron?.ipcRenderer?.sendSync?.('get-link-preview', [type, id]);

        if (data) {
          setPreview(data);
        } else {
          setError('Preview not available');
        }
      } catch (err) {
        console.error('Failed to fetch preview:', err);
        setError('Failed to load preview');
      } finally {
        setLoading(false);
      }
    };

    fetchPreview();
  }, [type, id, anchorEl]);

  // Auto-close after mouse leaves
  useEffect(() => {
    if (!anchorEl) return;

    let timeoutId: NodeJS.Timeout;

    const handleMouseLeave = () => {
      timeoutId = setTimeout(() => {
        onClose();
      }, 300);
    };

    const handleMouseEnter = () => {
      clearTimeout(timeoutId);
    };

    anchorEl.addEventListener('mouseleave', handleMouseLeave);
    anchorEl.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      clearTimeout(timeoutId);
      anchorEl.removeEventListener('mouseleave', handleMouseLeave);
      anchorEl.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [anchorEl, onClose]);

  const open = Boolean(anchorEl);

  const getIcon = () => {
    switch (type) {
      case 'vocabulary':
        return <MenuBookIcon />;
      case 'concept':
        return <SchoolIcon />;
      case 'note':
      default:
        return <NotesIcon />;
    }
  };

  const renderVocabulary = (data: VocabularyPreview) => (
    <>
      <PreviewHeader>
        <TypeIcon linkType="vocabulary">{getIcon()}</TypeIcon>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {data.word}
          </Typography>
          {data.leitnerBox && (
            <LeitnerBadge box={data.leitnerBox}>
              Box {data.leitnerBox}
            </LeitnerBadge>
          )}
        </Box>
      </PreviewHeader>

      <Typography
        variant="body2"
        sx={{ mb: 1.5, color: 'text.secondary', lineHeight: 1.5 }}
      >
        {data.definition}
      </Typography>

      {data.example && (
        <Box
          sx={{
            p: 1.5,
            mb: 1.5,
            borderRadius: '8px',
            background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            borderLeft: '3px solid #4CAF50',
          }}
        >
          <Typography variant="caption" color="text.secondary" fontStyle="italic">
            "{data.example}"
          </Typography>
        </Box>
      )}

      {data.relatedWords && data.relatedWords.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {data.relatedWords.slice(0, 5).map((word) => (
            <Chip key={word} label={word} size="small" variant="outlined" />
          ))}
        </Box>
      )}
    </>
  );

  const renderConcept = (data: ConceptPreview) => (
    <>
      <PreviewHeader>
        <TypeIcon linkType="concept">{getIcon()}</TypeIcon>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            {data.name}
          </Typography>
          {data.exposureCount !== undefined && (
            <Typography variant="caption" color="text.secondary">
              Seen {data.exposureCount} times
            </Typography>
          )}
        </Box>
      </PreviewHeader>

      {data.mastery !== undefined && (
        <Box sx={{ mb: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Mastery
            </Typography>
            <Typography variant="caption" fontWeight={600}>
              {Math.round(data.mastery)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={data.mastery}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: 'rgba(33, 150, 243, 0.1)',
              '& .MuiLinearProgress-bar': {
                bgcolor: '#2196F3',
              },
            }}
          />
        </Box>
      )}

      {data.description && (
        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
          {data.description}
        </Typography>
      )}
    </>
  );

  const renderNote = (data: NotePreview) => (
    <>
      <PreviewHeader>
        <TypeIcon linkType="note">{getIcon()}</TypeIcon>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" fontWeight={600} noWrap>
            {data.title || 'Untitled Note'}
          </Typography>
          {data.sourceType && (
            <Typography variant="caption" color="text.secondary">
              From {data.sourceType}
            </Typography>
          )}
        </Box>
      </PreviewHeader>

      {data.content && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 1.5,
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {data.content}
        </Typography>
      )}

      {data.tags && data.tags.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {data.tags.slice(0, 4).map((tag) => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              icon={<LocalOfferIcon sx={{ fontSize: 14 }} />}
              sx={{ fontSize: 11 }}
            />
          ))}
        </Box>
      )}
    </>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <PreviewCard>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
            <Skeleton variant="rounded" width={36} height={36} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="40%" />
            </Box>
          </Box>
          <Skeleton variant="text" />
          <Skeleton variant="text" width="80%" />
        </PreviewCard>
      );
    }

    if (error || !preview) {
      return (
        <PreviewCard>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {error || 'Preview not available'}
          </Typography>
        </PreviewCard>
      );
    }

    return (
      <PreviewCard>
        {preview.type === 'vocabulary' && renderVocabulary(preview as VocabularyPreview)}
        {preview.type === 'concept' && renderConcept(preview as ConceptPreview)}
        {preview.type === 'note' && renderNote(preview as NotePreview)}
      </PreviewCard>
    );
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      disableRestoreFocus
      sx={{
        pointerEvents: 'none',
        '& .MuiPaper-root': {
          pointerEvents: 'auto',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        },
      }}
    >
      {renderContent()}
    </Popover>
  );
}
