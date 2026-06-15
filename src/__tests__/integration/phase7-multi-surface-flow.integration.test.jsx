/**
 * Phase 7 end-to-end Multi-Surface Flow integration test.
 *
 * Mirrors phase4-trigger-migration but exercises the multi-surface-flow
 * Flow Unit: synthetic trigger → Orb blooms → user clicks → top strip
 * renders → Next advances + navigates → Done completes + returns Orb to
 * idle.
 */

import React from 'react';
import '@testing-library/jest-dom';
import {
  render,
  screen,
  act,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import {
  MemoryRouter,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom';
import triggerBus from '../../renderer/brain/triggerBus';
import BrainShell from '../../renderer/components/brainShell/BrainShell';

let ipcOnHandlers = {};
const ipcInvoke = jest.fn().mockResolvedValue({ ok: true });

beforeEach(() => {
  ipcOnHandlers = {};
  triggerBus._resetForTests();
  ipcInvoke.mockClear();
  window.electron = {
    ipcRenderer: {
      on: (channel, cb) => {
        ipcOnHandlers[channel] = cb;
      },
      removeListener: (channel) => {
        delete ipcOnHandlers[channel];
      },
      invoke: ipcInvoke,
    },
  };
});

afterEach(() => {
  delete window.electron;
});

function LocationProbe({ onChange }) {
  const location = useLocation();
  React.useEffect(() => {
    onChange(location.pathname);
  }, [location.pathname, onChange]);
  return null;
}

test('Phase 7 multi-surface-flow → Orb → top strip → navigate → done → idle', async () => {
  const seen = [];
  render(
    <MemoryRouter initialEntries={['/']}>
      <LocationProbe onChange={(p) => seen.push(p)} />
      <BrainShell>
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="/reading/1" element={<div>book one</div>} />
          <Route path="/reading/2" element={<div>book two</div>} />
        </Routes>
      </BrainShell>
    </MemoryRouter>,
  );

  // 1. Initially idle.
  expect(screen.getByLabelText(/Brain — idle/)).toBeInTheDocument();

  // 2. Main emits a Phase 7 multi-surface-flow Trigger.
  act(() => {
    ipcOnHandlers['brain:trigger:push'](null, {
      id: 'phase7:learn-german',
      source: 'phase-7-learning-path',
      unit: 'multi-surface-flow',
      surfaceTarget: {
        kind: 'flow',
        steps: [
          { view: 'reading/1', payload: { label: 'Foundations' } },
          { view: 'reading/2', payload: { label: 'Advanced' } },
        ],
      },
      priority: 'high',
      freshness: 24 * 60 * 60 * 1000,
      emittedAt: Date.now(),
      payload: {
        title: 'Path: Learn German B2',
        goal: 'Reach B2',
        summary: 'Two-book path',
        steps: [
          { view: 'reading/1', payload: { label: 'Foundations' } },
          { view: 'reading/2', payload: { label: 'Advanced' } },
        ],
      },
    });
  });

  // 3. Orb reflects has-proposal.
  expect(screen.getByLabelText(/Brain — has-proposal/)).toBeInTheDocument();

  // 4. Click the orb to accept top of queue.
  await act(async () => {
    fireEvent.click(screen.getByLabelText(/Brain — has-proposal/));
  });

  expect(ipcInvoke).toHaveBeenCalledWith(
    'brain:trigger:accept',
    expect.objectContaining({
      proposalId: 'phase7:learn-german',
      source: 'phase-7-learning-path',
    }),
  );

  // 5. Top strip renders with the flow name + step 1 of 2 + navigation
  //    has fired to step 1's view.
  await waitFor(() =>
    expect(screen.getByText('Path: Learn German B2')).toBeInTheDocument(),
  );
  expect(screen.getByText(/step 1 of 2/)).toBeInTheDocument();
  expect(seen).toContain('/reading/1');

  // 6. Orb shifts to mid-flow.
  expect(screen.getByLabelText(/Brain — mid-flow/)).toBeInTheDocument();

  // 7. Next advances to step 2 + navigates.
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
  });
  await waitFor(() =>
    expect(screen.getByText(/step 2 of 2/)).toBeInTheDocument(),
  );
  expect(seen).toContain('/reading/2');

  // 8. Final step shows Done; clicking returns the Orb to idle.
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
  });
  await waitFor(() =>
    expect(screen.getByLabelText(/Brain — idle/)).toBeInTheDocument(),
  );
  // Top strip is gone now that the flow completed.
  expect(screen.queryByText('Path: Learn German B2')).toBeNull();
});

test('Phase 7 flow Abort returns Orb to idle and dismisses the proposal', async () => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <BrainShell>
        <Routes>
          <Route path="/" element={<div>home</div>} />
          <Route path="/reading/1" element={<div>book one</div>} />
        </Routes>
      </BrainShell>
    </MemoryRouter>,
  );

  act(() => {
    ipcOnHandlers['brain:trigger:push'](null, {
      id: 'phase7:test-abort',
      source: 'phase-7-learning-path',
      unit: 'multi-surface-flow',
      surfaceTarget: {
        kind: 'flow',
        steps: [{ view: 'reading/1' }],
      },
      priority: 'high',
      freshness: 60_000,
      emittedAt: Date.now(),
      payload: {
        title: 'X',
        steps: [{ view: 'reading/1' }],
      },
    });
  });

  await act(async () => {
    fireEvent.click(screen.getByLabelText(/Brain — has-proposal/));
  });
  await waitFor(() => expect(screen.getByText('X')).toBeInTheDocument());

  await act(async () => {
    fireEvent.click(screen.getByLabelText('abort'));
  });

  expect(ipcInvoke).toHaveBeenCalledWith(
    'brain:trigger:dismiss',
    expect.objectContaining({
      proposalId: 'phase7:test-abort',
      source: 'phase-7-learning-path',
    }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText(/Brain — idle/)).toBeInTheDocument(),
  );
});
