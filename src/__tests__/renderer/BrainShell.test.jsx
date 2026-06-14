import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import triggerBus from '../../renderer/brain/triggerBus';
import BrainShell from '../../renderer/components/brainShell/BrainShell';

let ipcOnHandlers = {};

beforeEach(() => {
  ipcOnHandlers = {};
  triggerBus._resetForTests();
  window.electron = {
    ipcRenderer: {
      on: (channel, cb) => {
        ipcOnHandlers[channel] = cb;
      },
      removeListener: (channel) => {
        delete ipcOnHandlers[channel];
      },
      invoke: jest.fn().mockResolvedValue({ ok: true }),
    },
  };
});

afterEach(() => {
  delete window.electron;
});

describe('BrainShell', () => {
  test('renders Orb in idle state when no triggers', () => {
    render(
      <MemoryRouter>
        <BrainShell>
          <div>child content</div>
        </BrainShell>
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/Brain — idle/)).toBeInTheDocument();
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  test('renders manual menu button', () => {
    render(
      <MemoryRouter>
        <BrainShell>
          <div>child</div>
        </BrainShell>
      </MemoryRouter>,
    );
    expect(screen.getByLabelText(/manual route menu/i)).toBeInTheDocument();
  });

  test('updates Orb to has-proposal when trigger pushed', () => {
    render(
      <MemoryRouter>
        <BrainShell>
          <div>child</div>
        </BrainShell>
      </MemoryRouter>,
    );
    expect(typeof ipcOnHandlers['brain:trigger:push']).toBe('function');
    act(() => {
      ipcOnHandlers['brain:trigger:push'](null, {
        id: 't1',
        source: 'phase-4-micro-card',
        unit: 'atomic-chip',
        surfaceTarget: { kind: 'global' },
        priority: 'normal',
        freshness: 60_000,
        emittedAt: Date.now(),
        payload: { title: 'Pick this up' },
      });
    });
    expect(screen.getByLabelText(/Brain — has-proposal/)).toBeInTheDocument();
  });
});
