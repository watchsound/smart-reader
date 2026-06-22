// src/renderer/components/MoodBoard/diagram/canvas/ThemePicker.tsx
import * as React from 'react';
import { BoardTheme, PALETTE_IDS, PaletteId } from '../types';
import { PALETTES } from './themes';

export interface ThemePickerProps {
  theme: BoardTheme;
  onChange: (next: BoardTheme) => void;
}

function ThemePicker({ theme, onChange }: ThemePickerProps) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {PALETTE_IDS.map((id) => {
        const palette = id !== 'custom' ? PALETTES[id] : null;
        const selected = theme.paletteId === id;
        return (
          <button
            key={id}
            type="button"
            data-testid="theme-option"
            data-palette-id={id}
            data-selected={selected ? 'true' : 'false'}
            onClick={() => onChange({ ...theme, paletteId: id as PaletteId })}
            style={{
              width: 24,
              height: 24,
              borderRadius: 4,
              border: selected ? '2px solid #2196f3' : '1px solid #ccc',
              cursor: 'pointer',
              background: palette
                ? `linear-gradient(135deg, ${palette.accent} 50%, ${palette.bg} 50%)`
                : 'repeating-linear-gradient(45deg, #ddd 0 4px, #fff 4px 8px)',
              padding: 0,
            }}
            title={id}
          />
        );
      })}
    </div>
  );
}

export default ThemePicker;
