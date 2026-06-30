import React from 'react';
import {
  Box,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

const LEVELS = [
  { id: 'A', label: 'A · Drill', subtitle: 'Short sentence — attempt + compare' },
  { id: 'B', label: 'B · Paragraph', subtitle: 'Paragraph compose-and-compare' },
  { id: 'C', label: 'C · Lookup', subtitle: 'Show the answer + breakdown' },
];

function LevelSelector({ level, onChange }) {
  const theme = useTheme();
  return (
    <Box>
      <Typography
        variant="caption"
        sx={{
          color: theme.palette.text.disabled,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          display: 'block',
          mb: 1,
        }}
      >
        Level
      </Typography>
      <RadioGroup
        value={level}
        onChange={(e) => onChange(e.target.value)}
        sx={{ gap: 0.5 }}
      >
        {LEVELS.map((opt) => (
          <FormControlLabel
            key={opt.id}
            value={opt.id}
            control={<Radio size="small" />}
            label={
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                  {opt.label}
                </Typography>
                <Typography
                  sx={{ fontSize: '0.7rem', color: theme.palette.text.secondary }}
                >
                  {opt.subtitle}
                </Typography>
              </Box>
            }
            sx={{
              m: 0,
              p: 0.5,
              borderRadius: 1,
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) },
            }}
          />
        ))}
      </RadioGroup>
    </Box>
  );
}

export default LevelSelector;
