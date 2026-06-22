// src/__tests__/renderer/frameNodeDrag.test.ts
import { FrameNodeModel } from '../../renderer/components/MoodBoard/diagram/FrameNodeModel';

class FakeChild {
  private x = 0;
  private y = 0;
  constructor(public id: string, x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  getID() {
    return this.id;
  }
  getX() {
    return this.x;
  }
  getY() {
    return this.y;
  }
  setPosition(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

describe('Frame drag translates contained nodes', () => {
  test('translateContainedBy moves every contained child by dx/dy', () => {
    const frame = new FrameNodeModel({});
    const children = [
      new FakeChild('a', 100, 100),
      new FakeChild('b', 200, 100),
    ];
    frame.addContained('a');
    frame.addContained('b');

    const lookup = new Map(children.map((c) => [c.getID(), c]));
    frame.translateContainedBy(20, -10, (id) => lookup.get(id) ?? null);

    expect(children[0].getX()).toBe(120);
    expect(children[0].getY()).toBe(90);
    expect(children[1].getX()).toBe(220);
    expect(children[1].getY()).toBe(90);
  });

  test('translateContainedBy ignores missing children silently', () => {
    const frame = new FrameNodeModel({});
    frame.addContained('ghost'); // no lookup entry
    expect(() =>
      frame.translateContainedBy(10, 10, () => null),
    ).not.toThrow();
  });
});
