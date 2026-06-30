/* eslint-disable react/prop-types */
import React, { useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import { BUCKET_LABELS, BUCKET_COLORS } from './buckets';

const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

function WeaknessChip({ weakness, onSave }) {
  const theme = useTheme();
  const mode = theme.palette.mode === 'dark' ? 'dark' : 'light';
  const color =
    BUCKET_COLORS[weakness.bucket]?.[mode] || theme.palette.warning.main;
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave(weakness);
    setSaved(true);
  };

  return (
    <Box
      sx={{
        borderRadius: '12px',
        border: `1px solid ${alpha(color, 0.4)}`,
        borderLeft: `4px solid ${color}`,
        bgcolor: alpha(color, 0.04),
        p: 1.5,
        mb: 1,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 0.5,
        }}
      >
        <Typography
          sx={{
            fontFamily: MONO,
            fontSize: '0.7rem',
            fontWeight: 700,
            color,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {(BUCKET_LABELS[weakness.bucket] || weakness.bucket).toUpperCase()}
        </Typography>
        <Button
          size="small"
          variant={saved ? 'contained' : 'outlined'}
          color="primary"
          startIcon={saved ? <CheckIcon /> : null}
          onClick={handleSave}
          disabled={saved}
          sx={{ fontSize: '0.7rem', textTransform: 'none' }}
        >
          {saved ? 'Saved' : 'Save as LP'}
        </Button>
      </Box>
      <Typography sx={{ fontSize: '0.85rem', mb: 0.5 }}>
        <em>&ldquo;{weakness.learner_text}&rdquo;</em>
        {' → '}
        <strong>
          <em>&ldquo;{weakness.model_text}&rdquo;</em>
        </strong>
      </Typography>
      <Typography
        sx={{ fontSize: '0.8rem', color: theme.palette.text.secondary }}
      >
        {weakness.reason}
      </Typography>
    </Box>
  );
}

export default WeaknessChip;
