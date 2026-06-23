// src/renderer/components/MoodBoard/diagram/canvas/BackgroundPicker.tsx
import * as React from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import WallpaperIcon from '@mui/icons-material/Wallpaper';
import GridOnIcon from '@mui/icons-material/GridOn';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import { BackgroundLayerSpec, BackgroundMode } from '../types';

export interface BackgroundPickerProps {
  spec: BackgroundLayerSpec;
  onChange: (next: BackgroundLayerSpec) => void;
}

const CYCLE: BackgroundMode[] = ['none', 'pattern', 'image'];

const ICONS: Record<BackgroundMode, React.ReactNode> = {
  none: <CropSquareIcon sx={{ fontSize: 18 }} />,
  pattern: <GridOnIcon sx={{ fontSize: 18 }} />,
  image: <WallpaperIcon sx={{ fontSize: 18 }} />,
};

const LABELS: Record<BackgroundMode, string> = {
  none: 'Background: none (click to switch to pattern)',
  pattern: 'Background: pattern (click to switch to image)',
  image: 'Background: image (click to pick a file)',
};

function BackgroundPicker({ spec, onChange }: BackgroundPickerProps) {
  const current = spec.mode ?? 'none';

  const handleClick = () => {
    const nextMode = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
    if (nextMode === 'image') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          onChange({ mode: 'image', imageAssetId: String(reader.result) });
        };
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }
    onChange({ ...spec, mode: nextMode });
  };

  return (
    <Tooltip title={LABELS[current]}>
      <IconButton
        size="small"
        onClick={handleClick}
        data-testid="background-picker"
        data-mode={current}
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1,
          color: current !== 'none' ? 'primary.main' : 'text.secondary',
          bgcolor: current !== 'none' ? 'action.selected' : 'transparent',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        {ICONS[current]}
      </IconButton>
    </Tooltip>
  );
}

export default BackgroundPicker;
