// src/__tests__/renderer/moodboardPhase1.integration.test.ts
import { FrameNodeModel } from '../../renderer/components/MoodBoard/diagram/FrameNodeModel';
import { StickyNoteNodeModel } from '../../renderer/components/MoodBoard/diagram/StickyNoteNodeModel';
import { updateContainmentForNode } from '../../renderer/components/MoodBoard/diagram/containment';
import CustomLinkModel from '../../renderer/components/MoodBoard/diagram/CustomLinkModel';

interface NodeLike {
  getID(): string;
  getX(): number;
  getY(): number;
  width: number;
  height: number;
  getType(): string;
  setPosition(x: number, y: number): void;
}

function makeNoteLikeNode(id: string, x: number, y: number): NodeLike {
  let _x = x;
  let _y = y;
  return {
    getID: () => id,
    getX: () => _x,
    getY: () => _y,
    width: 100,
    height: 50,
    getType: () => 'note',
    setPosition: (nx, ny) => {
      _x = nx;
      _y = ny;
    },
  };
}

describe('MoodBoard Phase 1 integration', () => {
  test('frame + contained nodes drag together; link relationType survives serialize round-trip', () => {
    // Set up: one frame, two notes inside it, one sticky outside.
    const frame = new FrameNodeModel({ label: 'Cluster A' });
    frame.setPosition(0, 0);
    frame.setSize(500, 500);

    const noteA = makeNoteLikeNode('note-a', 100, 100);
    const noteB = makeNoteLikeNode('note-b', 250, 200);
    const sticky = new StickyNoteNodeModel({ text: 'central idea' });
    sticky.setPosition(700, 100); // far outside

    // Drop-detect each node into the frame system.
    updateContainmentForNode(noteA, [frame]);
    updateContainmentForNode(noteB, [frame]);
    updateContainmentForNode(
      {
        getID: () => sticky.getID(),
        getX: () => sticky.getX(),
        getY: () => sticky.getY(),
        width: sticky.width,
        height: sticky.height,
        getType: () => sticky.getType(),
      },
      [frame],
    );

    expect(frame.containedNodeIds.sort()).toEqual(['note-a', 'note-b']);

    // Simulate frame drag by (50, -30).
    const lookup = new Map<string, NodeLike>([
      ['note-a', noteA],
      ['note-b', noteB],
    ]);
    frame.translateContainedBy(50, -30, (id) => lookup.get(id) ?? null);

    expect(noteA.getX()).toBe(150);
    expect(noteA.getY()).toBe(70);
    expect(noteB.getX()).toBe(300);
    expect(noteB.getY()).toBe(170);

    // Link with relationType round-trips.
    const link = new CustomLinkModel({ relationType: 'contrasts' });
    const data = link.serialize();
    const restored = new CustomLinkModel();
    restored.deserialize({ data });
    expect(restored.relationType).toBe('contrasts');
  });
});
