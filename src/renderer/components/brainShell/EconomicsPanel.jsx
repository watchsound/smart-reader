// src/renderer/components/brainShell/EconomicsPanel.jsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  Paper, Stack, Typography, Box, Tabs, Tab, Table, TableHead, TableBody,
  TableRow, TableCell, LinearProgress, IconButton, Chip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import callLedgerApi from '../../api/callLedgerApi';

const WINDOWS = {
  '7d':  7  * 24 * 3600 * 1000,
  '30d': 30 * 24 * 3600 * 1000,
};

export default function EconomicsPanel() {
  const [windowKey, setWindowKey] = useState('7d');
  const [byIntent, setByIntent] = useState([]);
  const [byProvider, setByProvider] = useState([]);
  const [cacheRates, setCacheRates] = useState({});
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const sinceMs = Date.now() - WINDOWS[windowKey];
    try {
      const [intents, providers, rates] = await Promise.all([
        callLedgerApi.aggregateByIntent(sinceMs),
        callLedgerApi.aggregateByProvider(sinceMs),
        callLedgerApi.cacheHitRateByIntent(sinceMs),
      ]);
      setByIntent(intents || []);
      setByProvider(providers || []);
      setCacheRates(rates || {});
    } finally {
      setLoading(false);
    }
  }, [windowKey]);

  useEffect(() => { refresh(); }, [refresh]);

  const totalCost = byIntent.reduce((s, r) => s + (r.total_cost_usd || 0), 0);
  const projectedMonthly = windowKey === '7d' ? totalCost * (30 / 7) : totalCost;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle1">LLM Economics</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tabs value={windowKey} onChange={(_e, v) => setWindowKey(v)}>
            <Tab label="7 days"  value="7d" />
            <Tab label="30 days" value="30d" />
          </Tabs>
          <IconButton size="small" onClick={refresh} disabled={loading} aria-label="refresh">
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>
      {loading && <LinearProgress />}
      <Stack direction="row" spacing={2} sx={{ my: 1 }}>
        <Chip label={`Total: $${totalCost.toFixed(4)}`} />
        <Chip label={`Projected/mo: $${projectedMonthly.toFixed(2)}`} color="primary" />
      </Stack>

      <Typography variant="caption" sx={{ display: 'block', mt: 1, mb: 0.5 }}>By Intent</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Intent</TableCell>
            <TableCell align="right">Calls</TableCell>
            <TableCell align="right">Cost USD</TableCell>
            <TableCell align="right">Cache hit</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {byIntent.map((r) => (
            <TableRow key={r.key}>
              <TableCell>{r.key}</TableCell>
              <TableCell align="right">{r.call_count}</TableCell>
              <TableCell align="right">${(r.total_cost_usd || 0).toFixed(5)}</TableCell>
              <TableCell align="right">
                {cacheRates[r.key] != null
                  ? `${Math.round(cacheRates[r.key] * 100)}%`
                  : '—'}
              </TableCell>
            </TableRow>
          ))}
          {byIntent.length === 0 && !loading && (
            <TableRow>
              <TableCell colSpan={4} align="center">
                <Typography variant="caption" color="text.secondary">No spend recorded yet</Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Typography variant="caption" sx={{ display: 'block', mt: 2, mb: 0.5 }}>By Provider</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Provider</TableCell>
            <TableCell align="right">Calls</TableCell>
            <TableCell align="right">Cost USD</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {byProvider.map((r) => (
            <TableRow key={r.key}>
              <TableCell>{r.key}</TableCell>
              <TableCell align="right">{r.call_count}</TableCell>
              <TableCell align="right">${(r.total_cost_usd || 0).toFixed(5)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
