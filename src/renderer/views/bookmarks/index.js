import React, { useState, useEffect, useMemo } from 'react';
import { useTheme, alpha, styled } from '@mui/material/styles';
import {
  Box,
  Typography,
  IconButton,
  InputBase,
  Divider,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Collapse,
  Badge,
  Paper,
} from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { useNavigate } from 'react-router-dom';

// Icons
import SearchIcon from '@mui/icons-material/Search';
import ViewStreamIcon from '@mui/icons-material/ViewStream';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import StarIcon from '@mui/icons-material/Star';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SortIcon from '@mui/icons-material/Sort';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

import customStorage from '../../store/customStorage';
import BookmarkUI from './BookmarkUI';

// Styled components
const SearchContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  backgroundColor: alpha(theme.palette.text.primary, 0.04),
  borderRadius: theme.shape.borderRadius,
  padding: '4px 12px',
  transition: 'all 0.2s ease',
  border: `1px solid transparent`,
  '&:hover': {
    backgroundColor: alpha(theme.palette.text.primary, 0.06),
  },
  '&:focus-within': {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${alpha(theme.palette.primary.main, 0.5)}`,
    boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.1)}`,
  },
}));

const SidebarSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
}));

const QuickFilterChip = styled(Chip)(({ theme, selected }) => ({
  height: 28,
  fontSize: '0.75rem',
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

const StyledTreeItem = styled(TreeItem)(({ theme }) => ({
  '& .MuiTreeItem-content': {
    padding: '6px 8px',
    borderRadius: theme.shape.borderRadius,
    marginBottom: 2,
    '&:hover': {
      backgroundColor: alpha(theme.palette.primary.main, 0.08),
    },
    '&.Mui-selected': {
      backgroundColor: alpha(theme.palette.primary.main, 0.12),
      '&:hover': {
        backgroundColor: alpha(theme.palette.primary.main, 0.16),
      },
    },
  },
  '& .MuiTreeItem-label': {
    fontSize: '0.875rem',
    fontWeight: 500,
  },
}));

const EmptyState = ({ icon: Icon, title, subtitle }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        textAlign: 'center',
        px: 4,
      }}
    >
      <Box
        sx={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          mb: 3,
        }}
      >
        <Icon sx={{ fontSize: 40, color: theme.palette.primary.main, opacity: 0.7 }} />
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: theme.palette.text.primary }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280 }}>
        {subtitle}
      </Typography>
    </Box>
  );
};

function RenderTree(node, onClick, selectedId, expandedItems, theme) {
  const isSelected = node.id === selectedId;
  const isExpanded = expandedItems.includes(node.id.toString());

  return (
    <StyledTreeItem
      key={node.id}
      itemId={node.id.toString()}
      onClick={() => onClick(node)}
      slots={{
        collapseIcon: () => <ExpandMoreIcon sx={{ fontSize: 18 }} />,
        expandIcon: () => <ChevronRightIcon sx={{ fontSize: 18 }} />,
      }}
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
          {node.children?.length > 0 ? (
            isExpanded ? (
              <FolderOpenIcon sx={{ fontSize: 18, color: theme.palette.warning.main }} />
            ) : (
              <FolderIcon sx={{ fontSize: 18, color: theme.palette.warning.main }} />
            )
          ) : (
            <FolderIcon sx={{ fontSize: 18, color: alpha(theme.palette.text.secondary, 0.5) }} />
          )}
          <Typography
            variant="body2"
            sx={{
              fontWeight: isSelected ? 600 : 500,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {node.name || 'Uncategorized'}
          </Typography>
          {node.bookmarkCount > 0 && (
            <Chip
              label={node.bookmarkCount}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.7rem',
                fontWeight: 600,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main,
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          )}
        </Box>
      }
    >
      {Array.isArray(node.children)
        ? node.children.map((childNode) =>
            RenderTree(childNode, onClick, selectedId, expandedItems, theme)
          )
        : null}
    </StyledTreeItem>
  );
}

function BookmarksPage() {
  const theme = useTheme();
  const navigate = useNavigate();

  // State
  const [treeData, setTreeData] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [expandedItems, setExpandedItems] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedGroupName, setSelectedGroupName] = useState('All Bookmarks');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('comfortable');
  const [sortBy, setSortBy] = useState('recent');
  const [quickFilter, setQuickFilter] = useState('all');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load tree data on mount
  useEffect(() => {
    async function loadTreeData() {
      const data = await customStorage.jsonBookmarkGroupStructure();
      setTreeData(data);
      if (data) {
        setExpandedItems([data.id.toString()]);
      }
    }
    loadTreeData();
  }, []);

  // Handlers
  const handleExpandedItemsChange = (event, itemIds) => {
    setExpandedItems(itemIds);
  };

  const handleSearch = async (query) => {
    if (query.trim()) {
      const results = await customStorage.getBookmarkByQuery(query);
      setBookmarks(results || []);
      setSelectedGroupName(`Search: "${query}"`);
      setSelectedGroupId(null);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    if (selectedGroupId !== null) {
      handleNodeClick({ id: selectedGroupId, name: selectedGroupName });
    } else {
      setBookmarks([]);
      setSelectedGroupName('All Bookmarks');
    }
  };

  const handleNodeClick = async (node) => {
    setSelectedGroupId(node.id);
    setSelectedGroupName(node.name || 'Uncategorized');
    const results = await customStorage.getBookmarksByGroupId(node.id);
    setBookmarks(results || []);
    setQuickFilter('all');
    setSearchQuery('');
  };

  const handleBookmarkClick = (bookmark) => {
    const urlString = encodeURIComponent(bookmark.sourceKey);
    const escapedUrl = urlString.replace(/\//g, '\\/');
    navigate(`/browser/${escapedUrl}`);
  };

  const handleDeleteBookmark = async (id) => {
    await customStorage.deleteBookmarkById(id);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleToggleStar = async (id) => {
    const bookmark = bookmarks.find((b) => b.id === id);
    if (bookmark) {
      const newStar = bookmark.star === 1 ? 0 : 1;
      await customStorage.updateBookmark(id, 'star', newStar);
      setBookmarks((prev) =>
        prev.map((b) => (b.id === id ? { ...b, star: newStar } : b))
      );
    }
  };

  // Filtered and sorted bookmarks
  const displayedBookmarks = useMemo(() => {
    let filtered = [...bookmarks];

    // Apply quick filter
    if (quickFilter === 'starred') {
      filtered = filtered.filter((b) => b.star === 1);
    }

    // Apply sort
    if (sortBy === 'recent') {
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === 'oldest') {
      filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sortBy === 'title') {
      filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    return filtered;
  }, [bookmarks, quickFilter, sortBy]);

  const starredCount = bookmarks.filter((b) => b.star === 1).length;

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100vh',
        bgcolor: theme.palette.background.default,
        overflow: 'hidden',
      }}
    >
      {/* Sidebar */}
      <Box
        sx={{
          width: sidebarCollapsed ? 0 : 280,
          minWidth: sidebarCollapsed ? 0 : 280,
          height: '100vh',
          bgcolor: theme.palette.background.paper,
          borderRight: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.2s ease',
          overflow: 'hidden',
        }}
      >
        {/* Sidebar Header */}
        <SidebarSection sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(theme.palette.primary.main, 0.1),
              }}
            >
              <BookmarksIcon sx={{ color: theme.palette.primary.main }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Bookmarks
            </Typography>
          </Box>

          {/* Search */}
          <SearchContainer>
            <SearchIcon sx={{ color: theme.palette.text.disabled, mr: 1, fontSize: 20 }} />
            <InputBase
              placeholder="Search bookmarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
              sx={{ flex: 1, fontSize: '0.875rem' }}
            />
            {searchQuery && (
              <IconButton size="small" onClick={handleClearSearch} sx={{ p: 0.25 }}>
                <ClearIcon sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </SearchContainer>
        </SidebarSection>

        {/* Quick Filters */}
        <SidebarSection>
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.disabled,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'block',
              mb: 1,
            }}
          >
            Quick Filters
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            <QuickFilterChip
              label="All"
              size="small"
              selected={quickFilter === 'all'}
              onClick={() => setQuickFilter('all')}
            />
            <QuickFilterChip
              icon={<StarIcon sx={{ fontSize: '14px !important' }} />}
              label={`Starred (${starredCount})`}
              size="small"
              selected={quickFilter === 'starred'}
              onClick={() => setQuickFilter('starred')}
            />
          </Box>
        </SidebarSection>

        {/* Folder Tree */}
        <Box sx={{ flex: 1, overflow: 'auto', px: 1.5, py: 1 }}>
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.disabled,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'block',
              mb: 1,
              px: 0.5,
            }}
          >
            Folders
          </Typography>
          {treeData && (
            <SimpleTreeView
              expandedItems={expandedItems}
              onExpandedItemsChange={handleExpandedItemsChange}
              sx={{
                '& .MuiTreeItem-group': {
                  marginLeft: 2,
                },
              }}
            >
              {RenderTree(treeData, handleNodeClick, selectedGroupId, expandedItems, theme)}
            </SimpleTreeView>
          )}
        </Box>
      </Box>

      {/* Toggle Sidebar Button */}
      <IconButton
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        sx={{
          position: 'absolute',
          left: sidebarCollapsed ? 8 : 268,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 10,
          width: 24,
          height: 48,
          borderRadius: '0 4px 4px 0',
          bgcolor: theme.palette.background.paper,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderLeft: 'none',
          transition: 'left 0.2s ease',
          '&:hover': {
            bgcolor: alpha(theme.palette.primary.main, 0.08),
          },
        }}
      >
        {sidebarCollapsed ? (
          <ChevronRightIcon sx={{ fontSize: 16 }} />
        ) : (
          <ChevronRightIcon sx={{ fontSize: 16, transform: 'rotate(180deg)' }} />
        )}
      </IconButton>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header Bar */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: theme.palette.background.paper,
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {selectedGroupName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {displayedBookmarks.length} bookmark{displayedBookmarks.length !== 1 ? 's' : ''}
              {quickFilter === 'starred' && ` (showing starred only)`}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* Sort Dropdown */}
            <Tooltip title="Sort by">
              <Box
                component="select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                sx={{
                  appearance: 'none',
                  bgcolor: 'transparent',
                  border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                  borderRadius: 1,
                  px: 1.5,
                  py: 0.75,
                  pr: 3,
                  fontSize: '0.8rem',
                  color: theme.palette.text.secondary,
                  cursor: 'pointer',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath fill='%23888' d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                  '&:focus': {
                    outline: 'none',
                    borderColor: theme.palette.primary.main,
                  },
                }}
              >
                <option value="recent">Most Recent</option>
                <option value="oldest">Oldest First</option>
                <option value="title">By Title</option>
              </Box>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* View Mode Toggle */}
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={(e, value) => value && setViewMode(value)}
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  border: 'none',
                  borderRadius: 1,
                  px: 1,
                  py: 0.5,
                  '&.Mui-selected': {
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    color: theme.palette.primary.main,
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.15),
                    },
                  },
                },
              }}
            >
              <ToggleButton value="comfortable">
                <Tooltip title="Comfortable view">
                  <ViewStreamIcon sx={{ fontSize: 20 }} />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="compact">
                <Tooltip title="Compact view (2 columns)">
                  <ViewModuleIcon sx={{ fontSize: 20 }} />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>

        {/* Bookmarks Grid/List */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 3,
          }}
        >
          {displayedBookmarks.length === 0 ? (
            <EmptyState
              icon={BookmarksIcon}
              title={searchQuery ? 'No results found' : 'No bookmarks yet'}
              subtitle={
                searchQuery
                  ? `Try searching with different keywords`
                  : `Select a folder from the sidebar or create your first bookmark`
              }
            />
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: viewMode === 'compact'
                  ? 'repeat(auto-fill, minmax(400px, 1fr))'
                  : '1fr',
                gap: 1.5,
                maxWidth: viewMode === 'comfortable' ? 800 : '100%',
              }}
            >
              {displayedBookmarks.map((bookmark) => (
                <BookmarkUI
                  key={bookmark.id}
                  curBookmark={bookmark}
                  selectHandler={() => handleBookmarkClick(bookmark)}
                  onDelete={handleDeleteBookmark}
                  onToggleStar={handleToggleStar}
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default BookmarksPage;
