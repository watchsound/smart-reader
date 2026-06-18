import React from 'react';
import { Stack, Typography, LinearProgress, Box } from '@mui/material';

const fmtUSD = (v) => `$${(v ?? 0).toFixed(v < 0.01 ? 4 : 2)}`;

export default function AttributionBarChart({ bars, onBarClick }) {
  const maxCost = Math.max(0.0001, ...bars.map((b) => b.totalCostUsd));
  if (bars.length === 0) {
    return <Typography variant="body2" sx={{ color: 'text.secondary' }}>No mastery events in selected window.</Typography>;
  }
  return (
    <Stack spacing={1.5}>
      {bars.map((b) => (
        <Box
          key={b.groupKey}
          onClick={() => onBarClick && onBarClick(b.groupKey)}
          sx={{ cursor: onBarClick ? 'pointer' : 'default', '&:hover': onBarClick ? { bgcolor: 'action.hover' } : undefined, p: 1, borderRadius: 1 }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="baseline">
            <Typography variant="body2" sx={{ fontWeight: 500 }}>{b.groupLabel}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {fmtUSD(b.costPerEvent)} / move
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={(b.totalCostUsd / maxCost) * 100}
            sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {b.eventCount} events · {fmtUSD(b.totalCostUsd)} total
            {b.amortizedCount > 0 && ` · ${b.amortizedCount} amortized`}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}
