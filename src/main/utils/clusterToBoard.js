/**
 * clusterToBoard — Phase 3 helper.
 *
 * Converts a Phase 8b cluster ({ label, domain, notes: [{ id, title }] })
 * into a Phase 2-shaped board payload ({ theme, frames, nodes, suggestedLinks }).
 * The frame contains every note in the cluster; nodes are placed in a compact
 * 3-column grid inside the frame at fixed positions.
 *
 * The `theme.paletteId` is picked deterministically from the cluster's domain.
 * `suggestedLinks: []` is reserved for a Phase 3.5 LLM enrichment pass.
 */

const DOMAIN_PALETTE = {
  vocabulary: 'austere-mono',
  narrative: 'warm-roman',
  code: 'cold-noir',
  math: 'cold-noir',
};

function paletteForDomain(domain) {
  return DOMAIN_PALETTE[domain] || 'paper-and-ink';
}

let nodeCounter = 0;
function makeNodeId() {
  nodeCounter += 1;
  return `c2b-node-${Date.now()}-${nodeCounter}`;
}

let frameCounter = 0;
function makeFrameId() {
  frameCounter += 1;
  return `c2b-frame-${Date.now()}-${frameCounter}`;
}

function clusterToBoard(cluster) {
  const theme = { paletteId: paletteForDomain(cluster.domain) };
  if (!cluster.notes || cluster.notes.length === 0) {
    return { theme, frames: [], nodes: [], suggestedLinks: [] };
  }

  const FRAME_X = 80;
  const FRAME_Y = 80;
  const FRAME_W = Math.min(900, 280 * Math.min(3, cluster.notes.length) + 40);
  const FRAME_H = 60 + 220 * Math.ceil(cluster.notes.length / 3);

  const frameId = makeFrameId();
  const nodes = cluster.notes.map((note, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    return {
      id: makeNodeId(),
      type: 'note',
      noteId: note.id,
      x: FRAME_X + 30 + col * 280,
      y: FRAME_Y + 40 + row * 220,
      width: 250,
      height: 180,
    };
  });

  const frames = [
    {
      id: frameId,
      label: cluster.label || 'Untitled cluster',
      accentColor: '#9e9e9e',
      x: FRAME_X,
      y: FRAME_Y,
      width: FRAME_W,
      height: FRAME_H,
      containedNodeIds: nodes.map((n) => n.id),
    },
  ];

  return { theme, frames, nodes, suggestedLinks: [] };
}

module.exports = { clusterToBoard, paletteForDomain };
