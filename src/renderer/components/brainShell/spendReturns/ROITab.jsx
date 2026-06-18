import React, { useEffect, useState, useCallback } from 'react';
import {
  Stack, Typography, Dialog, DialogTitle, DialogContent, IconButton,
  Chip, Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import callLedgerApi from '../../../api/callLedgerApi';
import LensToggle from './LensToggle';
import AttributionBarChart from './AttributionBarChart';
import BrushableDensityStrip from './BrushableDensityStrip';
import GroupDetailDrawer from './GroupDetailDrawer';

const DAY = 86_400_000;

function loadInitialLens() {
  if (typeof localStorage === 'undefined') return 'attention';
  return localStorage.getItem('phase13.lens') || 'attention';
}
function loadInitialWindow() {
  if (typeof localStorage === 'undefined') return { from: Date.now() - 30 * DAY, to: Date.now() };
  const saved = localStorage.getItem('phase13.window');
  if (saved) try { return JSON.parse(saved); } catch (_e) { /* fall through */ }
  return { from: Date.now() - 30 * DAY, to: Date.now() };
}

/**
 * CallDetailDialog — lightweight modal for a direct-attributed call row.
 * RationaleCard expects a triggerId (string), not a numeric callId, so we
 * fetch the ledger row directly via tracesByCallId and render its key fields.
 */
function CallDetailDialog({ callId, onClose }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    if (callId == null) return;
    callLedgerApi.tracesByCallId(callId).then(setRows).catch(() => setRows([]));
  }, [callId]);

  const row = rows?.[0] || null;

  return (
    <Dialog open={callId != null} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Call detail</Typography>
          <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent>
        {!rows && <Typography variant="body2">Loading…</Typography>}
        {rows && !row && <Typography variant="body2">No record found.</Typography>}
        {row && (
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip size="small" label={`intent: ${row.intent}`} />
              <Chip size="small" label={`provider: ${row.provider}`} />
              <Chip size="small" label={`$${(row.cost_usd || 0).toFixed(5)}`} />
              <Chip size="small" label={row.cache_hit ? 'cached' : 'fresh'} />
            </Stack>
            {row.context_keys && (
              <Typography variant="caption">
                Context: {(row.context_keys || []).join(', ') || 'none'}
              </Typography>
            )}
            {(row.output_summary || row.output_json) && (
              <Box sx={{ background: '#fafafa', p: 1, borderRadius: 1, maxHeight: 200, overflow: 'auto' }}>
                <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0 }}>
                  {row.output_summary || JSON.stringify(
                    typeof row.output_json === 'string'
                      ? safeParseJson(row.output_json)
                      : row.output_json,
                    null,
                    2,
                  )}
                </Typography>
              </Box>
            )}
            {rows.length > 1 && (
              <Box sx={{ mt: 1, p: 1, background: '#f8f8f8', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
                  Director trace ({rows.length} steps)
                </Typography>
                {rows.map((r, i) => (
                  <Typography key={r.id} variant="caption" component="div" sx={{ pl: 1 }}>
                    Step {i + 1}: {r.output_summary || '(no summary)'}
                  </Typography>
                ))}
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

function safeParseJson(s) {
  try { return JSON.parse(s); } catch { return s; }
}

export default function ROITab() {
  const [lens, setLens] = useState(loadInitialLens);
  const [windowRange, setWindowRange] = useState(loadInitialWindow);
  const [bars, setBars] = useState([]);
  const [density, setDensity] = useState([]);

  // Drill-down state
  const [expanded, setExpanded] = useState(null);
  const [subBars, setSubBars] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLens, setDrawerLens] = useState(null);
  const [drawerGroupKey, setDrawerGroupKey] = useState(null);
  const [rationaleCallId, setRationaleCallId] = useState(null);

  useEffect(() => { try { localStorage.setItem('phase13.lens', lens); } catch (_e) {} }, [lens]);
  useEffect(() => { try { localStorage.setItem('phase13.window', JSON.stringify(windowRange)); } catch (_e) {} }, [windowRange]);

  useEffect(() => {
    callLedgerApi.attributionDensityStrip(1).then((rows) => setDensity(rows || []));
  }, []);

  const refresh = useCallback(async () => {
    const result = await callLedgerApi.attributionBars({
      lens, from: windowRange.from, to: windowRange.to, userId: 1,
    });
    setBars(result || []);
    // Collapse expansion whenever the top-level bars reload
    setExpanded(null);
    setSubBars([]);
  }, [lens, windowRange]);
  useEffect(() => { refresh(); }, [refresh]);

  // Top-level bar click — toggle expand and load per-intent sub-bars for that group
  const onBarClick = useCallback(async (groupKey) => {
    if (expanded === groupKey) {
      setExpanded(null);
      setSubBars([]);
      return;
    }
    setExpanded(groupKey);
    // Fetch the intent breakdown filtered to THIS group's surfaces. Without
    // parentLens + parentGroupKey the backend returns every intent in the
    // window — irrelevant when the user just clicked one specific bar.
    // When the current lens is already 'intent' the sub-bar concept doesn't
    // apply (each bar is already an intent); we skip the fetch.
    if (lens === 'intent') {
      setSubBars([]);
      return;
    }
    try {
      const all = await callLedgerApi.attributionBars({
        lens: 'intent',
        from: windowRange.from,
        to: windowRange.to,
        userId: 1,
        parentLens: lens,
        parentGroupKey: groupKey,
      });
      setSubBars(all || []);
    } catch {
      setSubBars([]);
    }
  }, [expanded, lens, windowRange]);

  const onSubBarClick = useCallback((intent) => {
    setDrawerLens('intent');
    setDrawerGroupKey(intent);
    setDrawerOpen(true);
  }, []);

  return (
    <Stack spacing={2} sx={{ pt: 2 }}>
      <BrushableDensityStrip
        densityData={density}
        selected={windowRange}
        onChange={setWindowRange}
      />
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2">Cost per mastery move</Typography>
        <LensToggle value={lens} onChange={setLens} />
      </Stack>
      <AttributionBarChart
        bars={bars}
        expandedKey={expanded}
        onBarClick={onBarClick}
        subBarsForExpanded={subBars}
        onSubBarClick={onSubBarClick}
      />
      <GroupDetailDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        lens={drawerLens}
        groupKey={drawerGroupKey}
        windowRange={windowRange}
        userId={1}
        onOpenRationale={(callId) => setRationaleCallId(callId)}
      />
      {rationaleCallId != null && (
        <CallDetailDialog
          callId={rationaleCallId}
          onClose={() => setRationaleCallId(null)}
        />
      )}
    </Stack>
  );
}
