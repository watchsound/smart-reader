import React, { useCallback, useEffect, useState } from 'react';
import {
  Paper,
  Stack,
  Typography,
  Box,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import brainApi from '../../api/brainApi';

/**
 * TriggerTelemetryPanel — visualizes per-source accept/dismiss tallies
 * persisted by LearningBrainAgent.recordProposalEvent. Reads
 * brainShell.triggerTelemetry via brainApi.getTriggerTelemetry on mount
 * and on Refresh.
 *
 * Surfaced inside `BrainDashboardPanel` as a collapsible subsection (no
 * separate route).
 */
function pct(num, denom) {
  if (!denom) return '—';
  return `${Math.round((num / denom) * 100)}%`;
}

function relativeTime(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function TriggerTelemetryPanel() {
  const [data, setData] = useState({ bySource: {} });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const t = await brainApi.getTriggerTelemetry();
      setData(t && t.bySource ? t : { bySource: {} });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[TriggerTelemetryPanel] fetch failed', e);
      setData({ bySource: {} });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const rows = Object.entries(data.bySource).map(([source, entry]) => ({
    source,
    ...entry,
    total: (entry.accepted || 0) + (entry.dismissed || 0),
  }));
  rows.sort((a, b) => b.total - a.total);

  return (
    <Paper
      sx={{
        p: 2,
        borderRadius: 2,
        border: '1px dashed #cbd5e0',
        bgcolor: '#fafafa',
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ mb: 1 }}
      >
        <Typography variant="overline" sx={{ flex: 1, opacity: 0.7 }}>
          Trigger Telemetry
        </Typography>
        <Tooltip title="Refresh">
          <IconButton
            size="small"
            aria-label="Refresh"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      {loading && rows.length === 0 && (
        <Typography variant="caption" sx={{ color: '#a0aec0' }}>
          Loading…
        </Typography>
      )}
      {!loading && rows.length === 0 ? (
        <Typography variant="caption" sx={{ color: '#a0aec0' }}>
          No telemetry yet — accept or dismiss a proposal to record data.
        </Typography>
      ) : rows.length === 0 ? null : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Source</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  Accept
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  Dismiss
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  Accept&nbsp;%
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Last</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.source}>
                  <TableCell>
                    <Typography variant="body2">{r.source}</Typography>
                  </TableCell>
                  <TableCell align="right">{r.accepted || 0}</TableCell>
                  <TableCell align="right">{r.dismissed || 0}</TableCell>
                  <TableCell align="right">
                    {pct(r.accepted || 0, r.total)}
                  </TableCell>
                  <TableCell>
                    <Stack
                      direction="row"
                      spacing={0.5}
                      alignItems="center"
                    >
                      <Chip
                        size="small"
                        label={r.lastEventKind || '?'}
                        sx={{ height: 18, fontSize: 10 }}
                      />
                      <Typography variant="caption" sx={{ opacity: 0.7 }}>
                        {relativeTime(r.lastEvent)}
                      </Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Paper>
  );
}
