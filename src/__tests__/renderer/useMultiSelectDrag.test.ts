// src/__tests__/renderer/useMultiSelectDrag.test.ts
import { translateSelectedExcept } from '../../renderer/components/MoodBoard/diagram/selection/useMultiSelectDrag';

function makeNode(id: string, x: number, y: number, selected = false) {
  return {
    _x: x,
    _y: y,
    _sel: selected,
    getID() {
      return id;
    },
    getX() {
      return this._x;
    },
    getY() {
      return this._y;
    },
    isSelected() {
      return this._sel;
    },
    setPosition(nx: number, ny: number) {
      this._x = nx;
      this._y = ny;
    },
  };
}

describe('translateSelectedExcept', () => {
  test('moves all selected nodes by (dx, dy) except the driver', () => {
    const driver = makeNode('drv', 0, 0, true);
    const other = makeNode('o', 100, 100, true);
    const unselected = makeNode('u', 200, 200, false);

    translateSelectedExcept(driver.getID(), 10, 20, [driver, other, unselected]);

    expect(other.getX()).toBe(110);
    expect(other.getY()).toBe(120);
    expect(driver.getX()).toBe(0); // not translated — driver is moved by storm itself
    expect(driver.getY()).toBe(0);
    expect(unselected.getX()).toBe(200); // not selected → untouched
    expect(unselected.getY()).toBe(200);
  });

  test('no-op when no nodes are selected besides the driver', () => {
    const driver = makeNode('drv', 0, 0, true);
    const other = makeNode('o', 100, 100, false);
    translateSelectedExcept(driver.getID(), 10, 10, [driver, other]);
    expect(other.getX()).toBe(100);
  });
});
