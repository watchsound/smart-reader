// src/renderer/components/MoodBoard/diagram/canvas/ColorZoneLayer.tsx
import * as React from 'react';
import { ColorZone } from '../types';

export interface ColorZoneLayerProps {
  zones: ColorZone[];
}

function ColorZoneLayer({ zones }: ColorZoneLayerProps) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      {zones.map((z) => (
        <div
          key={z.id}
          data-testid="color-zone"
          style={{
            position: 'absolute',
            left: z.x,
            top: z.y,
            width: z.width,
            height: z.height,
            background: z.color,
            opacity: z.opacity,
            borderRadius: 8,
          }}
        >
          {z.label && (
            <div
              style={{
                position: 'absolute',
                top: 4,
                left: 8,
                fontSize: 11,
                fontWeight: 600,
                // Don't use `opacity` here — it would stack multiplicatively
                // with the parent zone's opacity, making the label nearly
                // invisible at typical zone opacities (e.g. 0.2 × 0.7 = 0.14).
                // Alpha must bake into the color value instead.
                color: 'color-mix(in srgb, var(--mb-ink, #1a1a1a) 80%, transparent)',
              }}
            >
              {z.label}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default ColorZoneLayer;
