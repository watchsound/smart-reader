// src/__tests__/renderer/containment.test.ts
import {
  rectFromNode,
  pointInsideRect,
  updateContainmentForNode,
} from '../../renderer/components/MoodBoard/diagram/containment';
import { FrameNodeModel } from '../../renderer/components/MoodBoard/diagram/FrameNodeModel';

function makeNodeLike(id: string, x: number, y: number, w = 100, h = 50) {
  return {
    getID: () => id,
    getX: () => x,
    getY: () => y,
    width: w,
    height: h,
    getType: () => 'note',
  };
}

describe('containment', () => {
  test('pointInsideRect — inside / boundary / outside', () => {
    const r = { x: 0, y: 0, width: 100, height: 100 };
    expect(pointInsideRect({ x: 50, y: 50 }, r)).toBe(true);
    expect(pointInsideRect({ x: 0, y: 0 }, r)).toBe(true); // top-left edge counts as inside
    expect(pointInsideRect({ x: 101, y: 50 }, r)).toBe(false);
  });

  test('rectFromNode returns axis-aligned box', () => {
    const n = makeNodeLike('a', 10, 20, 100, 50);
    expect(rectFromNode(n)).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  test('updateContainmentForNode adds node to the frame it lands in', () => {
    const frame = new FrameNodeModel({});
    frame.setPosition(0, 0);
    frame.setSize(500, 500);
    const node = makeNodeLike('n1', 100, 100); // center (150, 125) → inside

    updateContainmentForNode(node, [frame]);
    expect(frame.containedNodeIds).toEqual(['n1']);
  });

  test('updateContainmentForNode removes node when dropped outside its previous frame', () => {
    const frame = new FrameNodeModel({});
    frame.setPosition(0, 0);
    frame.setSize(500, 500);
    frame.addContained('n1');

    const node = makeNodeLike('n1', 1000, 1000); // far outside
    updateContainmentForNode(node, [frame]);
    expect(frame.containedNodeIds).toEqual([]);
  });

  test('updateContainmentForNode rejects nested frames', () => {
    const outer = new FrameNodeModel({});
    outer.setPosition(0, 0);
    outer.setSize(500, 500);
    const inner = new FrameNodeModel({});
    inner.setPosition(50, 50);
    inner.setSize(100, 100);

    updateContainmentForNode(
      {
        getID: () => 'inner',
        getX: () => 50,
        getY: () => 50,
        width: 100,
        height: 100,
        getType: () => 'frame',
      },
      [outer, inner],
    );
    expect(outer.containedNodeIds).toEqual([]); // nested rejected
  });
});
