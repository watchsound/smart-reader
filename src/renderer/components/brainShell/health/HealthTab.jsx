import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stack, Typography, Box, Chip, Button, IconButton, Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import anomalyApi from '../../../api/anomalyApi';

const SEVERITY_COLOR = { high: '#c0392b', medium: '#d68910', low: '#7f8c8d' };

function timeAgo(ts) {
  if (!ts) return '—';
  const ms = Date.now() - ts;
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} d ago`;
}

function anomalyTitle(a) {
  const e = a.evidence || {};
  switch (a.kind) {
    case 'mastery-regression':
      return `${e.title || a.key}: mastery dropped ${Math.round(e.drop || 0)}`;
    case 'zero-roi-spend':
      return `${e.intent}: $${(e.windowCostUsd || 0).toFixed(4)} spent, 0 mastery moves`;
    case 'provider-error-spike':
      return `${e.provider}: ${Math.round((e.errorRate || 0) * 100)}% error rate (${e.errorCalls}/${e.totalCalls} calls)`;
    case 'stalled-quest-concept':
      return `${e.title || a.key}: stalled ${e.stalledDays != null ? `${e.stalledDays}d` : 'with no activity'} (mastery ${Math.round(e.masteryLevel || 0)})`;
    default:
      return `${a.kind}: ${a.key}`;
  }
}

function actionFor(navigate, a) {
  const e = a.evidence || {};
  switch (a.kind) {
    case 'mastery-regression':
      return { label: 'Inspect', onClick: () => navigate(`/?inspect=${encodeURIComponent(e.learningPointId)}`) };
    case 'zero-roi-spend':
      return { label: 'View ROI', onClick: () => navigate('/?tab=economics') };
    case 'provider-error-spike':
      return { label: 'View latency', onClick: () => navigate('/?tab=economics') };
    case 'stalled-quest-concept':
      return { label: 'Inspect', onClick: () => navigate(`/?inspect=${encodeURIComponent(e.learningPointId)}`) };
    default:
      return null;
  }
}

export default function HealthTab() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const list = await anomalyApi.list();
      setItems(Array.isArray(list) ? list : []);
      setError(null);
    } catch (e) {
      setError(e.message || String(e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRescan = async () => {
    setScanning(true);
    try {
      await anomalyApi.rescan();
      await load();
    } finally {
      setScanning(false);
    }
  };

  const onAck = async (id) => {
    await anomalyApi.acknowledge(id);
    await load();
  };

  const lastSeen = items && items.length > 0
    ? Math.max(...items.map((a) => a.lastSeenTs || 0))
    : null;

  return (
    <Stack spacing={2} sx={{ pt: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2">
          {items == null
            ? 'Loading…'
            : items.length === 0
              ? `All systems normal${lastSeen ? ` — last scanned ${timeAgo(lastSeen)}` : ''}`
              : `${items.length} anomalies`}
        </Typography>
        <Button size="small" startIcon={<RefreshIcon />} onClick={onRescan} disabled={scanning}>
          {scanning ? 'Scanning…' : 'Re-scan'}
        </Button>
      </Stack>
      {error && <Typography color="error" variant="caption">{error}</Typography>}
      {items && items.length === 0 && (
        <Box sx={{ p: 2, background: '#f0fdf4', borderRadius: 1 }}>
          <Typography variant="caption" sx={{ color: '#0a6' }}>
            No anomalies detected over the last 7 days.
          </Typography>
        </Box>
      )}
      {items && items.map((a) => {
        const action = actionFor(navigate, a);
        return (
          <Box
            key={a.id}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, p: 1.5,
              border: `1px solid ${SEVERITY_COLOR[a.severity] || '#ddd'}`,
              borderLeftWidth: 4, borderRadius: 1,
            }}
          >
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <Chip
                  size="small"
                  label={a.severity}
                  sx={{
                    background: SEVERITY_COLOR[a.severity] || '#ddd',
                    color: 'white', fontSize: 11,
                  }}
                />
                <Chip size="small" variant="outlined" label={a.kind} />
              </Stack>
              <Typography variant="body2">{anomalyTitle(a)}</Typography>
              <Typography variant="caption" sx={{ color: '#666' }}>
                first seen {timeAgo(a.sinceTs)} · last scanned {timeAgo(a.lastSeenTs)}
              </Typography>
            </Box>
            {action && (
              <Button size="small" onClick={action.onClick}>{action.label}</Button>
            )}
            <Tooltip title="Acknowledge (mute for 7 days)">
              <IconButton size="small" onClick={() => onAck(a.id)}>
                <VisibilityOffIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      })}
    </Stack>
  );
}
