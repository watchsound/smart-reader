/**
 * Phase 4 → BrainShell end-to-end integration test.
 *
 * Verifies the architectural proof of Plan 1:
 *   main emits Trigger → renderer TriggerBus enqueues → Orb blooms →
 *   user accepts → AtomicChipHost renders → dismiss → Orb idles.
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, act, fireEvent } from '@testing-library/react';
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

test('Phase 4 trigger → Orb blooms → user accepts → AtomicChipHost renders → dismiss → idle', async () => {
  render(
    <MemoryRouter>
      <BrainShell>
        <div data-testid="route-content">reading view</div>
      </BrainShell>
    </MemoryRouter>,
  );

  // 1. Initially idle.
  expect(screen.getByLabelText(/Brain — idle/)).toBeInTheDocument();

  // 2. Main emits Phase 4 micro-card Trigger.
  act(() => {
    ipcOnHandlers['brain:trigger:push'](null, {
      id: 'phase4:book-1:para-hash-1',
      source: 'phase-4-micro-card',
      unit: 'atomic-chip',
      surfaceTarget: { kind: 'global' },
      priority: 'normal',
      freshness: 5 * 60 * 1000,
      emittedAt: Date.now(),
      payload: {
        title: 'Acetylcholine',
        body: 'A neurotransmitter that mediates many functions...',
        proposalId: 'p-1',
        front: 'Acetylcholine',
        back: 'A neurotransmitter that mediates many functions...',
        domain: 'knowledge',
      },
    });
  });

  // 3. Orb reflects has-proposal.
  expect(screen.getByLabelText(/Brain — has-proposal/)).toBeInTheDocument();

  // 4. Click the orb to accept top of queue.
  await act(async () => {
    fireEvent.click(screen.getByLabelText(/Brain — has-proposal/));
  });

  // 5. IPC accept invoked with proposalId + source for telemetry.
  expect(ipcInvoke).toHaveBeenCalledWith(
    'brain:trigger:accept',
    expect.objectContaining({
      proposalId: 'phase4:book-1:para-hash-1',
      source: 'phase-4-micro-card',
    }),
  );

  // 6. AtomicChipHost is now rendered with the proposal payload.
  expect(screen.getByText('Acetylcholine')).toBeInTheDocument();

  // 7. Orb shifts to mid-flow.
  expect(screen.getByLabelText(/Brain — mid-flow/)).toBeInTheDocument();

  // 8. Dismiss the chip.
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
  });
  expect(ipcInvoke).toHaveBeenCalledWith(
    'brain:trigger:dismiss',
    expect.objectContaining({
      proposalId: 'phase4:book-1:para-hash-1',
      source: 'phase-4-micro-card',
    }),
  );

  // 9. Chip is gone; orb is back to idle.
  expect(screen.queryByText('Acetylcholine')).toBeNull();
  expect(screen.getByLabelText(/Brain — idle/)).toBeInTheDocument();
});
