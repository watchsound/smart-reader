// src/__tests__/renderer/detailedDiagramPanel.runtime.test.tsx
import React from 'react';
import { render, act } from '@testing-library/react';
import { FrameNodeModel } from '../../renderer/components/MoodBoard/diagram/FrameNodeModel';
import { StickyNoteNodeModel } from '../../renderer/components/MoodBoard/diagram/StickyNoteNodeModel';
import { updateContainmentForNode } from '../../renderer/components/MoodBoard/diagram/containment';

describe('DetailedDiagramPanel runtime-add patterns', () => {
  test('Fix 1: useMemo with version counter re-runs when version bumps', () => {
    // Mini component mirroring the pattern: a memo that includes a version
    // in its deps. When version changes, the memo body re-runs and produces
    // updated content.
    const memoRunCounts: number[] = [];
    let bumpVersion: () => void = () => {};

    const TestComponent = () => {
      const [version, setVersion] = React.useState(0);
      bumpVersion = () => setVersion((v) => v + 1);
      const content = React.useMemo(() => {
        memoRunCounts.push(version);
        return <div data-testid="memo-content">v={version}</div>;
      }, [version]);
      return content;
    };

    const { getByTestId } = render(<TestComponent />);
    expect(memoRunCounts).toEqual([0]);
    expect(getByTestId('memo-content').textContent).toBe('v=0');

    act(() => {
      bumpVersion();
    });
    expect(memoRunCounts).toEqual([0, 1]);
    expect(getByTestId('memo-content').textContent).toBe('v=1');
  });

  test('Fix 2: sticky with positionChanged listener updates frame containment on drag', () => {
    // Set up: one frame at (0,0) with size 500x500, one sticky outside it at (1000,1000).
    const frame = new FrameNodeModel({});
    frame.setPosition(0, 0);
    frame.setSize(500, 500);

    const sticky = new StickyNoteNodeModel({ text: 'hi' });
    sticky.setPosition(1000, 1000); // far outside

    // Register the same listener pattern as in the fix, with a closure that
    // sees both the frame and the sticky.
    const framesList = [frame];
    sticky.registerListener({
      positionChanged: () => {
        // Simulate the panel's frame-snapshot pattern via the closure list.
        updateContainmentForNode(
          {
            getID: () => sticky.getID(),
            getX: () => sticky.getX(),
            getY: () => sticky.getY(),
            width: sticky.width,
            height: sticky.height,
            getType: () => sticky.getType(),
          },
          framesList,
        );
      },
    });

    // Drag the sticky into the frame. setPosition fires positionChanged automatically
    // via BasePositionModel.fireEvent (confirmed in storm source).
    sticky.setPosition(100, 100); // center (180, 160) → inside the 500x500 frame

    // The listener should have fired and added sticky to frame's contained set.
    expect(frame.containedNodeIds).toContain(sticky.getID());

    // Drag it back out — listener should remove it.
    sticky.setPosition(1000, 1000);
    expect(frame.containedNodeIds).not.toContain(sticky.getID());
  });
});
