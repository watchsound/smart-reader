/* eslint-disable react/prop-types */
import React from 'react';
import { useTheme, alpha, styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';

// Icons
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';

// Color palette for book headers (matching BookmarkUI pattern)
const HEADER_COLORS = [
  {
    bg: '#E8F5E9',
    accent: '#4CAF50',
    icon: '#2E7D32',
    gradient: 'linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)',
  },
  {
    bg: '#E3F2FD',
    accent: '#2196F3',
    icon: '#1565C0',
    gradient: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)',
  },
  {
    bg: '#FFF3E0',
    accent: '#FF9800',
    icon: '#E65100',
    gradient: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)',
  },
  {
    bg: '#F3E5F5',
    accent: '#9C27B0',
    icon: '#6A1B9A',
    gradient: 'linear-gradient(135deg, #F3E5F5 0%, #E1BEE7 100%)',
  },
  {
    bg: '#FFEBEE',
    accent: '#F44336',
    icon: '#C62828',
    gradient: 'linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%)',
  },
  {
    bg: '#E0F7FA',
    accent: '#00BCD4',
    icon: '#00838F',
    gradient: 'linear-gradient(135deg, #E0F7FA 0%, #B2EBF2 100%)',
  },
  {
    bg: '#FFF8E1',
    accent: '#FFC107',
    icon: '#FF8F00',
    gradient: 'linear-gradient(135deg, #FFF8E1 0%, #FFECB3 100%)',
  },
  {
    bg: '#FCE4EC',
    accent: '#E91E63',
    icon: '#AD1457',
    gradient: 'linear-gradient(135deg, #FCE4EC 0%, #F8BBD9 100%)',
  },
  {
    bg: '#E8EAF6',
    accent: '#3F51B5',
    icon: '#283593',
    gradient: 'linear-gradient(135deg, #E8EAF6 0%, #C5CAE9 100%)',
  },
  {
    bg: '#F1F8E9',
    accent: '#8BC34A',
    icon: '#558B2F',
    gradient: 'linear-gradient(135deg, #F1F8E9 0%, #DCEDC8 100%)',
  },
];

const HEADER_COLORS_DARK = [
  {
    bg: '#1B3A1B',
    accent: '#4CAF50',
    icon: '#81C784',
    gradient: 'linear-gradient(135deg, #1B3A1B 0%, #2E4A2E 100%)',
  },
  {
    bg: '#0D2137',
    accent: '#2196F3',
    icon: '#64B5F6',
    gradient: 'linear-gradient(135deg, #0D2137 0%, #1A3A5C 100%)',
  },
  {
    bg: '#2D1B00',
    accent: '#FF9800',
    icon: '#FFB74D',
    gradient: 'linear-gradient(135deg, #2D1B00 0%, #4A3000 100%)',
  },
  {
    bg: '#2A1B2E',
    accent: '#9C27B0',
    icon: '#BA68C8',
    gradient: 'linear-gradient(135deg, #2A1B2E 0%, #3D2A42 100%)',
  },
  {
    bg: '#2D1515',
    accent: '#F44336',
    icon: '#E57373',
    gradient: 'linear-gradient(135deg, #2D1515 0%, #4A2222 100%)',
  },
  {
    bg: '#0A2A2D',
    accent: '#00BCD4',
    icon: '#4DD0E1',
    gradient: 'linear-gradient(135deg, #0A2A2D 0%, #1A3D42 100%)',
  },
  {
    bg: '#2D2600',
    accent: '#FFC107',
    icon: '#FFD54F',
    gradient: 'linear-gradient(135deg, #2D2600 0%, #4A3F00 100%)',
  },
  {
    bg: '#2D1520',
    accent: '#E91E63',
    icon: '#F06292',
    gradient: 'linear-gradient(135deg, #2D1520 0%, #4A2535 100%)',
  },
  {
    bg: '#1A1D2E',
    accent: '#3F51B5',
    icon: '#7986CB',
    gradient: 'linear-gradient(135deg, #1A1D2E 0%, #2A304A 100%)',
  },
  {
    bg: '#1D2A15',
    accent: '#8BC34A',
    icon: '#AED581',
    gradient: 'linear-gradient(135deg, #1D2A15 0%, #2E3D22 100%)',
  },
];

// Generate consistent color index from string
function getColorIndex(str) {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    // eslint-disable-next-line no-bitwise
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % HEADER_COLORS.length;
}

// Styled progress bar
const ReadingProgress = styled(LinearProgress)(({ theme, accentcolor }) => ({
  height: 4,
  borderRadius: 2,
  backgroundColor: alpha(theme.palette.text.primary, 0.08),
  '& .MuiLinearProgress-bar': {
    backgroundColor: accentcolor || theme.palette.primary.main,
    borderRadius: 2,
  },
}));

function ReadingHeader({
  book,
  page,
  onBack,
  onBookmark,
  isBookmarked,
  onMenuClick,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  if (!book) return null;

  const colorPalette = isDark ? HEADER_COLORS_DARK : HEADER_COLORS;
  const colorIndex = getColorIndex(book.title || book.id?.toString());
  const colors = colorPalette[colorIndex];

  const isEpub = book.format === 'epub';
  const IconComponent = isEpub ? AutoStoriesIcon : PictureAsPdfIcon;

  // Calculate reading progress
  const progress =
    page?.totalPages > 0
      ? Math.round((page.curPage / page.totalPages) * 100)
      : 0;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        height: 56,
        background: colors.gradient,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Left accent stripe */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          bgcolor: colors.accent,
        }}
      />

      {/* Back button */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          pl: 2,
          pr: 1,
        }}
      >
        <Tooltip title="Back to bookshelf">
          <IconButton
            size="small"
            onClick={onBack}
            sx={{
              color: colors.icon,
              '&:hover': {
                bgcolor: alpha(colors.accent, 0.15),
              },
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Book icon section */}
      <Box
        sx={{
          width: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(colors.accent, 0.15),
            border: `1px solid ${alpha(colors.accent, 0.3)}`,
          }}
        >
          <IconComponent
            sx={{
              fontSize: 20,
              color: colors.icon,
            }}
          />
        </Box>
      </Box>

      {/* Book info section */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          px: 1.5,
          minWidth: 0,
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: '0.9rem',
            color: isDark ? theme.palette.text.primary : '#1d1c1d',
          }}
        >
          {book.title || 'Untitled Book'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {page?.curChapter && (
            <Typography
              variant="caption"
              sx={{
                color: alpha(
                  isDark ? theme.palette.text.primary : '#1d1c1d',
                  0.6,
                ),
                fontSize: '0.7rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 200,
              }}
            >
              {page.curChapter}
            </Typography>
          )}
          {page?.totalPages > 0 && (
            <Chip
              label={`${page.curPage} / ${page.totalPages}`}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.65rem',
                fontWeight: 600,
                bgcolor: alpha(colors.accent, 0.15),
                color: colors.icon,
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          )}
        </Box>
      </Box>

      {/* Progress indicator */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            minWidth: 60,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              fontSize: '0.85rem',
              color: colors.icon,
            }}
          >
            {progress}%
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.6rem',
              color: alpha(
                isDark ? theme.palette.text.primary : '#1d1c1d',
                0.5,
              ),
            }}
          >
            complete
          </Typography>
        </Box>
      </Box>

      {/* Action buttons */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          pr: 2,
        }}
      >
        <Tooltip title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}>
          <IconButton
            size="small"
            onClick={onBookmark}
            sx={{
              color: isBookmarked ? theme.palette.warning.main : colors.icon,
              '&:hover': {
                bgcolor: alpha(colors.accent, 0.15),
              },
            }}
          >
            {isBookmarked ? (
              <BookmarkIcon sx={{ fontSize: 20 }} />
            ) : (
              <BookmarkBorderIcon sx={{ fontSize: 20 }} />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title="More options">
          <IconButton
            size="small"
            onClick={onMenuClick}
            sx={{
              color: colors.icon,
              '&:hover': {
                bgcolor: alpha(colors.accent, 0.15),
              },
            }}
          >
            <MoreVertIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Bottom progress bar */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        }}
      >
        <ReadingProgress
          variant="determinate"
          value={progress}
          accentcolor={colors.accent}
        />
      </Box>

      {/* Decorative right edge ribbon */}
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

export default ReadingHeader;
