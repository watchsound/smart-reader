// src/renderer/components/MoodBoard/diagram/canvas/BackgroundLayer.tsx
import * as React from 'react';
import { BackgroundLayerSpec } from '../types';

export interface BackgroundLayerProps {
  spec: BackgroundLayerSpec;
}

function DotGridPattern({ tint }: { tint: string }) {
  // Deterministic SVG dot-grid. Tile size 24px; dot radius 1px.
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="mb-dot-grid" width={24} height={24} patternUnits="userSpaceOnUse">
          <circle cx={12} cy={12} r={1} fill={tint} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#mb-dot-grid)" />
    </svg>
  );
}

function PaperGrainPattern({ tint }: { tint: string }) {
  // Subtle diagonal hatching as a stand-in for paper grain. Deterministic.
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="mb-paper-grain" width={8} height={8} patternUnits="userSpaceOnUse">
          <path d="M 0 8 L 8 0" stroke={tint} strokeWidth={0.5} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#mb-paper-grain)" />
    </svg>
  );
}

function BackgroundLayer({ spec }: BackgroundLayerProps) {
  const opacity = spec.opacity ?? 0.1;

  return (
    <div
      data-testid="background-layer"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
    >
      {spec.mode === 'image' && spec.imageAssetId && (
        <img
          src={spec.imageAssetId}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity,
            filter: 'blur(2px)',
          }}
          alt=""
        />
      )}
      {spec.mode === 'pattern' && (
        <div style={{ opacity, width: '100%', height: '100%', position: 'relative' }}>
          {(spec.patternKey ?? 'dot-grid') === 'dot-grid' ? (
            <DotGridPattern tint="var(--mb-ink, #1a1a1a)" />
          ) : (
            <PaperGrainPattern tint="var(--mb-ink, #1a1a1a)" />
          )}
        </div>
      )}
    </div>
  );
}

export default BackgroundLayer;
