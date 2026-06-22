// src/__tests__/renderer/noteNodeWidget.ports.test.tsx

// Mock NoteUI to prevent pulling in its deep dependency tree (managerSlice →
// sortUtil which has pre-existing TS errors unrelated to this test).
jest.mock('../../renderer/components/note/NoteUI', () => () => <div data-testid="note-ui-stub" />);

// Mock PortWidget: the real one calls engine.registerListener + getPortCoords
// in componentDidMount/Update — plumbing that requires a live canvas we don't have.
// The test only needs to verify that PortWidget children (S.Port) are rendered
// conditionally, so a thin pass-through wrapper is enough.
jest.mock('@projectstorm/react-diagrams', () => {
  const actual = jest.requireActual('@projectstorm/react-diagrams');
  return {
    ...actual,
    PortWidget: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

import React from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import { NoteNodeModel } from '../../renderer/components/MoodBoard/diagram/NoteNodeModel';
import NoteNodeWidget from '../../renderer/components/MoodBoard/diagram/NoteNodeWidget';

const mockStore = configureStore([]);
const store = mockStore({
  moodBoard: { editState: false, showControl: false },
  note: { showTextOnly: false },
});

function renderNode(props = {}) {
  const node = new NoteNodeModel({});
  // Stub the underlying note so NoteUI render path is innocuous.
  (node as any).note = { id: 1 };
  // Engine stub with the minimal PortWidget surface:
  //   componentDidMount calls registerListener, getCanvas, and getPortCoords.
  const engine = {
    registerListener: () => ({ deregister: () => {} }),
    getCanvas: () => null,
    getPortCoords: () => ({ x: 0, y: 0, width: 10, height: 10 }),
  } as any;
  return render(
    <Provider store={store}>
      <NoteNodeWidget node={node} engine={engine} {...props} />
    </Provider>,
  );
}

describe('NoteNodeWidget showPorts toggle', () => {
  test('default (showPorts undefined) does NOT render any PortWidget', () => {
    const { container } = renderNode();
    expect(container.querySelectorAll('[data-testid="note-port"]')).toHaveLength(0);
  });

  test('showPorts=true renders 4 PortWidget children', () => {
    const { container } = renderNode({ showPorts: true });
    expect(container.querySelectorAll('[data-testid="note-port"]')).toHaveLength(4);
  });
});
