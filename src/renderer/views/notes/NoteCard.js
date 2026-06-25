/* eslint-disable react/no-array-index-key */
/* eslint-disable prettier/prettier */
import React, { useState, useEffect } from 'react';
import { useTheme, alpha } from '@mui/material/styles';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Rating,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';

// Icons
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import LaunchIcon from '@mui/icons-material/Launch';
import QuizIcon from '@mui/icons-material/Quiz';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import StickyNote2Icon from '@mui/icons-material/StickyNote2';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import LinkIcon from '@mui/icons-material/Link';
import ChatIcon from '@mui/icons-material/Chat';
import FlipIcon from '@mui/icons-material/Flip';
import FlashOnIcon from '@mui/icons-material/FlashOn';

import { noteAdded } from '../../store/reducers/moodBoardSlice';
import { getImage } from '../../api/booksApi';
import { getQuizProblemsBySourceKey } from '../../api/quizApi';
import { NoteType, CardType } from '../../../commons/model/Note';
import parseMarkdownToHtml from '../../components/note/NoteUtil';

// Color palette for note cards (similar to BookmarkUI)
const NOTE_COLORS = [
  { bg: '#FFF8E1', accent: '#FFC107', icon: '#FF8F00' }, // Amber - Default notes
  { bg: '#E3F2FD', accent: '#2196F3', icon: '#1565C0' }, // Blue - Book notes
  { bg: '#E8F5E9', accent: '#4CAF50', icon: '#2E7D32' }, // Green - URL notes
  { bg: '#F3E5F5', accent: '#9C27B0', icon: '#6A1B9A' }, // Purple - Chat notes
  { bg: '#FFEBEE', accent: '#F44336', icon: '#C62828' }, // Red
  { bg: '#E0F7FA', accent: '#00BCD4', icon: '#00838F' }, // Cyan
  { bg: '#FCE4EC', accent: '#E91E63', icon: '#AD1457' }, // Pink
  { bg: '#E8EAF6', accent: '#3F51B5', icon: '#283593' }, // Indigo
];

const NOTE_COLORS_DARK = [
  { bg: '#2D2600', accent: '#FFC107', icon: '#FFD54F' },
  { bg: '#0D2137', accent: '#2196F3', icon: '#64B5F6' },
  { bg: '#1B3A1B', accent: '#4CAF50', icon: '#81C784' },
  { bg: '#2A1B2E', accent: '#9C27B0', icon: '#BA68C8' },
  { bg: '#2D1515', accent: '#F44336', icon: '#E57373' },
  { bg: '#0A2A2D', accent: '#00BCD4', icon: '#4DD0E1' },
  { bg: '#2D1520', accent: '#E91E63', icon: '#F06292' },
  { bg: '#1A1D2E', accent: '#3F51B5', icon: '#7986CB' },
];

// Get icon based on source type
function getIconForSourceType(sourceType) {
  switch (sourceType) {
    case NoteType.Book:
      return MenuBookIcon;
    case NoteType.Url:
      return LinkIcon;
    case NoteType.Chat:
      return ChatIcon;
    default:
      return StickyNote2Icon;
  }
}

// Get color index based on source type and note color
function getColorIndex(note) {
  if (note.color) {
    // Try to find matching color
    const colorIndex = NOTE_COLORS.findIndex(
      (c) => c.accent.toLowerCase() === note.color.toLowerCase()
    );
    if (colorIndex >= 0) return colorIndex;
  }

  // Default colors based on source type
  switch (note.sourceType) {
    case NoteType.Book:
      return 1; // Blue
    case NoteType.Url:
      return 2; // Green
    case NoteType.Chat:
      return 3; // Purple
    default:
      return 0; // Amber
  }
}

// Truncate text with ellipsis
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

// Format date
function formatDate(dateObj) {
  if (!dateObj) return '';
  const { year, month, day } = dateObj;
  if (!year) return '';

  const date = new Date(year, (month || 1) - 1, day || 1);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function NoteCard({ note, viewMode, onDelete, onShowQuiz, onClick, selected, toolbarMode }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isDark = theme.palette.mode === 'dark';
  const activeMoodBoardId = useSelector((state) => state.moodBoard.activeMoodBoardId);

  const [isHovered, setIsHovered] = useState(false);
  const [imageBase64, setImageBase64] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [currentSide, setCurrentSide] = useState(0);
  const [htmlContent, setHtmlContent] = useState('');

  const colorPalette = isDark ? NOTE_COLORS_DARK : NOTE_COLORS;
  const colorIndex = getColorIndex(note);
  const colors = colorPalette[colorIndex];
  const IconComponent = getIconForSourceType(note.sourceType);

  const isListView = viewMode === 'list';
  const hasMultipleSides = note.cards && note.cards.length > 1;
  const hasMindmap = note.cards?.some((c) => c.type === CardType.MindMap);
  const hasQuiz = note.hasQuiz;

  // Load image for the current card side
  useEffect(() => {
    async function loadImage() {
      if (note.cards && note.cards[currentSide]?.image) {
        const imageId = note.cards[currentSide].image;
        if (typeof imageId === 'string' && imageId.startsWith('data:image')) {
          setImageBase64(imageId);
        } else {
          const base64 = await getImage(imageId);
          setImageBase64(base64);
        }
      } else {
        setImageBase64(null);
      }
    }
    loadImage();
  }, [note, currentSide]);

  // Parse markdown content
  useEffect(() => {
    const cardText = note.cards?.[currentSide]?.text || '';
    parseMarkdownToHtml(truncateText(cardText, isListView ? 150 : 200), (html) => {
      setHtmlContent(html);
    });
  }, [note, currentSide, isListView]);

  const handleMenuClick = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleJumpToSource = (e) => {
    if (e) e.stopPropagation();
    handleMenuClose();
    if (note.sourceType === NoteType.Book && note.sourceKey) {
      navigate(`/reading/${note.sourceKey}`);
    } else if (note.sourceType === NoteType.Url && note.sourceKey) {
      const urlString = encodeURIComponent(note.sourceKey);
      navigate(`/browser/${urlString}`);
    } else if (note.sourceType === NoteType.Chat && note.sourceKey) {
      navigate(`/chats/${note.sourceKey}`);
    }
  };

  const handleShowQuiz = async (e) => {
    if (e) e.stopPropagation();
    handleMenuClose();
    if (!note.hasQuiz) return;
    const quizList = await getQuizProblemsBySourceKey(note.id);
    if (quizList && quizList.length > 0) {
      onShowQuiz(quizList);
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    handleMenuClose();
    onDelete(note);
  };

  const handleFlipSide = (e) => {
    e.stopPropagation();
    setCurrentSide((prev) => (prev + 1) % note.cards.length);
  };

  const handleCardClick = () => {
    if (onClick) onClick(note);
  };

  // List view — mirrors bookmarks/BookmarkUI: thumbnail when image exists, text-only otherwise
  if (isListView) {
    return (
      <Box
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleCardClick}
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'stretch',
          height: 72,
          borderRadius: '10px',
          cursor: 'pointer',
          overflow: 'hidden',
          bgcolor: selected
            ? alpha(colors.accent, isDark ? 0.14 : 0.08)
            : theme.palette.background.paper,
          border: `1px solid ${selected ? alpha(colors.accent, 0.45) : alpha(theme.palette.divider, 0.08)}`,
          transition: 'all 0.18s ease',
          '&:hover': {
            transform: selected ? 'none' : 'translateX(3px)',
            boxShadow: isDark
              ? `0 3px 14px ${alpha('#000', 0.35)}`
              : `0 3px 14px ${alpha('#000', 0.08)}`,
            borderColor: alpha(colors.accent, 0.4),
          },
        }}
      >
        {/* Left thumbnail — only when image present; accent stripe otherwise */}
        {imageBase64 ? (
          <Box
            sx={{
              width: 72,
              minWidth: 72,
              height: '100%',
              position: 'relative',
              overflow: 'hidden',
              borderRadius: '10px 0 0 10px',
            }}
          >
            <Box
              component="img"
              src={imageBase64}
              alt=""
              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <Box
              sx={{
                position: 'absolute',
                left: 0, top: 0, bottom: 0,
                width: 3,
                bgcolor: colors.accent,
              }}
            />
          </Box>
        ) : (
          <Box
            sx={{
              width: 3,
              minWidth: 3,
              bgcolor: selected ? colors.accent : alpha(colors.accent, 0.4),
              borderRadius: '10px 0 0 10px',
              transition: 'background-color 0.18s ease',
            }}
          />
        )}

        {/* Text content */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            px: imageBase64 ? 1.5 : 1.75,
            py: 1,
            minWidth: 0,
          }}
        >
          {note.title ? (
            <>
              {/* Title + date */}
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.3 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: selected ? 600 : 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                    fontSize: '0.875rem',
                    color: selected ? colors.accent : 'text.primary',
                  }}
                >
                  {note.title}
                </Typography>
                {note.date && (
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.disabled', fontSize: '0.68rem', flexShrink: 0 }}
                  >
                    {formatDate(note.date)}
                  </Typography>
                )}
              </Box>
              {/* Content preview */}
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: '0.775rem',
                  lineHeight: 1.4,
                  '& p, & h1, & h2, & h3': { display: 'inline', margin: 0 },
                }}
                dangerouslySetInnerHTML={{ __html: htmlContent }}
              />
            </>
          ) : (
            /* No title — give content two lines instead of one so a
               titleless note actually reveals what it is about. */
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                fontSize: '0.825rem',
                lineHeight: 1.4,
                '& p, & h1, & h2, & h3': { display: 'inline', margin: 0 },
              }}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          )}
        </Box>

        {/* Actions: absolute-positioned right-side overlay revealed on
            hover. Solid bg matches the card so the icons cover (not
            push) the content beneath — this is why the outer Box has
            position: relative. */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 0.25,
            pl: 1.25,
            pr: 0.75,
            flexShrink: 0,
            bgcolor: selected
              ? alpha(colors.accent, isDark ? 0.14 : 0.08)
              : theme.palette.background.paper,
            opacity: isHovered ? 1 : 0,
            pointerEvents: isHovered ? 'auto' : 'none',
            transition: 'opacity 0.15s ease',
          }}
        >
          {toolbarMode ? (
            <>
              {note.sourceKey && (
                <Tooltip title="Jump to Source">
                  <IconButton size="small" onClick={handleJumpToSource}>
                    <LaunchIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Tooltip>
              )}
              {hasQuiz && (
                <Tooltip title="Show Quiz">
                  <IconButton size="small" onClick={handleShowQuiz}>
                    <QuizIcon sx={{ fontSize: 15 }} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={activeMoodBoardId ? 'Add to Active Board' : 'Add to Board'}>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch(noteAdded(null));
                    dispatch(noteAdded(note));
                    navigate('/moodboard');
                  }}
                >
                  <FlashOnIcon sx={{ fontSize: 15, color: activeMoodBoardId ? 'success.main' : 'text.disabled' }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton size="small" onClick={handleDelete}>
                  <DeleteOutlineIcon sx={{ fontSize: 15, color: 'error.main' }} />
                </IconButton>
              </Tooltip>
            </>
          ) : (
            <IconButton size="small" onClick={handleMenuClick}>
              <MoreVertIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>

        {/* Context menu (used when toolbarMode is off) */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          {note.sourceKey && (
            <MenuItem onClick={handleJumpToSource}>
              <ListItemIcon><LaunchIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Jump to Source</ListItemText>
            </MenuItem>
          )}
          {hasQuiz && (
            <MenuItem onClick={handleShowQuiz}>
              <ListItemIcon><QuizIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Show Quiz</ListItemText>
            </MenuItem>
          )}
          <MenuItem
            onClick={() => {
              handleMenuClose();
              dispatch(noteAdded(null));
              dispatch(noteAdded(note));
              navigate('/moodboard');
            }}
          >
            <ListItemIcon>
              <FlashOnIcon fontSize="small" sx={{ color: activeMoodBoardId ? 'success.main' : 'text.disabled' }} />
            </ListItemIcon>
            <ListItemText>
              {activeMoodBoardId ? 'Add to Active Board' : 'Add to Board (open MoodBoard first)'}
            </ListItemText>
          </MenuItem>
          <MenuItem onClick={handleDelete}>
            <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText sx={{ color: theme.palette.error.main }}>Delete</ListItemText>
          </MenuItem>
        </Menu>
      </Box>
    );
  }

  // Grid/Compact view layout (vertical card)
  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '16px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: theme.palette.background.paper,
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        transition: 'all 0.25s ease-in-out',
        height: viewMode === 'compact' ? 200 : 280,
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: isDark
            ? `0 8px 30px ${alpha('#000', 0.4)}`
            : `0 8px 30px ${alpha('#000', 0.12)}`,
          borderColor: alpha(colors.accent, 0.4),
        },
      }}
    >
      {/* Top accent bar */}
      <Box
        sx={{
          height: 4,
          bgcolor: colors.accent,
          borderRadius: '16px 16px 0 0',
        }}
      />

      {/* Image area (if has image) */}
      {imageBase64 && viewMode !== 'compact' && (
        <Box
          sx={{
            height: 100,
            position: 'relative',
            overflow: 'hidden',
            bgcolor: colors.bg,
          }}
        >
          <Box
            component="img"
            src={imageBase64}
            alt=""
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transition: 'transform 0.3s ease',
              transform: isHovered ? 'scale(1.05)' : 'scale(1)',
            }}
          />
          {/* Gradient overlay */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '50%',
              background: `linear-gradient(transparent, ${theme.palette.background.paper})`,
            }}
          />
        </Box>
      )}

      {/* Content area */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          p: 2,
          pt: imageBase64 && viewMode !== 'compact' ? 1 : 2,
        }}
      >
        {/* Header with icon and rating */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            mb: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: colors.bg,
              }}
            >
              <IconComponent sx={{ fontSize: 18, color: colors.icon }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: '0.9rem',
                  lineHeight: 1.3,
                }}
              >
                {note.title || 'Untitled Note'}
              </Typography>
              {note.date && (
                <Typography
                  variant="caption"
                  sx={{ color: theme.palette.text.disabled, fontSize: '0.7rem' }}
                >
                  {formatDate(note.date)}
                </Typography>
              )}
            </Box>
          </Box>

          {/* Actions: inline toolbar (Notes Page) or 3-dot menu (other contexts) */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
              opacity: isHovered ? 1 : 0,
              transition: 'opacity 0.15s ease',
              flexShrink: 0,
            }}
          >
            {toolbarMode ? (
              <>
                {note.sourceKey && (
                  <Tooltip title="Jump to Source">
                    <IconButton size="small" onClick={handleJumpToSource}>
                      <LaunchIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
                {hasQuiz && (
                  <Tooltip title="Show Quiz">
                    <IconButton size="small" onClick={handleShowQuiz}>
                      <QuizIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title={activeMoodBoardId ? 'Add to Active Board' : 'Add to Board'}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch(noteAdded(null));
                      dispatch(noteAdded(note));
                      navigate('/moodboard');
                    }}
                  >
                    <FlashOnIcon sx={{ fontSize: 16, color: activeMoodBoardId ? 'success.main' : 'text.disabled' }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" onClick={handleDelete}>
                    <DeleteOutlineIcon sx={{ fontSize: 16, color: 'error.main' }} />
                  </IconButton>
                </Tooltip>
              </>
            ) : (
              <IconButton size="small" onClick={handleMenuClick}>
                <MoreVertIcon sx={{ fontSize: 18 }} />
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Content preview */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            flex: 1,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: viewMode === 'compact' ? 2 : 3,
            WebkitBoxOrient: 'vertical',
            fontSize: '0.8rem',
            lineHeight: 1.5,
            mb: 1.5,
          }}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />

        {/* Footer */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mt: 'auto',
          }}
        >
          {/* Tags */}
          <Box sx={{ display: 'flex', gap: 0.5, flex: 1, overflow: 'hidden' }}>
            {note.tags &&
              note.tags.slice(0, 2).map((tag, i) => (
                <Chip
                  key={i}
                  label={tag}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.65rem',
                    bgcolor: alpha(colors.accent, 0.1),
                    color: colors.icon,
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              ))}
          </Box>

          {/* Feature icons and rating */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {hasMultipleSides && (
              <Tooltip title={`${note.cards.length} sides`}>
                <IconButton size="small" onClick={handleFlipSide}>
                  <FlipIcon sx={{ fontSize: 16, color: theme.palette.text.disabled }} />
                </IconButton>
              </Tooltip>
            )}
            {hasMindmap && (
              <Tooltip title="Has mindmap">
                <AccountTreeIcon
                  sx={{ fontSize: 16, color: theme.palette.text.disabled }}
                />
              </Tooltip>
            )}
            {hasQuiz && (
              <Tooltip title="Has quiz">
                <QuizIcon
                  sx={{ fontSize: 16, color: theme.palette.text.disabled }}
                />
              </Tooltip>
            )}
            <Rating
              value={note.rate || 0}
              readOnly
              size="small"
              sx={{ '& .MuiRating-icon': { fontSize: 14 } }}
            />
          </Box>
        </Box>
      </Box>

      {/* Context menu (used when toolbarMode is off) */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {note.sourceKey && (
          <MenuItem onClick={handleJumpToSource}>
            <ListItemIcon><LaunchIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Jump to Source</ListItemText>
          </MenuItem>
        )}
        {hasQuiz && (
          <MenuItem onClick={handleShowQuiz}>
            <ListItemIcon><QuizIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Show Quiz</ListItemText>
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            handleMenuClose();
            dispatch(noteAdded(null));
            dispatch(noteAdded(note));
            navigate('/moodboard');
          }}
        >
          <ListItemIcon>
            <FlashOnIcon fontSize="small" sx={{ color: activeMoodBoardId ? 'success.main' : 'text.disabled' }} />
          </ListItemIcon>
          <ListItemText>
            {activeMoodBoardId ? 'Add to Active Board' : 'Add to Board (open MoodBoard first)'}
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={handleDelete}>
          <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText sx={{ color: theme.palette.error.main }}>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Side indicator (if multiple sides) */}
      {hasMultipleSides && (
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            display: 'flex',
            gap: 0.5,
          }}
        >
          {note.cards.map((_, i) => (
            <Box
              key={i}
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                bgcolor:
                  i === currentSide
                    ? colors.accent
                    : alpha(theme.palette.text.primary, 0.2),
                transition: 'background-color 0.2s ease',
              }}
            />
          ))}
        </Box>
      )}

    </Box>
  );
}

export default NoteCard;
