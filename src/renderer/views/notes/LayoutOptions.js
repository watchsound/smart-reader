import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import { useTheme, alpha } from '@mui/material/styles';

// Icons for text position
import VerticalAlignTopIcon from '@mui/icons-material/VerticalAlignTop';
import VerticalAlignCenterIcon from '@mui/icons-material/VerticalAlignCenter';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import ViewCompactIcon from '@mui/icons-material/ViewCompact';
import ImageIcon from '@mui/icons-material/Image';

import { cardImageOverlapTemplateId as templateIds } from '../../components/cardsetting/card-templates';

// Position options configuration
const POSITION_OPTIONS = [
  {
    value: 0,
    label: 'Default',
    icon: ViewCompactIcon,
    description: 'Image displayed separately',
  },
  {
    value: templateIds[0],
    label: 'Top',
    icon: VerticalAlignTopIcon,
    description: 'Text at top over image',
  },
  {
    value: templateIds[1],
    label: 'Center',
    icon: VerticalAlignCenterIcon,
    description: 'Text centered over image',
  },
  {
    value: templateIds[2],
    label: 'Bottom',
    icon: VerticalAlignBottomIcon,
    description: 'Text at bottom over image',
  },
];

function LayoutOptions({ overlap, onLayoutOptionChanges }) {
  const [value, setValue] = useState(0);
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    setValue(overlap);
  }, [overlap]);

  const handleChange = (event, newValue) => {
    if (newValue !== null) {
      setValue(newValue);
      onLayoutOptionChanges(newValue);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 1,
        py: 0.5,
        borderRadius: '8px',
        bgcolor: alpha(theme.palette.background.paper, 0.6),
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
      }}
    >
      {/* Label with icon */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        <ImageIcon
          sx={{
            fontSize: 16,
            color: theme.palette.primary.main,
          }}
        />
        <Typography
          variant="caption"
          sx={{
            fontWeight: 500,
            color: theme.palette.text.secondary,
            fontSize: '0.75rem',
            whiteSpace: 'nowrap',
          }}
        >
          Text Position
        </Typography>
      </Box>

      {/* Toggle button group */}
      <ToggleButtonGroup
        value={value}
        exclusive
        onChange={handleChange}
        size="small"
        aria-label="text position over image"
        sx={{
          '& .MuiToggleButtonGroup-grouped': {
            border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
            borderRadius: '6px !important',
            mx: 0.25,
            px: 1,
            py: 0.5,
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              borderColor: alpha(theme.palette.primary.main, 0.3),
            },
            '&.Mui-selected': {
              bgcolor: alpha(theme.palette.primary.main, 0.15),
              borderColor: theme.palette.primary.main,
              color: theme.palette.primary.main,
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.2),
              },
            },
          },
        }}
      >
        {POSITION_OPTIONS.map((option) => {
          const IconComponent = option.icon;
          return (
            <ToggleButton
              key={option.value}
              value={option.value}
              aria-label={option.label}
            >
              <Tooltip
                title={
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      {option.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ display: 'block', opacity: 0.8, fontSize: '0.65rem' }}
                    >
                      {option.description}
                    </Typography>
                  </Box>
                }
                arrow
                placement="top"
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  <IconComponent sx={{ fontSize: 16 }} />
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.7rem',
                      fontWeight: value === option.value ? 600 : 400,
                      display: { xs: 'none', sm: 'block' },
                    }}
                  >
                    {option.label}
                  </Typography>
                </Box>
              </Tooltip>
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>
    </Box>
  );
}

export default LayoutOptions;
