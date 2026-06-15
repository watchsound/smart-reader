/**
 * Inline Sequence Flow Unit end-to-end integration test.
 *
 * No real Brain service emits inline-sequence Triggers today (the closest
 * candidate, Phase 6 comprehension, stays in-context — see CONTEXT.md
 * "Phase 4/5/6 in-context exception"). This test uses a synthetic Trigger
 * to prove the Flow Unit's Orb-flow loop works end-to-end, so a future
 * trigger source can rely on the host being load-bearing.
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
import { MemoryRouter } from 'react-router-dom';
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

test('inline-sequence: Orb blooms → click → step 1 → Next → step 2 → Done → idle', async () => {
  render(
    <MemoryRouter>
      <BrainShell>
        <div>reader</div>
      </BrainShell>
    </MemoryRouter>,
  );

  expect(screen.getByLabelText(/Brain — idle/)).toBeInTheDocument();

  act(() => {
    ipcOnHandlers['brain:trigger:push'](null, {
      id: 'seq:demo',
      source: 'synthetic-inline-sequence',
      unit: 'inline-sequence',
      surfaceTarget: { kind: 'view', view: 'reader' },
      priority: 'normal',
      freshness: 60_000,
      emittedAt: Date.now(),
      payload: {
        title: 'Comprehension check',
        steps: [
          { title: 'Question 1', body: 'What is X?' },
          { title: 'Question 2', body: 'How does Y work?' },
        ],
      },
    });
  });

  expect(screen.getByLabelText(/Brain — has-proposal/)).toBeInTheDocument();

  await act(async () => {
    fireEvent.click(screen.getByLabelText(/Brain — has-proposal/));
  });

  expect(ipcInvoke).toHaveBeenCalledWith(
    'brain:trigger:accept',
    expect.objectContaining({
      proposalId: 'seq:demo',
      source: 'synthetic-inline-sequence',
    }),
  );

  // First step visible.
  await waitFor(() =>
    expect(screen.getByText('Question 1')).toBeInTheDocument(),
  );
  expect(screen.getByText(/step 1 of 2/)).toBeInTheDocument();
  expect(screen.getByLabelText(/Brain — mid-flow/)).toBeInTheDocument();

  // Advance to step 2.
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
  });
  await waitFor(() =>
    expect(screen.getByText('Question 2')).toBeInTheDocument(),
  );
  expect(screen.getByText(/step 2 of 2/)).toBeInTheDocument();

  // Done at last step closes the sequence.
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
  });
  await waitFor(() =>
    expect(screen.getByLabelText(/Brain — idle/)).toBeInTheDocument(),
  );
  expect(screen.queryByText('Question 2')).toBeNull();
});

test('inline-sequence Abort dismisses + returns Orb to idle', async () => {
  render(
    <MemoryRouter>
      <BrainShell>
        <div>reader</div>
      </BrainShell>
    </MemoryRouter>,
  );

  act(() => {
    ipcOnHandlers['brain:trigger:push'](null, {
      id: 'seq:abort',
      source: 'synthetic-inline-sequence',
      unit: 'inline-sequence',
      surfaceTarget: { kind: 'view', view: 'reader' },
      priority: 'normal',
      freshness: 60_000,
      emittedAt: Date.now(),
      payload: {
        title: 'Demo',
        steps: [{ title: 'Only step' }],
      },
    });
  });

  await act(async () => {
    fireEvent.click(screen.getByLabelText(/Brain — has-proposal/));
  });
  await waitFor(() =>
    expect(screen.getByText('Only step')).toBeInTheDocument(),
  );

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /abort/i }));
  });
  expect(ipcInvoke).toHaveBeenCalledWith(
    'brain:trigger:dismiss',
    expect.objectContaining({
      proposalId: 'seq:abort',
      source: 'synthetic-inline-sequence',
    }),
  );
  await waitFor(() =>
    expect(screen.getByLabelText(/Brain — idle/)).toBeInTheDocument(),
  );
});
