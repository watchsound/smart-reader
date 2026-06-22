// src/renderer/components/MoodBoard/diagram/canvas/BackgroundPicker.tsx
import * as React from 'react';
import { BackgroundLayerSpec, BackgroundMode } from '../types';

export interface BackgroundPickerProps {
  spec: BackgroundLayerSpec;
  onChange: (next: BackgroundLayerSpec) => void;
}

const MODES: BackgroundMode[] = ['none', 'pattern', 'image'];

function BackgroundPicker({ spec, onChange }: BackgroundPickerProps) {
  const onPick = (mode: BackgroundMode) => {
    if (mode === 'image') {
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
    onChange({ ...spec, mode });
  };

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          data-mode={mode}
          data-selected={spec.mode === mode ? 'true' : 'false'}
          onClick={() => onPick(mode)}
          style={{
            padding: '2px 8px',
            fontSize: 11,
            border: spec.mode === mode ? '2px solid #2196f3' : '1px solid #ccc',
            borderRadius: 4,
            background: 'rgba(255,255,255,0.92)',
            cursor: 'pointer',
            textTransform: 'capitalize',
          }}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}

export default BackgroundPicker;
