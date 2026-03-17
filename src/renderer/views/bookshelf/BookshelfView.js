/* eslint-disable no-use-before-define */
import { useState, useEffect, useMemo } from 'react';
import { useTheme, alpha, styled } from '@mui/material/styles';
import { v4 as uuid } from 'uuid';
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
  Badge,
} from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { useSelector, useDispatch } from 'react-redux';

// Icons
import SearchIcon from '@mui/icons-material/Search';
import ViewStreamIcon from '@mui/icons-material/ViewStream';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import GridViewIcon from '@mui/icons-material/GridView';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import StarIcon from '@mui/icons-material/Star';
import ClearIcon from '@mui/icons-material/Clear';
import AddIcon from '@mui/icons-material/Add';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';

import BookUI from './BookUI';
import BookCardUI from './BookCardUI';
import BookSpineUI from './BookSpineUI';
import ImportFileAsBook from '../../components/ImportFileAsBook';
import { getBooksByQuery } from '../../api/booksApi';
import customStorage from '../../store/customStorage';
import { createBookshelf } from '../../api/bookshelfApi';
import { bookshelfAdded } from '../../store/reducers/bookshelfSlice';
import InputButton from '../../components/Button/InputButton';
import RenameBookshelfModal from './RenameBookshelfModal';
import DeleteBookshelfModal from './DeleteBookshelfModal';
import { mapToPredefinedColor } from '../../../commons/utils/CommonLangUtil';
import './book.styles.css';

// Styled components matching bookmark view
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

function RenderTree(node, onClick, selectedId, expandedItems, theme, onRename, onDelete) {
  const isSelected = node.id === selectedId;
  const isExpanded = expandedItems.includes(node.id.toString());
  const isMiscellaneous = node.id === -1;

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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25, pr: 1 }}>
          {/* Color indicator */}
          <Box
            sx={{
              width: 3,
              height: 20,
              borderRadius: 1,
              bgcolor: mapToPredefinedColor(node.name || 'Miscellaneous'),
              flexShrink: 0,
            }}
          />
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
            {node.name || 'Miscellaneous'}
          </Typography>
          {node.bookCount > 0 && (
            <Chip
              label={node.bookCount}
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
          {/* Actions on hover - only for non-miscellaneous */}
          {!isMiscellaneous && isSelected && (
            <Box sx={{ display: 'flex', gap: 0.25 }}>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onRename?.(node); }}
                sx={{ p: 0.25 }}
              >
                <DriveFileRenameOutlineIcon sx={{ fontSize: 14 }} />
              </IconButton>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onDelete?.(node); }}
                sx={{ p: 0.25, '&:hover': { color: theme.palette.error.main } }}
              >
                <DeleteForeverIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          )}
        </Box>
      }
    >
      {Array.isArray(node.children)
        ? node.children.map((childNode) =>
            RenderTree(childNode, onClick, selectedId, expandedItems, theme, onRename, onDelete)
          )
        : null}
    </StyledTreeItem>
  );
}

function BookshelfView() {
  const theme = useTheme();
  const dispatch = useDispatch();

  // State
  const [books, setBooks] = useState([]);
  const [bookShelfs, setBookShelfs] = useState([]);
  const [expandedItems, setExpandedItems] = useState([]);
  const [selectedShelfId, setSelectedShelfId] = useState(null);
  const [selectedShelfName, setSelectedShelfName] = useState('All Books');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('card'); // 'card', 'list', 'spine'
  const [sortBy, setSortBy] = useState('recent');
  const [quickFilter, setQuickFilter] = useState('all');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [curBookshelf, setCurBookshelf] = useState(null);
  const [openRenameModel, setOpenRenameModel] = useState(false);
  const [openDeleteModel, setOpenDeleteModel] = useState(false);

  const bookshelfList = useSelector((state) => state.bookshelf.bookshelfList);

  useEffect(() => {
    setBookShelfs(bookshelfList);
  }, [bookshelfList]);

  // Load data on mount
  useEffect(() => {
    async function fetchData() {
      const data = await getBooksByQuery();
      if (data) {
        data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setBooks(data);
      }
      const bs = await customStorage.getAllBookshelf();
      setBookShelfs(bs || []);
    }
    fetchData();
  }, []);

  const importFileCallback = (book) => {
    if (!book) return;
    setBooks([book, ...books]);
  };

  // Build tree data from bookshelfs
  const treeData = useMemo(() => {
    const booksInShelf = {};
    books.forEach((book) => {
      const bsid = book.bookshelfId ?? -1;
      booksInShelf[bsid] = (booksInShelf[bsid] || 0) + 1;
    });

    const shelves = bookShelfs.map((shelf) => ({
      id: shelf.id,
      name: shelf.name,
      bookCount: booksInShelf[shelf.id] || 0,
      children: [],
    }));

    // Add miscellaneous shelf
    shelves.push({
      id: -1,
      name: 'Miscellaneous',
      bookCount: booksInShelf[-1] || 0,
      children: [],
    });

    return {
      id: 'root',
      name: 'All Shelves',
      bookCount: books.length,
      children: shelves,
    };
  }, [bookShelfs, books]);

  // Handlers
  const handleExpandedItemsChange = (event, itemIds) => {
    setExpandedItems(itemIds);
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    setSelectedShelfId(null);
    setSelectedShelfName(query ? `Search: "${query}"` : 'All Books');
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedShelfName('All Books');
    setSelectedShelfId(null);
  };

  const handleNodeClick = (node) => {
    if (node.id === 'root') {
      setSelectedShelfId(null);
      setSelectedShelfName('All Books');
    } else {
      setSelectedShelfId(node.id);
      setSelectedShelfName(node.name || 'Miscellaneous');
    }
    setQuickFilter('all');
    setSearchQuery('');
  };

  const handleBookShelfChange = async (book, bookshelf) => {
    const r = await customStorage.changeBookshelf(book.id, bookshelf.id);
    if (r > 0) {
      setBooks(books.map((b) =>
        b.id === book.id ? { ...b, bookshelfId: bookshelf.id } : b
      ));
    }
  };

  const renameBookshelf = (shelf) => {
    setCurBookshelf(shelf);
    setOpenRenameModel(true);
  };

  const deleteBookshelf = (shelf) => {
    setCurBookshelf(shelf);
    setOpenDeleteModel(true);
  };

  // Filtered and sorted books
  const displayedBooks = useMemo(() => {
    let filtered = [...books];

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((book) =>
        book.name?.toLowerCase().includes(query) ||
        book.author?.toLowerCase().includes(query) ||
        book.description?.toLowerCase().includes(query)
      );
    }

    // Filter by selected shelf
    if (selectedShelfId !== null) {
      filtered = filtered.filter((book) => {
        const bookShelfId = book.bookshelfId ?? -1;
        return bookShelfId === selectedShelfId;
      });
    }

    // Apply quick filter
    if (quickFilter === 'favorites') {
      filtered = filtered.filter((b) => b.favorite === 1);
    } else if (quickFilter === 'epub') {
      filtered = filtered.filter((b) => b.format?.toLowerCase() === 'epub');
    } else if (quickFilter === 'pdf') {
      filtered = filtered.filter((b) => b.format?.toLowerCase() === 'pdf');
    }

    // Apply sort
    if (sortBy === 'recent') {
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === 'oldest') {
      filtered.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } else if (sortBy === 'title') {
      filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sortBy === 'author') {
      filtered.sort((a, b) => (a.author || '').localeCompare(b.author || ''));
    }

    return filtered;
  }, [books, searchQuery, selectedShelfId, quickFilter, sortBy]);

  const favoritesCount = books.filter((b) => b.favorite === 1).length;
  const epubCount = books.filter((b) => b.format?.toLowerCase() === 'epub').length;
  const pdfCount = books.filter((b) => b.format?.toLowerCase() === 'pdf').length;

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
              <AutoStoriesIcon sx={{ color: theme.palette.primary.main }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Library
            </Typography>
          </Box>

          {/* Search */}
          <SearchContainer>
            <SearchIcon sx={{ color: theme.palette.text.disabled, mr: 1, fontSize: 20 }} />
            <InputBase
              placeholder="Search books..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
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
              label={`Favorites (${favoritesCount})`}
              size="small"
              selected={quickFilter === 'favorites'}
              onClick={() => setQuickFilter('favorites')}
            />
            <QuickFilterChip
              label={`EPUB (${epubCount})`}
              size="small"
              selected={quickFilter === 'epub'}
              onClick={() => setQuickFilter('epub')}
            />
            <QuickFilterChip
              label={`PDF (${pdfCount})`}
              size="small"
              selected={quickFilter === 'pdf'}
              onClick={() => setQuickFilter('pdf')}
            />
          </Box>
        </SidebarSection>

        {/* Import Button */}
        <SidebarSection>
          <ImportFileAsBook
            importFileCallback={importFileCallback}
            variant="full"
          />
        </SidebarSection>

        {/* Folder Tree */}
        <Box sx={{ flex: 1, overflow: 'auto', px: 1.5, py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, px: 0.5 }}>
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.text.disabled,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Bookshelves
            </Typography>
            <InputButton
              variant="icon"
              icon={<AddIcon sx={{ fontSize: 16 }} />}
              tooltip="Create new shelf"
              dialogTitle="New Bookshelf"
              placeholder="Enter shelf name..."
              onSave={async (text) => {
                if (!text) return;
                const ns = await createBookshelf(text);
                dispatch(bookshelfAdded(ns));
              }}
            />
          </Box>
          {treeData && (
            <SimpleTreeView
              expandedItems={expandedItems}
              onExpandedItemsChange={handleExpandedItemsChange}
              defaultExpandedItems={['root']}
              sx={{
                '& .MuiTreeItem-group': {
                  marginLeft: 2,
                },
              }}
            >
              {RenderTree(
                treeData,
                handleNodeClick,
                selectedShelfId,
                expandedItems,
                theme,
                renameBookshelf,
                deleteBookshelf
              )}
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
              {selectedShelfName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {displayedBooks.length} book{displayedBooks.length !== 1 ? 's' : ''}
              {quickFilter !== 'all' && ` (filtered)`}
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
                <option value="author">By Author</option>
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
              <Tooltip title="Card view (covers)">
                <ToggleButton value="card">
                  <GridViewIcon sx={{ fontSize: 20 }} />
                </ToggleButton>
              </Tooltip>
              <Tooltip title="List view">
                <ToggleButton value="list">
                  <ViewStreamIcon sx={{ fontSize: 20 }} />
                </ToggleButton>
              </Tooltip>
              <Tooltip title="Spine view">
                <ToggleButton value="spine">
                  <ViewModuleIcon sx={{ fontSize: 20 }} />
                </ToggleButton>
              </Tooltip>
            </ToggleButtonGroup>
          </Box>
        </Box>

        {/* Books Grid/List */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 3,
          }}
        >
          {displayedBooks.length === 0 ? (
            <EmptyState
              icon={LibraryBooksIcon}
              title={searchQuery ? 'No results found' : 'No books yet'}
              subtitle={
                searchQuery
                  ? `Try searching with different keywords`
                  : `Import your first book to get started with your digital library`
              }
            />
          ) : viewMode === 'spine' ? (
            // Spine View
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                p: 3,
                borderRadius: 3,
                minHeight: 260,
                alignItems: 'flex-end',
                background: alpha(theme.palette.background.paper, 0.6),
                backdropFilter: 'blur(12px)',
                border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.08)}`,
              }}
            >
              {displayedBooks.map((book) => (
                <BookSpineUI
                  key={book.id}
                  id={book.id}
                  title={book.name}
                  author={book.author || ''}
                  description={book.description}
                  starred={!!book.favorite}
                />
              ))}
            </Box>
          ) : viewMode === 'list' ? (
            // List View
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
                maxWidth: 800,
              }}
            >
              {displayedBooks.map((book) => (
                <BookCardUI
                  key={book.id}
                  selectedBookKey={book.id}
                  bookShelfs={bookShelfs}
                  handleBookShelfChange={handleBookShelfChange}
                  viewMode="list"
                />
              ))}
            </Box>
          ) : (
            // Card View (Grid)
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 200px))',
                gap: 3,
              }}
            >
              {displayedBooks.map((book) => (
                <BookCardUI
                  key={book.id}
                  selectedBookKey={book.id}
                  bookShelfs={bookShelfs}
                  handleBookShelfChange={handleBookShelfChange}
                  viewMode="card"
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {/* Modals */}
      {curBookshelf && (
        <RenameBookshelfModal
          open={openRenameModel}
          bookshelf={curBookshelf}
          callback={setOpenRenameModel}
        />
      )}
      {curBookshelf && (
        <DeleteBookshelfModal
          open={openDeleteModel}
          bookshelf={curBookshelf}
          callback={setOpenDeleteModel}
        />
      )}
    </Box>
  );
}

export default BookshelfView;
