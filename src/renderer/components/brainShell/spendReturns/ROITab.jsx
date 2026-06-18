import React, { useEffect, useState, useCallback } from 'react';
import { Stack, Typography } from '@mui/material';
import callLedgerApi from '../../../api/callLedgerApi';
import LensToggle from './LensToggle';
import AttributionBarChart from './AttributionBarChart';
import BrushableDensityStrip from './BrushableDensityStrip';

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

export default function ROITab() {
  const [lens, setLens] = useState(loadInitialLens);
  const [windowRange, setWindowRange] = useState(loadInitialWindow);
  const [bars, setBars] = useState([]);
  const [density, setDensity] = useState([]);

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
  }, [lens, windowRange]);
  useEffect(() => { refresh(); }, [refresh]);

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
      <AttributionBarChart bars={bars} />
      {/* GroupDetailDrawer — Task 17 */}
    </Stack>
  );
}
