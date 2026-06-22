import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import LassoSelection from '../../renderer/components/MoodBoard/diagram/selection/LassoSelection';

function makeNode(id: string, x: number, y: number, w = 100, h = 50) {
  let selected = false;
  return {
    getID: () => id,
    getX: () => x,
    getY: () => y,
    width: w,
    height: h,
    isSelected: () => selected,
    setSelected: (v: boolean) => {
      selected = v;
    },
  };
}

describe('LassoSelection', () => {
  test('drag-paint selects nodes whose bbox intersects the lasso rect', () => {
    const nodes = [
      makeNode('a', 10, 10),        // inside
      makeNode('b', 500, 500),      // outside
      makeNode('c', 80, 80, 50, 50), // partially inside
    ];
    const { container } = render(
      <LassoSelection nodes={nodes} engine={{ repaintCanvas: jest.fn() }} />,
    );

    const overlay = container.querySelector(
      '[data-testid="lasso-overlay"]',
    ) as HTMLElement;
    expect(overlay).toBeTruthy();

    fireEvent.mouseDown(overlay, {
      shiftKey: true,
      clientX: 0,
      clientY: 0,
    });
    fireEvent.mouseMove(overlay, { clientX: 200, clientY: 200 });
    fireEvent.mouseUp(overlay, { clientX: 200, clientY: 200 });

    expect(nodes[0].isSelected()).toBe(true);
    expect(nodes[1].isSelected()).toBe(false);
    expect(nodes[2].isSelected()).toBe(true);
  });

  test('plain mousedown (no shift) does NOT start a lasso', () => {
    const nodes = [makeNode('a', 10, 10)];
    const { container } = render(
      <LassoSelection nodes={nodes} engine={{ repaintCanvas: jest.fn() }} />,
    );
    const overlay = container.querySelector(
      '[data-testid="lasso-overlay"]',
    ) as HTMLElement;
    fireEvent.mouseDown(overlay, { clientX: 0, clientY: 0 }); // no shift
    fireEvent.mouseMove(overlay, { clientX: 200, clientY: 200 });
    fireEvent.mouseUp(overlay, { clientX: 200, clientY: 200 });
    expect(nodes[0].isSelected()).toBe(false);
  });
});
