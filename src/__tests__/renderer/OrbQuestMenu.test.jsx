import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import OrbQuestMenu from '../../renderer/components/brainShell/OrbQuestMenu';

let invokeFn;

beforeEach(() => {
  invokeFn = jest.fn();
  window.electron = {
    ipcRenderer: {
      on: () => {},
      removeListener: () => {},
      invoke: invokeFn,
    },
  };
});

afterEach(() => {
  delete window.electron;
});

function Wrapper({ open }) {
  const btnRef = React.useRef(null);
  const [el, setEl] = React.useState(null);
  React.useEffect(() => {
    if (open) setEl(btnRef.current);
    else setEl(null);
  }, [open]);
  return (
    <div>
      <button type="button" ref={btnRef}>anchor</button>
      <OrbQuestMenu anchorEl={el} onClose={() => {}} />
    </div>
  );
}

describe('OrbQuestMenu', () => {
  test('shows empty state when no quests', async () => {
    invokeFn.mockResolvedValue([]);
    render(<Wrapper open />);
    await waitFor(() =>
      expect(screen.getByText(/No active quests/)).toBeInTheDocument(),
    );
  });

  test('lists active and paused quests with status chips', async () => {
    invokeFn.mockImplementation((channel, payload) => {
      if (channel === 'quest-list' && payload?.status === 'active') {
        return Promise.resolve([
          { id: 'q1', name: 'German B2', goal: 'reach B2', status: 'active', bookIds: [1, 2] },
        ]);
      }
      if (channel === 'quest-list' && payload?.status === 'paused') {
        return Promise.resolve([
          { id: 'q2', name: 'Calc 101', goal: 'finish Stewart', status: 'paused', bookIds: [] },
        ]);
      }
      return Promise.resolve([]);
    });
    render(<Wrapper open />);
    await screen.findByText('German B2', {}, { timeout: 2000 });
    expect(screen.getByText('Calc 101')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('paused')).toBeInTheDocument();
    expect(screen.getByText(/2 books in scope/)).toBeInTheDocument();
  });

  test('pause button invokes quest-pause IPC and refreshes', async () => {
    let pauseCalled = false;
    invokeFn.mockImplementation((channel, payload) => {
      if (channel === 'quest-pause') {
        pauseCalled = true;
        return Promise.resolve({ id: 'q1', status: 'paused' });
      }
      if (channel === 'quest-list' && payload?.status === 'active') {
        return Promise.resolve(
          pauseCalled
            ? []
            : [{ id: 'q1', name: 'XQuestName', goal: 'g', status: 'active', bookIds: [] }],
        );
      }
      return Promise.resolve([]);
    });
    render(<Wrapper open />);
    await screen.findByText('XQuestName', {}, { timeout: 2000 });
    await act(async () => {
      fireEvent.click(screen.getByLabelText(/pause quest/i));
    });
    expect(pauseCalled).toBe(true);
  });
});
