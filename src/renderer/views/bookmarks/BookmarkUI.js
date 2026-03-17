import React from 'react';
import { useTheme, alpha } from '@mui/material';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import LinkIcon from '@mui/icons-material/Link';
import PublicIcon from '@mui/icons-material/Public';
import ArticleIcon from '@mui/icons-material/Article';
import BookIcon from '@mui/icons-material/Book';
import NewspaperIcon from '@mui/icons-material/Newspaper';
import SchoolIcon from '@mui/icons-material/School';
import CodeIcon from '@mui/icons-material/Code';
import ScienceIcon from '@mui/icons-material/Science';
import MovieIcon from '@mui/icons-material/Movie';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import BusinessIcon from '@mui/icons-material/Business';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';

import customStorage from '../../store/customStorage';

// Color palette for bookmark ribbons (when no image)
const RIBBON_COLORS = [
  { bg: '#E8F5E9', accent: '#4CAF50', icon: '#2E7D32' }, // Green
  { bg: '#E3F2FD', accent: '#2196F3', icon: '#1565C0' }, // Blue
  { bg: '#FFF3E0', accent: '#FF9800', icon: '#E65100' }, // Orange
  { bg: '#F3E5F5', accent: '#9C27B0', icon: '#6A1B9A' }, // Purple
  { bg: '#FFEBEE', accent: '#F44336', icon: '#C62828' }, // Red
  { bg: '#E0F7FA', accent: '#00BCD4', icon: '#00838F' }, // Cyan
  { bg: '#FFF8E1', accent: '#FFC107', icon: '#FF8F00' }, // Amber
  { bg: '#FCE4EC', accent: '#E91E63', icon: '#AD1457' }, // Pink
  { bg: '#E8EAF6', accent: '#3F51B5', icon: '#283593' }, // Indigo
  { bg: '#F1F8E9', accent: '#8BC34A', icon: '#558B2F' }, // Light Green
];

// Dark mode color palette
const RIBBON_COLORS_DARK = [
  { bg: '#1B3A1B', accent: '#4CAF50', icon: '#81C784' },
  { bg: '#0D2137', accent: '#2196F3', icon: '#64B5F6' },
  { bg: '#2D1B00', accent: '#FF9800', icon: '#FFB74D' },
  { bg: '#2A1B2E', accent: '#9C27B0', icon: '#BA68C8' },
  { bg: '#2D1515', accent: '#F44336', icon: '#E57373' },
  { bg: '#0A2A2D', accent: '#00BCD4', icon: '#4DD0E1' },
  { bg: '#2D2600', accent: '#FFC107', icon: '#FFD54F' },
  { bg: '#2D1520', accent: '#E91E63', icon: '#F06292' },
  { bg: '#1A1D2E', accent: '#3F51B5', icon: '#7986CB' },
  { bg: '#1D2A15', accent: '#8BC34A', icon: '#AED581' },
];

// Get icon based on domain or URL pattern
function getIconForUrl(url) {
  if (!url) return PublicIcon;
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('github') || lowerUrl.includes('stackoverflow') || lowerUrl.includes('gitlab')) {
    return CodeIcon;
  }
  if (lowerUrl.includes('youtube') || lowerUrl.includes('vimeo') || lowerUrl.includes('netflix')) {
    return MovieIcon;
  }
  if (lowerUrl.includes('spotify') || lowerUrl.includes('soundcloud')) {
    return MusicNoteIcon;
  }
  if (lowerUrl.includes('amazon') || lowerUrl.includes('ebay') || lowerUrl.includes('shop')) {
    return ShoppingCartIcon;
  }
  if (lowerUrl.includes('linkedin') || lowerUrl.includes('business')) {
    return BusinessIcon;
  }
  if (lowerUrl.includes('edu') || lowerUrl.includes('coursera') || lowerUrl.includes('udemy')) {
    return SchoolIcon;
  }
  if (lowerUrl.includes('arxiv') || lowerUrl.includes('nature.com') || lowerUrl.includes('science')) {
    return ScienceIcon;
  }
  if (lowerUrl.includes('news') || lowerUrl.includes('cnn') || lowerUrl.includes('bbc')) {
    return NewspaperIcon;
  }
  if (lowerUrl.includes('medium') || lowerUrl.includes('blog') || lowerUrl.includes('article')) {
    return ArticleIcon;
  }
  if (lowerUrl.includes('game') || lowerUrl.includes('steam') || lowerUrl.includes('twitch')) {
    return SportsEsportsIcon;
  }
  if (lowerUrl.includes('book') || lowerUrl.includes('read')) {
    return BookIcon;
  }

  return PublicIcon;
}

// Generate consistent color index from string
function getColorIndex(str) {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % RIBBON_COLORS.length;
}

function BookmarkUI({
  curBookmark,
  selectHandler,
  onDelete,
  onToggleStar,
}) {
  const [bookmark, setBookmark] = React.useState(null);
  const [imageBase64, setImageBase64] = React.useState('');
  const [isHovered, setIsHovered] = React.useState(false);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  React.useEffect(() => {
    if (!curBookmark) return;
    setBookmark(curBookmark);
    async function loadImage() {
      const base64 = await customStorage.getImage(curBookmark.image);
      setImageBase64(base64);
    }
    if (curBookmark.image) {
      loadImage();
    }
  }, [curBookmark]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const extractDomain = (url) => {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      return domain.length > 30 ? `${domain.slice(0, 27)}...` : domain;
    } catch {
      return '';
    }
  };

  const handleActionClick = (e, action) => {
    e.stopPropagation();
    action();
  };

  if (!bookmark) return null;

  const isStarred = bookmark.star === 1;
  const colorPalette = isDark ? RIBBON_COLORS_DARK : RIBBON_COLORS;
  const colorIndex = getColorIndex(bookmark.sourceKey);
  const colors = colorPalette[colorIndex];
  const IconComponent = getIconForUrl(bookmark.sourceKey);

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={selectHandler}
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        height: 72,
        borderRadius: '12px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: theme.palette.background.paper,
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateX(4px)',
          boxShadow: isDark
            ? `0 4px 20px ${alpha('#000', 0.4)}`
            : `0 4px 20px ${alpha('#000', 0.1)}`,
          borderColor: alpha(colors.accent, 0.4),
        },
      }}
    >
      {/* Left ribbon/image section */}
      <Box
        sx={{
          width: 72,
          minWidth: 72,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '12px 0 0 12px',
          bgcolor: imageBase64 ? 'transparent' : colors.bg,
        }}
      >
        {imageBase64 ? (
          <Box
            component="img"
            src={imageBase64}
            alt=""
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {/* Decorative bookmark notch */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '12px solid transparent',
                borderRight: '12px solid transparent',
                borderBottom: `10px solid ${theme.palette.background.paper}`,
              }}
            />
            <IconComponent
              sx={{
                fontSize: 28,
                color: colors.icon,
              }}
            />
          </Box>
        )}

        {/* Accent stripe on the left edge */}
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            bgcolor: colors.accent,
            borderRadius: '12px 0 0 12px',
          }}
        />
      </Box>

      {/* Content section */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          px: 2,
          py: 1,
          minWidth: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Default view - Title and Meta */}
        <Box
          sx={{
            transition: 'all 0.25s ease-in-out',
            transform: isHovered && bookmark.description ? 'translateY(-100%)' : 'translateY(0)',
            opacity: isHovered && bookmark.description ? 0 : 1,
          }}
        >
          {/* Title row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                fontSize: '0.9rem',
              }}
            >
              {bookmark.title || 'Untitled'}
            </Typography>
            {isStarred && !isHovered && (
              <StarIcon sx={{ fontSize: 16, color: theme.palette.warning.main, flexShrink: 0 }} />
            )}
          </Box>

          {/* Meta row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LinkIcon sx={{ fontSize: 12, color: theme.palette.text.disabled }} />
              <Typography
                variant="caption"
                sx={{ color: theme.palette.text.disabled, fontSize: '0.7rem' }}
              >
                {extractDomain(bookmark.sourceKey)}
              </Typography>
            </Box>
            {bookmark.createdAt && (
              <Typography
                variant="caption"
                sx={{ color: theme.palette.text.disabled, fontSize: '0.7rem' }}
              >
                {formatDate(bookmark.createdAt)}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Hover view - Description */}
        {bookmark.description && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 16,
              right: 16,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              transition: 'all 0.25s ease-in-out',
              transform: isHovered ? 'translateY(0)' : 'translateY(100%)',
              opacity: isHovered ? 1 : 0,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: '0.85rem',
                color: theme.palette.text.primary,
                mb: 0.25,
              }}
            >
              {bookmark.title || 'Untitled'}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                fontSize: '0.75rem',
                lineHeight: 1.4,
              }}
            >
              {bookmark.description}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Right action section */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          pr: 1.5,
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.15s ease',
        }}
      >
        <Tooltip title={isStarred ? 'Remove from favorites' : 'Add to favorites'}>
          <IconButton
            size="small"
            onClick={(e) => handleActionClick(e, () => onToggleStar?.(bookmark.id))}
            sx={{
              '&:hover': {
                bgcolor: alpha(theme.palette.warning.main, 0.1),
              },
            }}
          >
            {isStarred ? (
              <StarIcon sx={{ fontSize: 18, color: theme.palette.warning.main }} />
            ) : (
              <StarBorderIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        </Tooltip>
        {onDelete && (
          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={(e) => handleActionClick(e, () => onDelete(bookmark.id))}
              sx={{
                '&:hover': {
                  bgcolor: alpha(theme.palette.error.main, 0.1),
                  color: theme.palette.error.main,
                },
              }}
            >
              <DeleteOutlineIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Decorative right edge - like a bookmark ribbon tail */}
      <Box
        sx={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 6,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ flex: 1, bgcolor: colors.accent, opacity: 0.6 }} />
        <Box
          sx={{
            width: 0,
            height: 0,
            borderTop: '6px solid transparent',
            borderBottom: '6px solid transparent',
            borderRight: `6px solid ${theme.palette.background.default}`,
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        />
      </Box>
    </Box>
  );
}

export default BookmarkUI;
