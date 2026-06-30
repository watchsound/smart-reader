import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import HistoryIcon from '@mui/icons-material/History';

function TranslateHistoryList({ entries, onSelect }) {
  const theme = useTheme();
  return (
    <Box sx={{ px: 1.5, py: 1 }}>
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
        <HistoryIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
        Recent
      </Typography>
      {!entries || entries.length === 0 ? (
        <Typography
          variant="body2"
          color="text.disabled"
          sx={{ px: 0.5, fontSize: '0.8rem' }}
        >
          No recent translations
        </Typography>
      ) : (
        entries.map((item) => (
          <Box
            key={item.id}
            onClick={() => onSelect(item)}
            sx={{
              p: 1,
              mb: 0.5,
              borderRadius: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
            }}
          >
            <Chip
              label={item.level}
              size="small"
              sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }}
            />
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.8rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
            >
              {item.sourceText}
            </Typography>
          </Box>
        ))
      )}
    </Box>
  );
}

export default TranslateHistoryList;
