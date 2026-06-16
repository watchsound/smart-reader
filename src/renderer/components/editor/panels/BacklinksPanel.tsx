/**
 * BacklinksPanel.tsx
 *
 * Panel showing notes that link TO the current note.
 * Enables knowledge web navigation.
 */

import React, { useEffect, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import { styled, useTheme, alpha } from '@mui/material/styles';

// Icons
import LinkIcon from '@mui/icons-material/Link';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LinkOffIcon from '@mui/icons-material/LinkOff';

// Styled components
const PanelContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
  borderRadius: '12px',
  border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  overflow: 'hidden',
}));

const PanelHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '14px 16px',
  borderBottom: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#fff',
}));

const PanelBody = styled(Box)({
  flex: 1,
  overflow: 'auto',
  padding: '8px',
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'rgba(128,128,128,0.3)',
    borderRadius: '3px',
  },
});

const CountBadge = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 22,
  height: 22,
  padding: '0 6px',
  borderRadius: '11px',
  fontSize: 12,
  fontWeight: 600,
  background: theme.palette.primary.main,
  color: '#fff',
}));

const BacklinkCard = styled(Box)(({ theme }) => ({
  padding: '12px 14px',
  marginBottom: '8px',
  borderRadius: '10px',
  background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : '#fff',
  border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  '&:hover': {
    background: theme.palette.mode === 'dark' ? 'rgba(29, 155, 209, 0.1)' : 'rgba(29, 155, 209, 0.05)',
    borderColor: theme.palette.primary.main,
    transform: 'translateX(4px)',
  },
  '&:last-child': {
    marginBottom: 0,
  },
}));

const CardHeader = styled(Box)({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '8px',
  marginBottom: '8px',
});

const CardTitle = styled(Typography)({
  fontWeight: 600,
  fontSize: 14,
  flex: 1,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

const ContextText = styled(Typography)(({ theme }) => ({
  fontSize: 12,
  lineHeight: 1.5,
  color: theme.palette.text.secondary,
  background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
  padding: '8px 10px',
  borderRadius: '6px',
  borderLeft: `3px solid ${theme.palette.primary.main}`,
  '& mark': {
    background: 'rgba(255, 235, 59, 0.4)',
    padding: '0 2px',
    borderRadius: '2px',
  },
}));

const LinkTypeBadge = styled(Chip)<{ linkType: 'explicit' | 'auto' }>(({ linkType }) => ({
  height: 20,
  fontSize: 10,
  fontWeight: 600,
  ...(linkType === 'explicit' && {
    background: 'rgba(76, 175, 80, 0.15)',
    color: '#4CAF50',
  }),
  ...(linkType === 'auto' && {
    background: 'rgba(33, 150, 243, 0.15)',
    color: '#2196F3',
  }),
}));

const EmptyState = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '32px 24px',
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));

const SectionHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '8px 12px',
  marginBottom: '4px',
  borderRadius: '6px',
  cursor: 'pointer',
  '&:hover': {
    background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
  },
}));

// Types
interface BacklinkItem {
  noteId: string;
  noteTitle: string;
  linkText: string;
  context: string;
  linkType: 'explicit' | 'auto';
  createdAt: string;
  tags?: string[];
}

interface BacklinksPanelProps {
  targetId: string;
  targetType: 'note' | 'vocabulary' | 'concept';
  onNavigate?: (noteId: string) => void;
}

export default function BacklinksPanel({
  targetId,
  targetType,
  onNavigate,
}: BacklinksPanelProps) {
  const theme = useTheme();
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedExplicit, setExpandedExplicit] = useState(true);
  const [expandedAuto, setExpandedAuto] = useState(true);

  // Fetch backlinks
  const fetchBacklinks = useCallback(async () => {
    if (!targetId) return;

    setLoading(true);
    setError(null);

    try {
      // @ts-ignore - window.electron is defined in preload
      const results = await window.electron?.ipcRenderer?.invoke?.('get-backlinks', [targetId, targetType]);

      if (Array.isArray(results)) {
        setBacklinks(results.map((r: any) => ({
          noteId: String(r.note?.id || r.noteId),
          noteTitle: r.note?.title || r.noteTitle || 'Untitled Note',
          linkText: r.linkText || '',
          context: r.context || '',
          linkType: r.linkType || 'explicit',
          createdAt: r.createdAt || r.note?.createdAt || '',
          tags: r.note?.tags || r.tags || [],
        })));
      } else {
        setBacklinks([]);
      }
    } catch (err) {
      console.error('Failed to fetch backlinks:', err);
      setError('Failed to load backlinks');
    } finally {
      setLoading(false);
    }
  }, [targetId, targetType]);

  useEffect(() => {
    fetchBacklinks();
  }, [fetchBacklinks]);

  // Separate explicit and auto links
  const explicitLinks = backlinks.filter((b) => b.linkType === 'explicit');
  const autoLinks = backlinks.filter((b) => b.linkType === 'auto');

  // Handle navigation
  const handleNavigate = (noteId: string) => {
    if (onNavigate) {
      onNavigate(noteId);
    }
  };

  // Highlight link text in context
  const highlightContext = (context: string, linkText: string) => {
    if (!linkText) return context;

    const regex = new RegExp(`(${linkText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return context.replace(regex, '<mark>$1</mark>');
  };

  const renderBacklinkCard = (item: BacklinkItem) => (
    <BacklinkCard
      key={item.noteId}
      onClick={() => handleNavigate(item.noteId)}
    >
      <CardHeader>
        <CardTitle>{item.noteTitle}</CardTitle>
        <Tooltip title="Open note">
          <IconButton size="small" sx={{ ml: 0.5 }}>
            <OpenInNewIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </CardHeader>

      {item.context && (
        <ContextText
          dangerouslySetInnerHTML={{
            __html: `...${highlightContext(item.context, item.linkText)}...`,
          }}
        />
      )}

      {item.tags && item.tags.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
          {item.tags.slice(0, 3).map((tag) => (
            <Chip key={tag} label={tag} size="small" sx={{ fontSize: 10, height: 18 }} />
          ))}
        </Box>
      )}
    </BacklinkCard>
  );

  const renderSection = (
    title: string,
    items: BacklinkItem[],
    expanded: boolean,
    onToggle: () => void,
    linkType: 'explicit' | 'auto'
  ) => {
    if (items.length === 0) return null;

    return (
      <Box sx={{ mb: 2 }}>
        <SectionHeader onClick={onToggle}>
          {expanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            {title}
          </Typography>
          <LinkTypeBadge label={`${items.length}`} linkType={linkType} size="small" />
        </SectionHeader>

        <Collapse in={expanded}>
          {items.map(renderBacklinkCard)}
        </Collapse>
      </Box>
    );
  };

  return (
    <PanelContainer>
      <PanelHeader>
        <LinkIcon sx={{ color: 'primary.main' }} />
        <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1 }}>
          Backlinks
        </Typography>
        {backlinks.length > 0 && <CountBadge>{backlinks.length}</CountBadge>}
        <Tooltip title="Refresh">
          <span>
            <IconButton size="small" onClick={fetchBacklinks} disabled={loading}>
              <RefreshIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </span>
        </Tooltip>
      </PanelHeader>

      <PanelBody>
        {loading ? (
          <Box sx={{ p: 2 }}>
            {[1, 2, 3].map((i) => (
              <Box key={i} sx={{ mb: 2 }}>
                <Skeleton variant="rounded" height={80} />
              </Box>
            ))}
          </Box>
        ) : error ? (
          <EmptyState>
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          </EmptyState>
        ) : backlinks.length === 0 ? (
          <EmptyState>
            <LinkOffIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1.5 }} />
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              No backlinks yet
            </Typography>
            <Typography variant="caption">
              Notes that link to this {targetType} will appear here
            </Typography>
          </EmptyState>
        ) : (
          <>
            {renderSection(
              'Direct Links',
              explicitLinks,
              expandedExplicit,
              () => setExpandedExplicit(!expandedExplicit),
              'explicit'
            )}
            {renderSection(
              'Related (Auto)',
              autoLinks,
              expandedAuto,
              () => setExpandedAuto(!expandedAuto),
              'auto'
            )}
          </>
        )}
      </PanelBody>
    </PanelContainer>
  );
}
