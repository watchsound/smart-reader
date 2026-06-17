// src/renderer/components/brainShell/RationaleCard.jsx
import React, { useEffect, useState } from 'react';
import { Box, Typography, Chip, IconButton, Collapse, Stack } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import callLedgerApi from '../../api/callLedgerApi';

/**
 * RationaleCard — expandable "why this, why now" for a Proposal.
 *
 * Props:
 *   triggerId: string  — the trigger to look up in the Call Ledger.
 */
export default function RationaleCard({ triggerId }) {
  const [open, setOpen] = useState(false);
  const [row, setRow] = useState(null);
  const [trace, setTrace] = useState(null);

  useEffect(() => {
    if (!open || row || !triggerId) return undefined;
    let cancelled = false;
    callLedgerApi
      .rationaleByTrigger(triggerId)
      .then((r) => { if (!cancelled) setRow(r); })
      .catch(() => { if (!cancelled) setRow(null); });
    return () => { cancelled = true; };
  }, [open, triggerId, row]);

  useEffect(() => {
    if (!open || !row || !row.trace_id) return undefined;
    let cancelled = false;
    callLedgerApi.tracesByCallId(row.id).then((t) => { if (!cancelled) setTrace(t); });
    return () => { cancelled = true; };
  }, [open, row]);

  if (!triggerId) return null;

  const renderOutput = () => {
    if (row.output_summary) return row.output_summary;
    if (row.output_json) {
      const obj = typeof row.output_json === 'string'
        ? safeParse(row.output_json)
        : row.output_json;
      return JSON.stringify(obj, null, 2);
    }
    return '(no output recorded)';
  };

  return (
    <Box sx={{ mt: 1, borderTop: '1px solid #eee', pt: 1 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <IconButton size="small" onClick={() => setOpen((v) => !v)} aria-label="toggle rationale">
          {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
        <Typography variant="caption" color="text.secondary">
          Why the Brain proposed this
        </Typography>
      </Stack>
      <Collapse in={open}>
        {!row && <Typography variant="caption">Loading…</Typography>}
        {row && (
          <Box sx={{ pl: 2, pt: 1 }}>
            <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
              <Chip size="small" label={`intent: ${row.intent}`} />
              <Chip size="small" label={`provider: ${row.provider}`} />
              <Chip size="small" label={`$${(row.cost_usd || 0).toFixed(5)}`} />
              <Chip size="small" label={row.cache_hit ? 'cached' : 'fresh'} />
            </Stack>
            <Typography variant="caption" component="div" sx={{ mb: 1 }}>
              Context used: {(row.context_keys || []).join(', ') || 'none'}
            </Typography>
            <Box sx={{ background: '#fafafa', p: 1, borderRadius: 1, maxHeight: 200, overflow: 'auto' }}>
              <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0 }}>
                {renderOutput()}
              </Typography>
            </Box>
            {trace && trace.length > 1 && (
              <Box sx={{ mt: 1, p: 1, background: '#f8f8f8', borderRadius: 1 }}>
                <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
                  Director trace ({trace.length} steps)
                </Typography>
                {trace.map((r, i) => (
                  <Typography key={r.id} variant="caption" component="div" sx={{ pl: 1 }}>
                    Step {i + 1}: {r.output_summary || '(no summary)'}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        )}
      </Collapse>
    </Box>
  );
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return s; }
}
