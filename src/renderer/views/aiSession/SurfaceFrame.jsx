import React from 'react';
import LeitnerSurface from './surfaces/LeitnerSurface';
import ComprehensionSurface from './surfaces/ComprehensionSurface';
import MicroCardChipSurface from './surfaces/MicroCardChipSurface';
import MoodBoardSurface from './surfaces/MoodBoardSurface';

const SURFACES = {
  openLeitnerCard: LeitnerSurface,
  openComprehensionPanel: ComprehensionSurface,
  openMicroCardChip: MicroCardChipSurface,
  openMoodBoard: MoodBoardSurface,
};

export default function SurfaceFrame({ pendingSurface, onSubmit, lastThought }) {
  if (!pendingSurface) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999' }}>
        <div style={{ fontSize: 18, marginBottom: 8 }}>Thinking...</div>
        {lastThought && <div style={{ fontSize: 13, color: '#bbb', maxWidth: 400, textAlign: 'center' }}>{lastThought}</div>}
      </div>
    );
  }
  const Surface = SURFACES[pendingSurface.tool];
  if (!Surface) {
    return <div style={{ padding: 24, color: '#c33' }}>Unknown surface: {pendingSurface.tool}</div>;
  }
  return <Surface args={pendingSurface.args} onSubmit={onSubmit} />;
}
