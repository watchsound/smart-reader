import React from 'react';
import '@testing-library/jest-dom';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
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
      <button type="button" ref={btnRef}>
        anchor
      </button>
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
          {
            id: 'q1',
            name: 'German B2',
            goal: 'reach B2',
            status: 'active',
            bookIds: [1, 2],
          },
        ]);
      }
      if (channel === 'quest-list' && payload?.status === 'paused') {
        return Promise.resolve([
          {
            id: 'q2',
            name: 'Calc 101',
            goal: 'finish Stewart',
            status: 'paused',
            bookIds: [],
          },
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
            : [
                {
                  id: 'q1',
                  name: 'XQuestName',
                  goal: 'g',
                  status: 'active',
                  bookIds: [],
                },
              ],
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

  test('renders progress caption with cards + books-started ratio', async () => {
    invokeFn.mockImplementation((channel, payload) => {
      if (channel === 'quest-list' && payload?.status === 'active') {
        return Promise.resolve([
          {
            id: 'q1',
            name: 'German B2',
            goal: 'reach B2',
            status: 'active',
            bookIds: [1, 2, 3],
          },
        ]);
      }
      if (channel === 'quest-progress' && payload?.id === 'q1') {
        return Promise.resolve({
          questId: 'q1',
          learningPointsTotal: 12,
          booksStarted: 2,
          booksTotal: 3,
          pathStepsTotal: 0,
        });
      }
      return Promise.resolve([]);
    });
    render(<Wrapper open />);
    await screen.findByText('German B2', {}, { timeout: 2000 });
    // Caption joins parts with " · ".
    await waitFor(() =>
      expect(
        screen.getByText(/12 cards · 2\/3 books started/),
      ).toBeInTheDocument(),
    );
  });

  test('phase-7 quest appends path-step count to caption', async () => {
    invokeFn.mockImplementation((channel, payload) => {
      if (channel === 'quest-list' && payload?.status === 'active') {
        return Promise.resolve([
          {
            id: 'q7',
            name: 'CS path',
            goal: 'learn distributed systems',
            status: 'active',
            bookIds: [10],
            metadata: { source: 'phase-7-learning-path' },
          },
        ]);
      }
      if (channel === 'quest-progress' && payload?.id === 'q7') {
        return Promise.resolve({
          questId: 'q7',
          learningPointsTotal: 3,
          booksStarted: 1,
          booksTotal: 1,
          pathStepsTotal: 5,
        });
      }
      return Promise.resolve([]);
    });
    render(<Wrapper open />);
    await screen.findByText('CS path', {}, { timeout: 2000 });
    await waitFor(() =>
      expect(
        screen.getByText(/3 cards · 1\/1 books started · Path: 5 steps/),
      ).toBeInTheDocument(),
    );
  });

  test('falls back to scope caption when progress IPC returns nothing', async () => {
    invokeFn.mockImplementation((channel, payload) => {
      if (channel === 'quest-list' && payload?.status === 'active') {
        return Promise.resolve([
          {
            id: 'qx',
            name: 'Unloaded',
            goal: 'g',
            status: 'active',
            bookIds: [7, 8],
          },
        ]);
      }
      // quest-progress returns [] (array — invalid shape) to mimic the
      // case where the handler is missing or errors silently.
      return Promise.resolve([]);
    });
    render(<Wrapper open />);
    await screen.findByText('Unloaded', {}, { timeout: 2000 });
    expect(screen.getByText(/2 books in scope/)).toBeInTheDocument();
  });
});
