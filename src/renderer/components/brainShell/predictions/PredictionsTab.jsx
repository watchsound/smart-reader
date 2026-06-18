import React, { useEffect, useState, useCallback } from 'react';
import { Stack, Typography, Box, Button, Chip } from '@mui/material';
import predictiveApi from '../../../api/predictiveApi';
import ReliabilityDiagram from './ReliabilityDiagram';

const STALE_MS = 24 * 3600 * 1000;

export default function PredictionsTab() {
  const [report, setReport] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await predictiveApi.report({ windowDays: 30 });
      setReport(r);
      setError(null);
    } catch (e) {
      setError(e.message || String(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await predictiveApi.refresh({ force: true });
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const stale = report && Date.now() - report.asOf > STALE_MS;

  return (
    <Stack spacing={2} sx={{ pt: 2 }}>
      {error && <Typography color="error" variant="caption">{error}</Typography>}
      {stale && (
        <Box sx={{ p: 1, background: '#ffd', borderRadius: 1 }}>
          <Typography variant="caption">Model is more than 24 hours stale.</Typography>
        </Box>
      )}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2">Model calibration (30d)</Typography>
        <Button size="small" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? 'Recomputing…' : 'Recompute'}
        </Button>
      </Stack>
      {report && (
        <Stack direction="row" spacing={2}>
          <Chip label={`Brier ${report.brierScore.toFixed(3)}`} />
          <Chip label={`Coverage ${Math.round(report.coverage * 100)}%`} />
        </Stack>
      )}
      {report && <ReliabilityDiagram reliability={report.reliability} />}
    </Stack>
  );
}
