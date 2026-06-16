/**
 * LinkSuggestionMenu.tsx
 *
 * Autocomplete dropdown for wiki-link suggestions.
 * Shows vocabulary, concepts, and notes that can be linked.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { styled, useTheme } from '@mui/material/styles';

// Icons
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SchoolIcon from '@mui/icons-material/School';
import NotesIcon from '@mui/icons-material/Notes';

// Styled components
const MenuContainer = styled(Box)(({ theme }) => ({
  position: 'absolute',
  zIndex: 1000,
  background: theme.palette.mode === 'dark' ? '#2d2d2d' : '#fff',
  border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
  borderRadius: '10px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  maxHeight: 320,
  minWidth: 280,
  maxWidth: 360,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}));

const MenuHeader = styled(Box)(({ theme }) => ({
  padding: '10px 14px',
  borderBottom: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
}));

const MenuList = styled(Box)({
  flex: 1,
  overflow: 'auto',
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'rgba(128,128,128,0.3)',
    borderRadius: '3px',
  },
});

const MenuItem = styled(Box)<{ selected?: boolean }>(({ theme, selected }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '10px 14px',
  cursor: 'pointer',
  transition: 'background 0.1s ease',
  background: selected
    ? theme.palette.mode === 'dark'
      ? 'rgba(29, 155, 209, 0.2)'
      : 'rgba(29, 155, 209, 0.1)'
    : 'transparent',
  '&:hover': {
    background: theme.palette.mode === 'dark'
      ? 'rgba(29, 155, 209, 0.15)'
      : 'rgba(29, 155, 209, 0.08)',
  },
}));

const TypeIcon = styled(Box)<{ itemType: string }>(({ itemType }) => ({
  width: 32,
  height: 32,
  borderRadius: '6px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  '& .MuiSvgIcon-root': {
    fontSize: 18,
  },
  ...(itemType === 'vocabulary' && {
    background: 'rgba(76, 175, 80, 0.15)',
    color: '#4CAF50',
  }),
  ...(itemType === 'concept' && {
    background: 'rgba(33, 150, 243, 0.15)',
    color: '#2196F3',
  }),
  ...(itemType === 'note' && {
    background: 'rgba(158, 158, 158, 0.15)',
    color: '#9E9E9E',
  }),
}));

const ItemContent = styled(Box)({
  flex: 1,
  minWidth: 0,
});

const ItemTitle = styled(Typography)({
  fontWeight: 500,
  fontSize: 14,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

const ItemDescription = styled(Typography)(({ theme }) => ({
  fontSize: 12,
  color: theme.palette.text.secondary,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}));

const TypeBadge = styled(Box)<{ itemType: string }>(({ itemType }) => ({
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  padding: '2px 6px',
  borderRadius: '4px',
  ...(itemType === 'vocabulary' && {
    background: 'rgba(76, 175, 80, 0.15)',
    color: '#4CAF50',
  }),
  ...(itemType === 'concept' && {
    background: 'rgba(33, 150, 243, 0.15)',
    color: '#2196F3',
  }),
  ...(itemType === 'note' && {
    background: 'rgba(158, 158, 158, 0.15)',
    color: '#757575',
  }),
}));

const EmptyState = styled(Box)(({ theme }) => ({
  padding: '24px',
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));

const LoadingState = styled(Box)({
  padding: '24px',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
});

export interface SuggestionItem {
  type: 'vocabulary' | 'concept' | 'note';
  id: string;
  title: string;
  description?: string;
  priority?: number;
}

interface LinkSuggestionMenuProps {
  query: string;
  position: { x: number; y: number } | null;
  onSelect: (item: SuggestionItem) => void;
  onClose: () => void;
}

export default function LinkSuggestionMenu({
  query,
  position,
  onSelect,
  onClose,
}: LinkSuggestionMenuProps) {
  const theme = useTheme();
  const menuRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<SuggestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Fetch suggestions
  useEffect(() => {
    if (!position) return;

    const fetchSuggestions = async () => {
      setLoading(true);

      try {
        // @ts-ignore - window.electron is defined in preload
        const results = await window.electron?.ipcRenderer?.invoke?.('get-link-suggestions', [query]);

        if (Array.isArray(results)) {
          setItems(results.map((r: any) => ({
            type: r.type,
            id: String(r.id),
            title: r.word || r.name || r.title || 'Untitled',
            description: r.definition?.substring(0, 80) || r.description?.substring(0, 80) || '',
            priority: r.priority || 3,
          })));
        } else {
          setItems([]);
        }
      } catch (err) {
        console.error('Failed to fetch suggestions:', err);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    // Debounce the fetch
    const timeoutId = setTimeout(fetchSuggestions, 150);
    return () => clearTimeout(timeoutId);
  }, [query, position]);

  // Reset selected index when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  // Keyboard navigation
  useEffect(() => {
    if (!position) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (items[selectedIndex]) {
            onSelect(items[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [position, items, selectedIndex, onSelect, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!position) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [position, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = menuRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedElement?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!position) return null;

  const getIcon = (type: string) => {
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

  return (
    <MenuContainer
      ref={menuRef}
      sx={{
        left: position.x,
        top: position.y,
      }}
    >
      <MenuHeader>
        <Typography variant="caption" color="text.secondary">
          Link to {query ? `"${query}"` : '...'}
        </Typography>
        <Typography variant="caption" sx={{ ml: 1, opacity: 0.6 }}>
          ↑↓ to navigate, Enter to select
        </Typography>
      </MenuHeader>

      <MenuList>
        {loading ? (
          <LoadingState>
            <CircularProgress size={24} />
          </LoadingState>
        ) : items.length === 0 ? (
          <EmptyState>
            <Typography variant="body2">
              {query ? `No matches for "${query}"` : 'Start typing to search'}
            </Typography>
          </EmptyState>
        ) : (
          items.map((item, index) => (
            <MenuItem
              key={`${item.type}-${item.id}`}
              data-index={index}
              selected={index === selectedIndex}
              onClick={() => onSelect(item)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <TypeIcon itemType={item.type}>{getIcon(item.type)}</TypeIcon>

              <ItemContent>
                <ItemTitle>{item.title}</ItemTitle>
                {item.description && <ItemDescription>{item.description}</ItemDescription>}
              </ItemContent>

              <TypeBadge itemType={item.type}>{item.type}</TypeBadge>
            </MenuItem>
          ))
        )}
      </MenuList>
    </MenuContainer>
  );
}
