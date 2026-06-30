import React from 'react';
import { Box } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { DIFF_COLORS } from './config';
import { BUCKET_COLORS } from '../translate/buckets';

export function colorFor(kind, bucket, mode) {
  if (bucket && BUCKET_COLORS[bucket]) return BUCKET_COLORS[bucket][mode];
  if (kind === 'grammar') return DIFF_COLORS.grammar[mode];
  if (kind === 'weaker' || kind === 'stronger') return DIFF_COLORS.weaker[mode];
  return DIFF_COLORS.match[mode];
}

function DiffSpan({ kind, bucket, pairId, hoveredPairId, onHoverPair, children }) {
  const theme = useTheme();
  const mode = theme.palette.mode === 'dark' ? 'dark' : 'light';
  const color = colorFor(kind, bucket, mode);
  const isPaired = pairId && hoveredPairId === pairId;

  let styles;
  if (kind === 'grammar') {
    styles = {
      textDecoration: 'underline',
      textDecorationStyle: 'wavy',
      textDecorationColor: alpha(color, 0.7),
      padding: '0 2px',
    };
  } else if (kind === 'match') {
    styles = {
      borderBottom: `1.5px solid ${alpha(color, 0.6)}`,
    };
  } else {
    styles = {
      backgroundColor: isPaired ? alpha(color, 0.25) : alpha(color, 0.12),
      borderRadius: '3px',
      padding: '0 4px',
      transition: 'background-color 150ms ease-out',
    };
  }

  return (
    <Box
      component="span"
      onMouseEnter={() => pairId && onHoverPair && onHoverPair(pairId)}
      onMouseLeave={() => pairId && onHoverPair && onHoverPair(null)}
      sx={styles}
    >
      {children}
    </Box>
  );
}

export default DiffSpan;
