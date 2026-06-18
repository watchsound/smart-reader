import React from 'react';
import { Box, Typography } from '@mui/material';

export default function ReliabilityDiagram({ reliability }) {
  if (!reliability || reliability.length === 0) {
    return <Typography variant="caption">No data yet.</Typography>;
  }
  const allValues = reliability.flatMap((r) => [r.predictedDelta, r.realizedDelta]);
  const max = Math.max(...allValues, 1);
  const min = Math.min(...allValues, 0);
  const range = max - min || 1;
  const barH = 18;
  const w = 220;
  const scale = (v) => ((v - min) / range) * w;
  return (
    <Box>
      {reliability.map((r) => (
        <Box key={r.bin} sx={{ mb: 1 }}>
          <Typography variant="caption">Bin {r.bin + 1} (n={r.n})</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ position: 'relative', height: barH, background: '#eef', mb: '4px' }}>
              <Box sx={{
                position: 'absolute', left: 0, top: 0, height: barH,
                width: `${scale(r.predictedDelta)}px`, background: '#88c',
              }} />
              <Typography variant="caption" sx={{ position: 'absolute', right: 4 }}>
                predicted {r.predictedDelta.toFixed(2)}
              </Typography>
            </Box>
            <Box sx={{ position: 'relative', height: barH, background: '#efe' }}>
              <Box sx={{
                position: 'absolute', left: 0, top: 0, height: barH,
                width: `${scale(r.realizedDelta)}px`, background: '#8c8',
              }} />
              <Typography variant="caption" sx={{ position: 'absolute', right: 4 }}>
                realized {r.realizedDelta.toFixed(2)}
              </Typography>
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
