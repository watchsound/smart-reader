import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stack, Typography, Box, Chip, Button, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import predictiveApi from '../../../api/predictiveApi';

const TIME_PRESETS = [5, 15, 30, 60];
const DOLLAR_PRESETS = [0.05, 0.10, 0.30, 1.00];

function summaryRoi(totals) {
  if (!totals || totals.cost <= 0) return null;
  return totals.deltaMastery / totals.cost;
}

export default function PlanTab() {
  const navigate = useNavigate();
  const [timeBudgetMin, setTimeBudgetMin] = useState(15);
  const [dollarBudget, setDollarBudget] = useState(0.30);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [doneIds, setDoneIds] = useState(new Set());

  const onPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const out = await predictiveApi.plan({ timeBudgetMin, dollarBudget });
      setPlan(out);
      setDoneIds(new Set());
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [timeBudgetMin, dollarBudget]);

  const launch = (item) => {
    if (item.actionTarget === 'production-prompt') {
      navigate('/knowledge?tab=production');
    } else if (item.actionTarget === 'director-session') {
      navigate(`/study?lp=${encodeURIComponent(item.learningPointId)}`);
    } else if (item.actionTarget === 'reading' && item.actionPayload?.bookId) {
      navigate(`/reading/${item.actionPayload.bookId}`);
    } else {
      setDoneIds((prev) => new Set([...prev, item.learningPointId]));
    }
  };

  const totalRoi = summaryRoi(plan?.totals);

  return (
    <Stack spacing={2} sx={{ pt: 2 }}>
      <Box>
        <Typography variant="subtitle2" gutterBottom>Time budget</Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={timeBudgetMin}
          onChange={(_, v) => v && setTimeBudgetMin(v)}
        >
          {TIME_PRESETS.map((m) => (
            <ToggleButton key={m} value={m}>{m} min</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      <Box>
        <Typography variant="subtitle2" gutterBottom>Dollar budget</Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={dollarBudget}
          onChange={(_, v) => v != null && setDollarBudget(v)}
        >
          {DOLLAR_PRESETS.map((d) => (
            <ToggleButton key={d} value={d}>${d.toFixed(2)}</ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      <Button variant="contained" size="small" onClick={onPlan} disabled={loading}>
        {loading ? 'Planning…' : 'Plan now'}
      </Button>
      {error && <Typography color="error" variant="caption">{error}</Typography>}

      {plan && plan.items.length === 0 && (
        <Typography variant="caption" sx={{ fontStyle: 'italic', color: '#888' }}>
          No items fit your budget — try raising it, or wait for more events.
        </Typography>
      )}

      {plan && plan.items.length > 0 && (
        <>
          <Box sx={{ p: 1.5, background: '#f7f9fc', borderRadius: 1 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip size="small" label={`+${plan.totals.deltaMastery.toFixed(1)} M`} />
              <Chip size="small" label={`~${plan.totals.timeMin.toFixed(1)} min`} />
              <Chip size="small" label={`$${plan.totals.cost.toFixed(4)}`} />
              {totalRoi && (
                <Chip size="small" label={`ROI ${totalRoi.toFixed(0)}`} />
              )}
              <Chip size="small" variant="outlined" label={`${plan.items.length} items`} />
            </Stack>
          </Box>
          <Stack spacing={1}>
            {plan.items.map((item) => {
              const done = doneIds.has(item.learningPointId);
              return (
                <Box
                  key={`${item.learningPointId}-${item.surface}`}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1, p: 1,
                    border: '1px solid #e2e8f0', borderRadius: 1,
                    opacity: done ? 0.5 : 1,
                  }}
                >
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ textDecoration: done ? 'line-through' : 'none' }}>
                      {item.title || item.learningPointId}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}>
                      <Chip size="small" label={item.surface} variant="outlined" />
                      <Chip size="small" label={`+${item.expectedDelta.toFixed(1)}M`} />
                      <Chip size="small" label={`$${item.expectedCost.toFixed(4)}`} />
                      <Chip size="small" label={`~${item.timeMin.toFixed(1)}m`} />
                    </Stack>
                  </Box>
                  <Button
                    size="small"
                    variant={done ? 'outlined' : 'contained'}
                    onClick={() => launch(item)}
                  >
                    {done ? 'Done' : item.actionTarget ? 'Start' : 'Mark done'}
                  </Button>
                </Box>
              );
            })}
          </Stack>
        </>
      )}
    </Stack>
  );
}
