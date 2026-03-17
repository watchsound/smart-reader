import React from 'react';
import { NavLink } from 'react-router-dom';
import { Avatar, Box, Tooltip, Typography } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import { useGetBookByIdQuery } from '../../store/api/bookApiSlice';
import { mapToPredefinedColor } from '../../../commons/utils/CommonLangUtil';

// Helper function to darken a hex color
function darkenColor(colorInput, amount = 0.25) {
  const color = mapToPredefinedColor(colorInput);
  const hex = color.replace('#', '');
  const r = Math.max(0, parseInt(hex.substring(0, 2), 16) * (1 - amount));
  const g = Math.max(0, parseInt(hex.substring(2, 4), 16) * (1 - amount));
  const b = Math.max(0, parseInt(hex.substring(4, 6), 16) * (1 - amount));
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function BookSpineUI({ id, title, author, description, starred }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { data: result } = useGetBookByIdQuery(id);

  // Safety: ensure title has fallback
  const safeTitle = title || 'Untitled';
  const safeAuthor = author || '';
  const safeDescription = description || '';

  // Get book format for navigation
  const bookFormat = result?.book?.format;
  const navigateTo = bookFormat === 'zip' || bookFormat === 'r9'
    ? `/browser/${id}`
    : `/reading/${id}`;

  // Truncate description for tooltip (max 150 chars)
  const truncatedDescription = safeDescription.length > 150
    ? `${safeDescription.substring(0, 150)}...`
    : safeDescription;

  const baseColor = mapToPredefinedColor(safeTitle || safeAuthor);
  const darkColor = darkenColor(safeTitle || safeAuthor);

  // Build tooltip content
  const tooltipContent = (
    <Box sx={{ p: 0.5, maxWidth: 250 }}>
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
        {safeTitle}
      </Typography>
      {safeAuthor && (
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.85, mb: 0.5 }}>
          {safeAuthor}
        </Typography>
      )}
      {truncatedDescription && (
        <Typography variant="caption" sx={{ display: 'block', opacity: 0.7, lineHeight: 1.4 }}>
          {truncatedDescription}
        </Typography>
      )}
    </Box>
  );

  return (
    <Tooltip
      title={tooltipContent}
      placement="top"
      arrow
      enterDelay={500}
      leaveDelay={100}
      PopperProps={{
        sx: {
          '& .MuiTooltip-tooltip': {
            bgcolor: isDark ? 'rgba(45, 50, 58, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            color: isDark ? '#fff' : '#333',
            backdropFilter: 'blur(8px)',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)',
            boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 20px rgba(0,0,0,0.15)',
            borderRadius: '8px',
            fontSize: '0.8rem',
          },
          '& .MuiTooltip-arrow': {
            color: isDark ? 'rgba(45, 50, 58, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          },
        },
      }}
    >
      <NavLink to={navigateTo} style={{ textDecoration: 'none' }}>
        <Box
          sx={{
            minWidth: '44px',
            maxWidth: '56px',
            height: '200px',
            background: `linear-gradient(165deg, ${baseColor} 0%, ${darkColor} 100%)`,
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            alignItems: 'center',
            padding: '10px 6px',
            margin: '8px 4px',
            borderRadius: '4px',
            boxShadow: isDark
              ? '0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)'
              : '0 4px 12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.25)',
            textAlign: 'center',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease-out',
            '&:hover': {
              transform: 'translateY(-10px) scale(1.03)',
              boxShadow: isDark
                ? '0 16px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)'
                : '0 16px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3)',
              zIndex: 10,
            },
          }}
        >
          {/* Book spine top decoration */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'rgba(255,255,255,0.3)',
              borderRadius: '4px 4px 0 0',
            }}
          />

          {/* Light reflection effect */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '100%',
              background: 'linear-gradient(90deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.05) 30%, transparent 50%)',
              borderRadius: 'inherit',
              pointerEvents: 'none',
            }}
          />

          <Avatar
            sx={{
              width: 28,
              height: 28,
              bgcolor: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.3)',
              fontSize: '0.85rem',
              fontWeight: 600,
              mb: 1,
              mt: 0.5,
            }}
          >
            {safeTitle.charAt(0).toUpperCase()}
          </Avatar>

          <Typography
            variant="body2"
            component="div"
            sx={{
              position: 'absolute',
              writingMode: 'vertical-lr',
              left: '6px',
              top: '44px',
              bottom: '8px',
              fontSize: '0.75rem',
              fontWeight: 500,
              letterSpacing: '0.02em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxHeight: 'calc(100% - 52px)',
              textShadow: '0 1px 2px rgba(0,0,0,0.2)',
            }}
          >
            {safeTitle}
          </Typography>

          <Typography
            variant="caption"
            component="div"
            sx={{
              position: 'absolute',
              writingMode: 'vertical-lr',
              right: '6px',
              top: '44px',
              bottom: '8px',
              fontSize: '0.65rem',
              fontWeight: 400,
              opacity: 0.85,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxHeight: 'calc(100% - 52px)',
            }}
          >
            {safeAuthor}
          </Typography>

          {starred && (
            <BookmarkIcon
              sx={{
                position: 'absolute',
                top: '-2px',
                right: '2px',
                color: '#ffd700',
                fontSize: '1.1rem',
                filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
              }}
            />
          )}

          {/* Book spine bottom decoration */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '0 0 4px 4px',
            }}
          />
        </Box>
      </NavLink>
    </Tooltip>
  );
}

export default BookSpineUI;
