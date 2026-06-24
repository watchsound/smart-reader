import { legacyToCanonical } from '../../commons/utils/content/mindmapMigration';
import type { MindmapData } from '../../commons/model/MindmapData';

describe('legacyToCanonical', () => {
  it('converts a v11 ReactFlow payload to canonical MindmapData', () => {
    const legacy = {
      width: 600,
      height: 400,
      nodes: [
        { id: 'root', data: { label: 'Photosynthesis' }, position: { x: 0, y: 0 } },
        { id: 'n1', data: { label: 'Chlorophyll', detail: 'pigment' }, position: { x: 200, y: 50 } },
        { id: 'n2', data: { label: 'CO2' }, position: { x: 200, y: 150 } },
      ],
      edges: [
        { id: 'e1', source: 'root', target: 'n1', label: 'requires' },
        { id: 'e2', source: 'root', target: 'n2', label: 'consumes' },
      ],
    };
    const result: MindmapData = legacyToCanonical(legacy, 'msg-123');
    expect(result.id).toBe('msg-123');
    expect(result.rootId).toBe('root');
    expect(result.nodes).toHaveLength(3);
    expect(result.nodes[0]).toEqual({
      id: 'root',
      data: expect.objectContaining({ text: 'Photosynthesis', level: 0, parentId: null }),
    });
    expect(result.nodes[1].data.parentId).toBe('root');
    expect(result.nodes[1].data.detail).toBe('pigment');
    expect(result.edges[0]).toEqual(
      expect.objectContaining({ source: 'root', target: 'n1', data: { relation: 'requires' } }),
    );
  });

  it('handles empty legacy data', () => {
    const result = legacyToCanonical({ nodes: [], edges: [] }, 'empty-id');
    expect(result.rootId).toBe('');
    expect(result.nodes).toEqual([]);
  });

  it('drops synthetic "-1" edges and re-roots orphans onto the first node', () => {
    // parseMindmapToReactFlow emits source: "-1" for every top-level bullet
    // when the AI returns a flat list. Without re-rooting, the canonical
    // graph has zero real edges → ELK stacks every node at (0, 0).
    const legacy = {
      nodes: [
        { id: '0', data: { label: 'A' } },
        { id: '1', data: { label: 'B' } },
        { id: '2', data: { label: 'C' } },
      ],
      edges: [
        { id: 'e0', source: '-1', target: '0' },
        { id: 'e1', source: '-1', target: '1' },
        { id: 'e2', source: '-1', target: '2' },
      ],
    };
    const result = legacyToCanonical(legacy, 'm-flat');
    expect(result.rootId).toBe('0');
    // No "-1" should appear as a source on any canonical edge.
    expect(result.edges.every((e) => e.source !== '-1')).toBe(true);
    // The two orphans must now have the root as their source.
    const orphanSources = result.edges
      .filter((e) => e.target === '1' || e.target === '2')
      .map((e) => e.source);
    expect(orphanSources).toEqual(['0', '0']);
    // Levels: root=0, both children=1.
    expect(result.nodes.find((n) => n.id === '0')?.data.level).toBe(0);
    expect(result.nodes.find((n) => n.id === '1')?.data.level).toBe(1);
    expect(result.nodes.find((n) => n.id === '2')?.data.level).toBe(1);
  });

  it('derives level from edge graph when no explicit level field', () => {
    const legacy = {
      nodes: [
        { id: 'r', data: { label: 'Root' } },
        { id: 'a', data: { label: 'Child' } },
        { id: 'b', data: { label: 'Grandchild' } },
      ],
      edges: [
        { id: 'e1', source: 'r', target: 'a' },
        { id: 'e2', source: 'a', target: 'b' },
      ],
    };
    const result = legacyToCanonical(legacy, 'id');
    const aNode = result.nodes.find((n) => n.id === 'a');
    const bNode = result.nodes.find((n) => n.id === 'b');
    expect(aNode?.data.level).toBe(1);
    expect(bNode?.data.level).toBe(2);
    expect(bNode?.data.parentId).toBe('a');
  });
});
