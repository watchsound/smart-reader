import React, { useEffect, useState } from 'react';
import { Box, Typography, Tooltip, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import callLedgerApi from '../../api/callLedgerApi';

const DAY = 86_400_000;

export default function AISpendCard() {
  const [byProvider, setByProvider] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const since = Date.now() - 30 * DAY;
    callLedgerApi
      .aggregateByProvider(since)
      .then((rows) => setByProvider(rows || []));
  }, []);

  const total = byProvider.reduce((s, r) => s + (r.total_cost_usd || 0), 0);
  // 30-day window is already one month, so projected === total
  const projected = total;

  const tooltipBody =
    byProvider.length === 0
      ? 'No LLM calls yet'
      : byProvider
          .map((r) => `${r.key}: $${(r.total_cost_usd || 0).toFixed(2)}`)
          .join(' · ');

  const handleClick = () => {
    navigate('/');
    // Scroll to Brain Dashboard panel after navigation settles
    setTimeout(() => {
      const el = document.getElementById('brain-dashboard');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <Tooltip title={tooltipBody}>
      <Paper
        onClick={handleClick}
        sx={{
          p: 2,
          cursor: 'pointer',
          '&:hover': { boxShadow: 3 },
          display: 'flex',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <AccountBalanceWalletIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            AI Spend · 30d
          </Typography>
          <Typography variant="h6">${total.toFixed(2)}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            ~${projected.toFixed(2)}/mo projected
          </Typography>
        </Box>
      </Paper>
    </Tooltip>
  );
}
