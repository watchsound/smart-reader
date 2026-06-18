import React, { useEffect, useState } from 'react';
import { Box, Typography, Stack, Paper } from '@mui/material';
import callLedgerApi from '../../api/callLedgerApi';

const DAY = 86_400_000;

export default function ProviderSpendStats() {
  const [byProvider, setByProvider] = useState([]);

  useEffect(() => {
    const since = Date.now() - 30 * DAY;
    callLedgerApi
      .aggregateByProvider(since)
      .then((rows) =>
        setByProvider((rows || []).filter((r) => (r.call_count || 0) > 0))
      );
  }, []);

  if (byProvider.length === 0) {
    return (
      <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          No LLM calls yet this month. Configure a provider and use any AI
          feature to start tracking.
        </Typography>
      </Box>
    );
  }

  return (
    <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: 'wrap' }}>
      {byProvider.map((r) => {
        const cost = r.total_cost_usd || 0;
        const calls = r.call_count || 0;
        const avg = calls > 0 ? cost / calls : 0;
        return (
          <Paper key={r.key} variant="outlined" sx={{ p: 1.25, minWidth: 140 }}>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', textTransform: 'uppercase' }}
            >
              {r.key}
            </Typography>
            <Typography variant="h6">${cost.toFixed(2)}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {calls} calls · avg ${avg.toFixed(4)}
            </Typography>
          </Paper>
        );
      })}
    </Stack>
  );
}
