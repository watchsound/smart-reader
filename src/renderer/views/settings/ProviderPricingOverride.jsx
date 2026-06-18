import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Stack,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import aiPricingApi from '../../api/aiPricingApi';

/**
 * ProviderPricingOverride — collapsible pricing-override section for one provider.
 *
 * Props:
 *   providerKey  string  — key that matches costEstimator's PRICING table (e.g. "chatgpt")
 *   label        string  — display label (e.g. "OpenAI ChatGPT")
 *
 * Phase 13.2: users on enterprise / Azure / Bedrock tiers or custom deployments
 * can override the hardcoded per-provider rate. costEstimator reads these at
 * call-time via electron-store. Historical ledger rows are NOT recomputed.
 */
export default function ProviderPricingOverride({ providerKey, label }) {
  const [defaults, setDefaults] = useState(null);
  const [overrides, setOverrides] = useState(null);
  const [inputRate, setInputRate] = useState('');
  const [outputRate, setOutputRate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([aiPricingApi.defaults(), aiPricingApi.get()]).then(
      ([d, o]) => {
        setDefaults(d || {});
        setOverrides(o || {});
        const row = (o || {})[providerKey];
        if (row) {
          setInputRate(String(row.input));
          setOutputRate(String(row.output));
        }
      }
    );
  }, [providerKey]);

  if (!defaults || !overrides) return null;

  const defaultRow = defaults[providerKey];
  const overrideRow = overrides[providerKey];
  const hasOverride = !!overrideRow;
  const effective = overrideRow || defaultRow;

  const save = async () => {
    const parsedIn = parseFloat(inputRate);
    const parsedOut = parseFloat(outputRate);
    if (
      !Number.isFinite(parsedIn) ||
      parsedIn < 0 ||
      !Number.isFinite(parsedOut) ||
      parsedOut < 0
    ) {
      return; // guard: button is also disabled, but be explicit
    }
    setSaving(true);
    try {
      const next = await aiPricingApi.set({
        providerKey,
        input: parsedIn,
        output: parsedOut,
      });
      setOverrides(next || {});
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      const next = await aiPricingApi.set({
        providerKey,
        input: null,
        output: null,
      });
      setOverrides(next || {});
      if (defaultRow) {
        setInputRate(String(defaultRow.input));
        setOutputRate(String(defaultRow.output));
      } else {
        setInputRate('');
        setOutputRate('');
      }
    } finally {
      setSaving(false);
    }
  };

  const inputValid =
    inputRate !== '' &&
    Number.isFinite(parseFloat(inputRate)) &&
    parseFloat(inputRate) >= 0;
  const outputValid =
    outputRate !== '' &&
    Number.isFinite(parseFloat(outputRate)) &&
    parseFloat(outputRate) >= 0;

  return (
    <Accordion
      sx={{
        mt: 1,
        boxShadow: 'none',
        '&:before': { display: 'none' },
        bgcolor: 'action.hover',
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 32 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="caption">Pricing</Typography>
          {effective && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              · ${effective.input.toFixed(2)} in / ${effective.output.toFixed(2)}{' '}
              out per 1M tokens
            </Typography>
          )}
          {hasOverride && (
            <Chip size="small" label="override" variant="outlined" />
          )}
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small"
              label="Input $/MTok"
              type="number"
              value={inputRate}
              onChange={(e) => setInputRate(e.target.value)}
              inputProps={{ step: 0.01, min: 0 }}
              sx={{ width: 140 }}
            />
            <TextField
              size="small"
              label="Output $/MTok"
              type="number"
              value={outputRate}
              onChange={(e) => setOutputRate(e.target.value)}
              inputProps={{ step: 0.01, min: 0 }}
              sx={{ width: 140 }}
            />
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              onClick={save}
              disabled={saving || !inputValid || !outputValid}
            >
              Save override
            </Button>
            {hasOverride && (
              <Button size="small" onClick={reset} disabled={saving}>
                Reset to default
              </Button>
            )}
          </Stack>
          {defaultRow && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Default for {label || providerKey}: ${defaultRow.input.toFixed(2)}{' '}
              in / ${defaultRow.output.toFixed(2)} out per 1M tokens
            </Typography>
          )}
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
