import React, { useEffect, useState } from 'react';
import {
  Drawer, List, ListItem, ListItemText, Typography, Stack, Box, IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import callLedgerApi from '../../../api/callLedgerApi';
import AmortizedBadge from './AmortizedBadge';

const fmtUSD = (v) => `$${(v ?? 0).toFixed(v < 0.01 ? 4 : 2)}`;

export default function GroupDetailDrawer({
  open, onClose, lens, groupKey, windowRange, userId, onOpenRationale,
}) {
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (!open || !groupKey) { setDetail(null); return; }
    callLedgerApi.attributionGroupDetail({
      lens, groupKey, from: windowRange.from, to: windowRange.to, userId,
    }).then(setDetail).catch(() => setDetail(null));
  }, [open, lens, groupKey, windowRange?.from, windowRange?.to, userId]);

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 420 } }}>
      <Stack sx={{ p: 2 }} spacing={1}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{detail?.group?.label || groupKey || ''}</Typography>
          <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
        </Stack>
        {detail?.group && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {detail.group.eventCount} events · {fmtUSD(detail.group.totalCostUsd)} total
          </Typography>
        )}
        {!detail && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Loading…</Typography>
        )}
        {detail && detail.events.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>No events in window.</Typography>
        )}
        {detail && detail.events.length > 0 && (
          <List dense>
            {detail.events.map((ev) => (
              <ListItem
                key={`${ev.learningPointId}-${ev.ts}`}
                onClick={() => !ev.amortized && onOpenRationale?.(ev.proximateCallId)}
                sx={{
                  cursor: ev.amortized ? 'default' : 'pointer',
                  '&:hover': ev.amortized ? undefined : { bgcolor: 'action.hover' },
                  borderRadius: 1,
                }}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="body2">{ev.learningPointId}</Typography>
                      {ev.amortized && <AmortizedBadge />}
                    </Stack>
                  }
                  secondary={
                    <Box component="span">
                      <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                        {new Date(ev.ts).toLocaleString()} · {fmtUSD(ev.eventCostUsd)}
                        {ev.intent && ` · ${ev.intent}`}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Stack>
    </Drawer>
  );
}
