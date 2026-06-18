import React from 'react';
import { Stack, Typography, LinearProgress, Box } from '@mui/material';

const fmtUSD = (v) => `$${(v ?? 0).toFixed(v < 0.01 ? 4 : 2)}`;

/**
 * AttributionBarChart — top-level cost-per-group bars with optional expand-in-place
 * sub-bars for per-intent breakdown.
 *
 * Props:
 *   bars              — top-level bar rows from attributionBars IPC
 *   expandedKey       — groupKey of currently expanded bar, or null
 *   onBarClick        — (groupKey) => void — fires on top-level bar click
 *   subBarsForExpanded — intent-level bar rows to render under the expanded group
 *   onSubBarClick     — (intent) => void — fires when a sub-bar is clicked
 */
export default function AttributionBarChart({
  bars,
  expandedKey,
  onBarClick,
  subBarsForExpanded,
  onSubBarClick,
}) {
  const maxCost = Math.max(0.0001, ...bars.map((b) => b.totalCostUsd));
  const subMaxCost = subBarsForExpanded && subBarsForExpanded.length > 0
    ? Math.max(0.0001, ...subBarsForExpanded.map((b) => b.totalCostUsd))
    : 0.0001;

  if (bars.length === 0) {
    return <Typography variant="body2" sx={{ color: 'text.secondary' }}>No mastery events in selected window.</Typography>;
  }

  return (
    <Stack spacing={1.5}>
      {bars.map((b) => (
        <Box key={b.groupKey}>
          {/* Top-level bar */}
          <Box
            onClick={() => onBarClick && onBarClick(b.groupKey)}
            sx={{
              cursor: onBarClick ? 'pointer' : 'default',
              '&:hover': onBarClick ? { bgcolor: 'action.hover' } : undefined,
              p: 1,
              borderRadius: 1,
              outline: b.groupKey === expandedKey ? '2px solid' : 'none',
              outlineColor: 'primary.light',
            }}
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

          {/* Expand-in-place sub-bars for this group */}
          {b.groupKey === expandedKey && subBarsForExpanded && subBarsForExpanded.length > 0 && (
            <Stack spacing={0.5} sx={{ pl: 3, mt: 0.5 }}>
              {subBarsForExpanded.map((sub) => (
                <Box
                  key={sub.groupKey}
                  onClick={() => onSubBarClick && onSubBarClick(sub.groupKey)}
                  sx={{
                    cursor: onSubBarClick ? 'pointer' : 'default',
                    '&:hover': onSubBarClick ? { bgcolor: 'action.hover' } : undefined,
                    p: 0.75,
                    borderRadius: 1,
                    borderLeft: '2px solid',
                    borderColor: 'primary.light',
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                    <Typography variant="caption" sx={{ fontWeight: 500 }}>{sub.groupLabel}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {fmtUSD(sub.costPerEvent)} / move
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={(sub.totalCostUsd / subMaxCost) * 100}
                    sx={{ mt: 0.25, height: 4, borderRadius: 2 }}
                    color="secondary"
                  />
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                    {sub.eventCount} events · {fmtUSD(sub.totalCostUsd)} total
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      ))}
    </Stack>
  );
}
