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
