/* eslint-disable radix */
/* eslint-disable camelcase */
import { useState, useEffect, useRef } from 'react';
import { useTheme, alpha } from '@mui/material/styles';
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Menu,
  MenuItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  Divider,
} from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import MoveUpIcon from '@mui/icons-material/MoveUp';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import LanguageIcon from '@mui/icons-material/Language';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonIcon from '@mui/icons-material/Person';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import ImageIcon from '@mui/icons-material/Image';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { useDispatch } from 'react-redux';
import { NavLink } from 'react-router-dom';
import { useGetBookByIdQuery, bookApi } from '../../store/api/bookApiSlice';
import { updateBook, createImage } from '../../api/booksApi';
import { mapToPredefinedColor } from '../../../commons/utils/CommonLangUtil';

const CARD_WIDTH = 180;
const COVER_HEIGHT = 240;

// Beautiful color palettes for generated covers
const COVER_PALETTES = [
  { primary: '#1a365d', secondary: '#2c5282', accent: '#4299e1', pattern: 'geometric' },
  { primary: '#22543d', secondary: '#276749', accent: '#48bb78', pattern: 'waves' },
  { primary: '#744210', secondary: '#975a16', accent: '#ecc94b', pattern: 'dots' },
  { primary: '#553c9a', secondary: '#6b46c1', accent: '#9f7aea', pattern: 'lines' },
  { primary: '#9b2c2c', secondary: '#c53030', accent: '#fc8181', pattern: 'circles' },
  { primary: '#285e61', secondary: '#2c7a7b', accent: '#4fd1c5', pattern: 'zigzag' },
  { primary: '#7b341e', secondary: '#9c4221', accent: '#ed8936', pattern: 'geometric' },
  { primary: '#702459', secondary: '#97266d', accent: '#ed64a6', pattern: 'waves' },
  { primary: '#2a4365', secondary: '#2b6cb0', accent: '#63b3ed', pattern: 'dots' },
  { primary: '#234e52', secondary: '#285e61', accent: '#38b2ac', pattern: 'lines' },
];

// Color palette for list view ribbons
const RIBBON_COLORS = [
  { bg: '#E8F5E9', accent: '#4CAF50', icon: '#2E7D32' },
  { bg: '#E3F2FD', accent: '#2196F3', icon: '#1565C0' },
  { bg: '#FFF3E0', accent: '#FF9800', icon: '#E65100' },
  { bg: '#F3E5F5', accent: '#9C27B0', icon: '#6A1B9A' },
  { bg: '#FFEBEE', accent: '#F44336', icon: '#C62828' },
  { bg: '#E0F7FA', accent: '#00BCD4', icon: '#00838F' },
  { bg: '#FFF8E1', accent: '#FFC107', icon: '#FF8F00' },
  { bg: '#FCE4EC', accent: '#E91E63', icon: '#AD1457' },
  { bg: '#E8EAF6', accent: '#3F51B5', icon: '#283593' },
  { bg: '#F1F8E9', accent: '#8BC34A', icon: '#558B2F' },
];

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

// Get format icon based on book format
function getFormatIcon(format, size = 14) {
  switch (format?.toLowerCase()) {
    case 'pdf':
      return <PictureAsPdfIcon sx={{ fontSize: size }} />;
    case 'zip':
    case 'r9':
      return <LanguageIcon sx={{ fontSize: size }} />;
    default:
      return <MenuBookIcon sx={{ fontSize: size }} />;
  }
}

// Generate consistent index from string
function getColorIndex(str, paletteLength = 10) {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % paletteLength;
}

// Format the date nicely
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

// Generate SVG pattern based on type
function getPatternSVG(pattern, color) {
  const encodedColor = encodeURIComponent(color);
  switch (pattern) {
    case 'geometric':
      return `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L60 30L30 60L0 30z' fill='none' stroke='${encodedColor}' stroke-width='1'/%3E%3C/svg%3E")`;
    case 'waves':
      return `url("data:image/svg+xml,%3Csvg width='100' height='20' viewBox='0 0 100 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 10 Q25 0 50 10 T100 10' fill='none' stroke='${encodedColor}' stroke-width='1'/%3E%3C/svg%3E")`;
    case 'dots':
      return `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='10' cy='10' r='2' fill='${encodedColor}'/%3E%3C/svg%3E")`;
    case 'lines':
      return `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40L40 0' fill='none' stroke='${encodedColor}' stroke-width='1'/%3E%3C/svg%3E")`;
    case 'circles':
      return `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='30' cy='30' r='20' fill='none' stroke='${encodedColor}' stroke-width='1'/%3E%3C/svg%3E")`;
    case 'zigzag':
      return `url("data:image/svg+xml,%3Csvg width='40' height='12' viewBox='0 0 40 12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 6L10 0L20 6L30 0L40 6L30 12L20 6L10 12z' fill='none' stroke='${encodedColor}' stroke-width='1'/%3E%3C/svg%3E")`;
    default:
      return 'none';
  }
}

// Creative Generated Book Cover Component
function GeneratedBookCover({ title, author, format, palette }) {
  const initials = title
    ? title.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : 'B';

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        background: `linear-gradient(160deg, ${palette.primary} 0%, ${palette.secondary} 100%)`,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Pattern overlay */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: getPatternSVG(palette.pattern, `${palette.accent}30`),
          backgroundRepeat: 'repeat',
          opacity: 0.6,
        }}
      />

      {/* Top decorative band */}
      <Box
        sx={{
          height: '8px',
          background: `linear-gradient(90deg, ${palette.accent}, transparent)`,
        }}
      />

      {/* Main content area */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          p: 2,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Large initial letter */}
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '12px',
            background: `linear-gradient(135deg, ${palette.accent}40, ${palette.accent}20)`,
            border: `2px solid ${palette.accent}60`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
            backdropFilter: 'blur(4px)',
          }}
        >
          <Typography
            sx={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#fff',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            }}
          >
            {initials}
          </Typography>
        </Box>

        {/* Title */}
        <Typography
          sx={{
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.9rem',
            textAlign: 'center',
            textShadow: '0 2px 8px rgba(0,0,0,0.4)',
            lineHeight: 1.3,
            maxHeight: '60px',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            px: 1,
          }}
        >
          {title || 'Untitled'}
        </Typography>

        {/* Author */}
        {author && (
          <Typography
            sx={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: '0.7rem',
              fontWeight: 500,
              mt: 1,
              textShadow: '0 1px 4px rgba(0,0,0,0.3)',
              textAlign: 'center',
              maxWidth: '90%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {author}
          </Typography>
        )}
      </Box>

      {/* Bottom decorative section */}
      <Box
        sx={{
          height: '40px',
          background: `linear-gradient(180deg, transparent, rgba(0,0,0,0.3))`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
        }}
      >
        <AutoStoriesIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }} />
        <Typography
          sx={{
            fontSize: '0.6rem',
            color: 'rgba(255,255,255,0.6)',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          {format?.toUpperCase() || 'BOOK'}
        </Typography>
      </Box>

      {/* Decorative corner accent */}
      <Box
        sx={{
          position: 'absolute',
          top: 20,
          right: -20,
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${palette.accent}30, transparent 70%)`,
        }}
      />

      {/* Spine effect */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: '4px',
          background: `linear-gradient(180deg, ${palette.accent}80, ${palette.accent}40)`,
        }}
      />
    </Box>
  );
}

function BookCardUI({
  selectedBookKey,
  closeCallback,
  bookShelfs,
  handleBookShelfChange,
  viewMode = 'card',
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const dispatch = useDispatch();
  const [selectedBook, setSelectedBook] = useState(null);
  const { data: result } = useGetBookByIdQuery(selectedBookKey);

  const [imageSrc, setImageSrc] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [isHovered, setIsHovered] = useState(false);

  // Hidden file input ref for cover image selection
  const fileInputRef = useRef(null);

  const handleMenuOpen = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setAnchorEl(null);
  };

  const handleMenuClose2 = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setAnchorEl(null);
    if (closeCallback) closeCallback(event);
  };

  // Validate image by preloading it
  useEffect(() => {
    if (!result) return;
    const { book, image } = result;
    if (!book) return;
    setSelectedBook(book);

    // Reset image state when book changes
    setImageLoaded(false);
    setImageSrc(null);

    // Validate image data before attempting to load
    // Image must exist and be a valid base64 data URI
    const isValidImageData = image &&
      typeof image === 'string' &&
      image.startsWith('data:image/') &&
      image.includes('base64,') &&
      image.length > 100; // Minimum length for a valid image

    if (isValidImageData) {
      // Preload the image to check if it's valid
      const img = new Image();
      img.onload = () => {
        // Image loaded successfully - check if it has valid dimensions
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
          setImageSrc(image);
          setImageLoaded(true);
        }
      };
      img.onerror = () => {
        // Image failed to load - will show generated cover
        setImageLoaded(false);
        setImageSrc(null);
      };
      img.src = image;
    }
  }, [result]);

  // Handle image load error (backup for runtime errors)
  const handleImageError = () => {
    setImageLoaded(false);
    setImageSrc(null);
  };

  function toggleFavorite(e) {
    if (!selectedBook) return;
    e.preventDefault();
    e.stopPropagation();
    const { favorite } = selectedBook;
    setSelectedBook({ ...selectedBook, favorite: favorite === 0 ? 1 : 0 });
    updateBook({
      id: selectedBook.id,
      field: 'favorite',
      value: favorite === 0 ? 1 : 0,
    });
  }

  const handleActionClick = (e, action) => {
    e.stopPropagation();
    e.preventDefault();
    action();
  };

  // Handle change cover - trigger file input
  const handleChangeCover = (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleMenuClose();
    // Trigger the hidden file input
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Handle file selection for cover image
  const handleFileSelect = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file || !selectedBook) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.log('BookCardUI: Selected file is not an image');
      return;
    }

    // Read file and convert to base64
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result;
      if (!dataUrl || typeof dataUrl !== 'string') return;

      try {
        // Resize image to reasonable cover dimensions
        const img = new Image();
        img.onload = async () => {
          const maxWidth = 360;
          const maxHeight = 480;
          let { width, height } = img;

          // Scale down if needed
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          // Create canvas and draw resized image
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const resizedDataUrl = canvas.toDataURL('image/png');

          // Save to database
          const result = await createImage(resizedDataUrl);
          if (result && result.id && result.id !== -1) {
            await updateBook({
              id: selectedBook.id,
              field: 'cover',
              value: result.id,
            });
            // Update local state
            setSelectedBook({ ...selectedBook, cover: result.id });
            setImageSrc(resizedDataUrl);
            setImageLoaded(true);
            // Invalidate the query to refresh data
            dispatch(bookApi.util.invalidateTags(['Book']));
          }
        };
        img.src = dataUrl;
      } catch (error) {
        console.log('BookCardUI: Error saving cover image:', error);
      }
    };
    reader.readAsDataURL(file);

    // Reset file input so same file can be selected again
    e.target.value = '';
  };

  // Handle remove cover
  const handleRemoveCover = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleMenuClose();

    if (!selectedBook) return;

    try {
      // Set cover to empty string to remove it
      await updateBook({
        id: selectedBook.id,
        field: 'cover',
        value: '',
      });
      // Update local state
      setSelectedBook({ ...selectedBook, cover: '' });
      setImageSrc(null);
      setImageLoaded(false);
      // Invalidate the query to refresh data
      dispatch(bookApi.util.invalidateTags(['Book']));
    } catch (error) {
      console.log('BookCardUI: Error removing cover:', error);
    }
  };

  if (selectedBook == null) {
    return (
      <Box
        sx={{
          width: viewMode === 'list' ? '100%' : CARD_WIDTH,
          height: viewMode === 'list' ? 72 : COVER_HEIGHT + 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '12px',
          bgcolor: alpha(theme.palette.text.primary, 0.03),
        }}
      >
        <Typography variant="caption" color="text.disabled">
          Loading...
        </Typography>
      </Box>
    );
  }

  const colorPalette = isDark ? RIBBON_COLORS_DARK : RIBBON_COLORS;
  const colorIndex = getColorIndex(selectedBook.name);
  const colors = colorPalette[colorIndex];
  const coverPalette = COVER_PALETTES[colorIndex];
  const hasValidImage = imageSrc && imageLoaded;
  const isFavorite = selectedBook.favorite === 1;

  // List View - Bookmark-style ribbon card
  if (viewMode === 'list') {
    return (
      <NavLink
        key={selectedBook.id}
        to={
          selectedBook.format === 'zip' || selectedBook.format === 'r9'
            ? `/browser/${selectedBook.id}`
            : `/reading/${selectedBook.id}`
        }
        style={{ textDecoration: 'none' }}
      >
        <Box
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
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
              bgcolor: hasValidImage ? 'transparent' : colors.bg,
            }}
          >
            {hasValidImage ? (
              <Box
                component="img"
                src={imageSrc}
                alt=""
                onError={handleImageError}
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
                  background: `linear-gradient(135deg, ${coverPalette.primary}, ${coverPalette.secondary})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {/* Mini pattern */}
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: getPatternSVG(coverPalette.pattern, `${coverPalette.accent}40`),
                    backgroundRepeat: 'repeat',
                    opacity: 0.5,
                  }}
                />
                {/* Initial */}
                <Typography
                  sx={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: '#fff',
                    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  {selectedBook.name?.charAt(0)?.toUpperCase() || 'B'}
                </Typography>
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
                transform: isHovered && selectedBook.description ? 'translateY(-100%)' : 'translateY(0)',
                opacity: isHovered && selectedBook.description ? 0 : 1,
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
                  {selectedBook.name || 'Untitled'}
                </Typography>
                {isFavorite && !isHovered && (
                  <FavoriteIcon sx={{ fontSize: 16, color: '#e91e63', flexShrink: 0 }} />
                )}
              </Box>

              {/* Meta row */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {selectedBook.author && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <PersonIcon sx={{ fontSize: 12, color: theme.palette.text.disabled }} />
                    <Typography
                      variant="caption"
                      sx={{ color: theme.palette.text.disabled, fontSize: '0.7rem' }}
                    >
                      {selectedBook.author}
                    </Typography>
                  </Box>
                )}
                <Chip
                  icon={getFormatIcon(selectedBook.format, 12)}
                  label={selectedBook.format?.toUpperCase() || 'BOOK'}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    bgcolor: alpha(colors.accent, 0.1),
                    color: colors.accent,
                    '& .MuiChip-icon': {
                      color: colors.accent,
                      ml: 0.5,
                    },
                    '& .MuiChip-label': {
                      px: 0.5,
                    },
                  }}
                />
                {selectedBook.createdAt && (
                  <Typography
                    variant="caption"
                    sx={{ color: theme.palette.text.disabled, fontSize: '0.7rem' }}
                  >
                    {formatDate(selectedBook.createdAt)}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Hover view - Description */}
            {selectedBook.description && (
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
                  {selectedBook.name || 'Untitled'}
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
                  {selectedBook.description}
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
            <Tooltip title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
              <IconButton
                size="small"
                onClick={(e) => handleActionClick(e, () => toggleFavorite(e))}
                sx={{
                  '&:hover': {
                    bgcolor: alpha('#e91e63', 0.1),
                  },
                }}
              >
                {isFavorite ? (
                  <FavoriteIcon sx={{ fontSize: 18, color: '#e91e63' }} />
                ) : (
                  <FavoriteBorderIcon sx={{ fontSize: 18 }} />
                )}
              </IconButton>
            </Tooltip>
            {bookShelfs && (
              <Tooltip title="Move to shelf">
                <IconButton
                  size="small"
                  onClick={handleMenuOpen}
                  sx={{
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                    },
                  }}
                >
                  <MoreHorizIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>

          {/* Decorative right edge */}
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

        {/* Bookshelf Menu */}
        {bookShelfs && (
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            PaperProps={{
              sx: {
                bgcolor: isDark ? 'rgba(45, 50, 58, 0.95)' : 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(10px)',
                borderRadius: '10px',
                border: isDark
                  ? '1px solid rgba(255,255,255,0.1)'
                  : '1px solid rgba(0,0,0,0.08)',
                boxShadow: isDark
                  ? '0 8px 32px rgba(0,0,0,0.4)'
                  : '0 8px 32px rgba(0,0,0,0.12)',
                minWidth: 160,
              },
            }}
          >
            <Typography
              sx={{
                px: 2,
                py: 1,
                fontSize: '0.7rem',
                fontWeight: 600,
                color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Move to Shelf
            </Typography>
            {bookShelfs.map((bookShelf) => (
              <MenuItem
                key={bookShelf.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleMenuClose();
                  handleBookShelfChange(selectedBook, bookShelf);
                }}
                sx={{
                  py: 1,
                  '&:hover': {
                    bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  },
                }}
              >
                <ListItemIcon>
                  <MoveUpIcon sx={{ fontSize: 18, color: mapToPredefinedColor(bookShelf.name) }} />
                </ListItemIcon>
                <ListItemText
                  primary={bookShelf.name}
                  primaryTypographyProps={{
                    fontSize: '0.85rem',
                  }}
                />
              </MenuItem>
            ))}

            <Divider sx={{ my: 1 }} />

            <Typography
              sx={{
                px: 2,
                py: 1,
                fontSize: '0.7rem',
                fontWeight: 600,
                color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Cover Image
            </Typography>

            <MenuItem
              onClick={handleChangeCover}
              sx={{
                py: 1,
                '&:hover': {
                  bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                },
              }}
            >
              <ListItemIcon>
                <ImageIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
              </ListItemIcon>
              <ListItemText
                primary="Change Cover"
                primaryTypographyProps={{
                  fontSize: '0.85rem',
                }}
              />
            </MenuItem>

            {hasValidImage && (
              <MenuItem
                onClick={handleRemoveCover}
                sx={{
                  py: 1,
                  '&:hover': {
                    bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  },
                }}
              >
                <ListItemIcon>
                  <DeleteOutlineIcon sx={{ fontSize: 18, color: theme.palette.error.main }} />
                </ListItemIcon>
                <ListItemText
                  primary="Remove Cover"
                  primaryTypographyProps={{
                    fontSize: '0.85rem',
                  }}
                />
              </MenuItem>
            )}
          </Menu>
        )}

        {/* Hidden file input for cover image selection */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          style={{ display: 'none' }}
          onClick={(e) => e.stopPropagation()}
        />
      </NavLink>
    );
  }

  // Card View - Grid card style with creative generated covers
  return (
    <NavLink
      key={selectedBook.id}
      to={
        selectedBook.format === 'zip' || selectedBook.format === 'r9'
          ? `/browser/${selectedBook.id}`
          : `/reading/${selectedBook.id}`
      }
      style={{ textDecoration: 'none' }}
    >
      <Box
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        sx={{
          width: CARD_WIDTH,
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
          '&:hover': {
            transform: 'translateY(-8px)',
            '& .book-cover': {
              boxShadow: isDark
                ? '0 20px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)'
                : '0 20px 40px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
            },
            '& .book-actions': {
              opacity: 1,
            },
          },
        }}
      >
        {/* Book Cover Container */}
        <Box
          className="book-cover"
          sx={{
            position: 'relative',
            width: '100%',
            height: COVER_HEIGHT,
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: isDark
              ? '0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)'
              : '0 8px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.03)',
            transition: 'box-shadow 0.3s ease',
            // 3D book effect - right edge
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: '12px',
              background: isDark
                ? 'linear-gradient(90deg, rgba(0,0,0,0.15), rgba(0,0,0,0.3))'
                : 'linear-gradient(90deg, rgba(0,0,0,0.05), rgba(0,0,0,0.15))',
              zIndex: 2,
            },
            // Top highlight
            '&::after': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 12,
              height: '1px',
              background: 'rgba(255,255,255,0.3)',
              zIndex: 2,
            },
          }}
        >
          {/* Cover Image or Generated Cover */}
          {hasValidImage ? (
            <Box
              component="img"
              src={imageSrc}
              alt={selectedBook.name}
              onError={handleImageError}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <GeneratedBookCover
              title={selectedBook.name}
              author={selectedBook.author}
              format={selectedBook.format}
              palette={coverPalette}
            />
          )}

          {/* Favorite Badge */}
          {isFavorite && (
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                width: 28,
                height: 28,
                borderRadius: '50%',
                bgcolor: 'rgba(255,255,255,0.95)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                zIndex: 3,
              }}
            >
              <FavoriteIcon sx={{ fontSize: 16, color: '#e91e63' }} />
            </Box>
          )}

          {/* Format Badge - only show when there's a real image */}
          {hasValidImage && (
            <Chip
              icon={getFormatIcon(selectedBook.format)}
              label={selectedBook.format?.toUpperCase() || 'BOOK'}
              size="small"
              sx={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                height: 22,
                fontSize: '0.65rem',
                fontWeight: 600,
                bgcolor: 'rgba(0,0,0,0.6)',
                color: '#fff',
                backdropFilter: 'blur(4px)',
                '& .MuiChip-icon': {
                  color: '#fff',
                  ml: 0.5,
                },
                '& .MuiChip-label': {
                  px: 0.75,
                },
                zIndex: 3,
              }}
            />
          )}

          {/* Hover Actions */}
          <Box
            className="book-actions"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              display: 'flex',
              gap: 0.5,
              opacity: 0,
              transition: 'opacity 0.2s ease',
              zIndex: 3,
            }}
          >
            <IconButton
              size="small"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleFavorite(e);
              }}
              sx={{
                bgcolor: 'rgba(255,255,255,0.95)',
                width: 28,
                height: 28,
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                '&:hover': {
                  bgcolor: '#fff',
                },
              }}
            >
              {isFavorite ? (
                <FavoriteIcon sx={{ fontSize: 16, color: '#e91e63' }} />
              ) : (
                <FavoriteBorderIcon sx={{ fontSize: 16, color: '#666' }} />
              )}
            </IconButton>
            {(bookShelfs || closeCallback) && (
              <IconButton
                size="small"
                onClick={closeCallback ? handleMenuClose2 : handleMenuOpen}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.95)',
                  width: 28,
                  height: 28,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  '&:hover': {
                    bgcolor: '#fff',
                  },
                }}
              >
                <MoreHorizIcon sx={{ fontSize: 16, color: '#666' }} />
              </IconButton>
            )}
          </Box>
        </Box>

        {/* Book Info */}
        <Box sx={{ mt: 1.5, px: 0.5 }}>
          {/* Title */}
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: '0.875rem',
              lineHeight: 1.3,
              color: isDark ? '#fff' : '#1a1a1a',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              mb: 0.5,
            }}
          >
            {selectedBook.name}
          </Typography>

          {/* Author */}
          {selectedBook.author && (
            <Typography
              sx={{
                fontSize: '0.75rem',
                color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                mb: 0.5,
              }}
            >
              {selectedBook.author}
            </Typography>
          )}

          {/* Date */}
          {selectedBook.createdAt && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <AccessTimeIcon
                sx={{
                  fontSize: 12,
                  color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'
                }}
              />
              <Typography
                sx={{
                  fontSize: '0.7rem',
                  color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)',
                }}
              >
                {formatDate(selectedBook.createdAt)}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Bookshelf Menu */}
        {bookShelfs && (
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            PaperProps={{
              sx: {
                bgcolor: isDark ? 'rgba(45, 50, 58, 0.95)' : 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(10px)',
                borderRadius: '10px',
                border: isDark
                  ? '1px solid rgba(255,255,255,0.1)'
                  : '1px solid rgba(0,0,0,0.08)',
                boxShadow: isDark
                  ? '0 8px 32px rgba(0,0,0,0.4)'
                  : '0 8px 32px rgba(0,0,0,0.12)',
                minWidth: 160,
              },
            }}
          >
            <Typography
              sx={{
                px: 2,
                py: 1,
                fontSize: '0.7rem',
                fontWeight: 600,
                color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Move to Shelf
            </Typography>
            {bookShelfs.map((bookShelf) => (
              <MenuItem
                key={bookShelf.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleMenuClose();
                  handleBookShelfChange(selectedBook, bookShelf);
                }}
                sx={{
                  py: 1,
                  '&:hover': {
                    bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  },
                }}
              >
                <ListItemIcon>
                  <MoveUpIcon sx={{ fontSize: 18, color: mapToPredefinedColor(bookShelf.name) }} />
                </ListItemIcon>
                <ListItemText
                  primary={bookShelf.name}
                  primaryTypographyProps={{
                    fontSize: '0.85rem',
                  }}
                />
              </MenuItem>
            ))}

            <Divider sx={{ my: 1 }} />

            <Typography
              sx={{
                px: 2,
                py: 1,
                fontSize: '0.7rem',
                fontWeight: 600,
                color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Cover Image
            </Typography>

            <MenuItem
              onClick={handleChangeCover}
              sx={{
                py: 1,
                '&:hover': {
                  bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                },
              }}
            >
              <ListItemIcon>
                <ImageIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
              </ListItemIcon>
              <ListItemText
                primary="Change Cover"
                primaryTypographyProps={{
                  fontSize: '0.85rem',
                }}
              />
            </MenuItem>

            {hasValidImage && (
              <MenuItem
                onClick={handleRemoveCover}
                sx={{
                  py: 1,
                  '&:hover': {
                    bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  },
                }}
              >
                <ListItemIcon>
                  <DeleteOutlineIcon sx={{ fontSize: 18, color: theme.palette.error.main }} />
                </ListItemIcon>
                <ListItemText
                  primary="Remove Cover"
                  primaryTypographyProps={{
                    fontSize: '0.85rem',
                  }}
                />
              </MenuItem>
            )}
          </Menu>
        )}

        {/* Hidden file input for cover image selection (card view) */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          style={{ display: 'none' }}
          onClick={(e) => e.stopPropagation()}
        />
      </Box>
    </NavLink>
  );
}

export default BookCardUI;
