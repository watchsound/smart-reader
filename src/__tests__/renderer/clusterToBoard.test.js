/**
 * Tests for the Phase 3 clusterToBoard helper.
 * Lives in renderer/ folder for the regular `npx jest` runner; the module
 * is pure JS with no main-process deps so it imports cleanly.
 */

const {
  clusterToBoard,
  paletteForDomain,
} = require('../../main/utils/clusterToBoard');

describe('clusterToBoard', () => {
  test('paletteForDomain maps domains to built-in palettes deterministically', () => {
    expect(paletteForDomain('vocabulary')).toBe('austere-mono');
    expect(paletteForDomain('narrative')).toBe('warm-roman');
    expect(paletteForDomain('code')).toBe('cold-noir');
    expect(paletteForDomain('math')).toBe('cold-noir');
    expect(paletteForDomain('unknown')).toBe('paper-and-ink');
  });

  test('clusterToBoard produces a Phase 2-shaped board payload', () => {
    const cluster = {
      label: 'Roman emperors',
      domain: 'narrative',
      notes: [
        { id: 101, title: 'Augustus' },
        { id: 102, title: 'Tiberius' },
        { id: 103, title: 'Caligula' },
      ],
    };
    const out = clusterToBoard(cluster);
    expect(out.theme).toEqual({ paletteId: 'warm-roman' });
    expect(out.frames).toHaveLength(1);
    expect(out.frames[0].label).toBe('Roman emperors');
    expect(out.frames[0].containedNodeIds).toHaveLength(3);
    expect(out.nodes).toHaveLength(3);
    expect(out.suggestedLinks).toEqual([]);
  });

  test('clusterToBoard handles empty notes gracefully', () => {
    const out = clusterToBoard({ label: 'Empty', domain: 'narrative', notes: [] });
    expect(out.frames).toEqual([]);
    expect(out.nodes).toEqual([]);
  });

  test('clusterToBoard preserves the noteId on each generated node', () => {
    const cluster = {
      label: 'Foo',
      domain: 'vocabulary',
      notes: [{ id: 7 }, { id: 9 }],
    };
    const out = clusterToBoard(cluster);
    expect(out.nodes.map((n) => n.noteId).sort()).toEqual([7, 9]);
  });
});
