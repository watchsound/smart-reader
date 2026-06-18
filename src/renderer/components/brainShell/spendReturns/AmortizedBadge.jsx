import React from 'react';
import { Chip, Tooltip } from '@mui/material';

export default function AmortizedBadge() {
  return (
    <Tooltip title="Cost shared across this surface's events — no single call directly attributable.">
      <Chip size="small" label="amortized" variant="outlined" sx={{ ml: 1 }} />
    </Tooltip>
  );
}
