/* eslint-disable prettier/prettier */
import React, { useState, useEffect } from 'react';
import { useTheme, alpha } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';

// Icons
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import parseMarkdownToHtml from '../../components/note/NoteUtil';

// Color palette for search result cards
const RESULT_COLORS = {
  bg: '#E3F2FD',
  accent: '#2196F3',
  icon: '#1565C0',
};

const RESULT_COLORS_DARK = {
  bg: '#0D2137',
  accent: '#2196F3',
  icon: '#64B5F6',
};

function truncateText(str, n) {
  if (!str) return '';
  return str.length > n ? `${str.slice(0, n - 1)}...` : str;
}

function SearchBookmarkCard({ content, bookKey, cfi, selectHandler }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const colors = isDark ? RESULT_COLORS_DARK : RESULT_COLORS;

  const [htmlCode, setHtmlCode] = useState('');
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!content) return;
    parseMarkdownToHtml(truncateText(content, 200), (html) => {
      setHtmlCode(html);
    });
  }, [content]);

  const handleClick = () => {
    selectHandler(bookKey, cfi);
  };

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        minHeight: 80,
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
      {/* Left ribbon section */}
      <Box
        sx={{
          width: 64,
          minWidth: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '12px 0 0 12px',
          bgcolor: colors.bg,
        }}
      >
        <MenuBookIcon
          sx={{
            fontSize: 28,
            color: colors.icon,
          }}
        />
        {/* Accent stripe */}
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
          py: 1.5,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {/* Label */}
        <Typography
          variant="caption"
          sx={{
            color: colors.icon,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontSize: '0.65rem',
            mb: 0.5,
          }}
        >
          Found in Book
        </Typography>

        {/* Content preview */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            fontSize: '0.85rem',
            lineHeight: 1.4,
          }}
          dangerouslySetInnerHTML={{ __html: htmlCode }}
        />
      </Box>

      {/* Right action indicator */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          pr: 2,
          opacity: isHovered ? 1 : 0,
          transition: 'opacity 0.15s ease',
        }}
      >
        <ArrowForwardIcon
          sx={{
            fontSize: 20,
            color: colors.accent,
          }}
        />
      </Box>

      {/* Right edge accent */}
      <Box
        sx={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 4,
          bgcolor: colors.accent,
          opacity: 0.4,
        }}
      />
    </Box>
  );
}

export default SearchBookmarkCard;
