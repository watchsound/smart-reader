import React, { useEffect, useState } from 'react';
import { Box, Typography, Stack, Paper } from '@mui/material';
import callLedgerApi from '../../api/callLedgerApi';
import aiPricingApi from '../../api/aiPricingApi';

const DAY = 86_400_000;

export default function ProviderSpendStats() {
  const [byProvider, setByProvider] = useState([]);
  const [defaults, setDefaults] = useState({});
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    const since = Date.now() - 30 * DAY;
    Promise.all([
      callLedgerApi.aggregateByProvider(since),
      aiPricingApi.defaults(),
      aiPricingApi.get(),
    ]).then(([rows, d, o]) => {
      setByProvider((rows || []).filter((r) => (r.call_count || 0) > 0));
      setDefaults(d || {});
      setOverrides(o || {});
    });
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
        const key = r.key;
        const overrideRow = overrides[key];
        const defaultRow = defaults[key];
        const effective = overrideRow || defaultRow;
        const hasOverride = !!overrideRow;
        return (
          <Paper key={key} variant="outlined" sx={{ p: 1.25, minWidth: 140 }}>
            <Typography
              variant="caption"
              sx={{ color: 'text.secondary', textTransform: 'uppercase' }}
            >
              {key}
            </Typography>
            <Typography variant="h6">${cost.toFixed(2)}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {calls} calls · avg ${avg.toFixed(4)}
            </Typography>
            {effective && (
              <Typography
                variant="caption"
                sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
              >
                {`@ $${effective.input.toFixed(2)}/$${effective.output.toFixed(2)} per 1M${hasOverride ? ' (override)' : ''}`}
              </Typography>
            )}
          </Paper>
        );
      })}
    </Stack>
  );
}
