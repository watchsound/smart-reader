import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import TriggerTelemetryPanel from '../../renderer/components/brainShell/TriggerTelemetryPanel';

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

describe('TriggerTelemetryPanel', () => {
  test('renders empty state when no telemetry exists', async () => {
    invokeFn.mockResolvedValue({ bySource: {} });
    render(<TriggerTelemetryPanel />);
    await waitFor(() =>
      expect(screen.getByText(/No telemetry yet/i)).toBeInTheDocument(),
    );
  });

  test('renders rows sorted by total events descending', async () => {
    invokeFn.mockResolvedValue({
      bySource: {
        'phase-7-learning-path': {
          accepted: 1,
          dismissed: 0,
          lastEvent: '2026-06-14T10:00:00Z',
          lastEventKind: 'accept',
        },
        'phase-8a-reread': {
          accepted: 4,
          dismissed: 6,
          lastEvent: '2026-06-14T11:00:00Z',
          lastEventKind: 'dismiss',
        },
        'phase-8c-production': {
          accepted: 2,
          dismissed: 1,
          lastEvent: '2026-06-14T09:00:00Z',
          lastEventKind: 'accept',
        },
      },
    });
    render(<TriggerTelemetryPanel />);
    await screen.findByText('phase-8a-reread');
    const rows = screen.getAllByRole('row');
    // First row is the header. Order in data rows must be 8a (10) → 8c (3) → 7 (1).
    expect(rows[1].textContent).toContain('phase-8a-reread');
    expect(rows[2].textContent).toContain('phase-8c-production');
    expect(rows[3].textContent).toContain('phase-7-learning-path');
  });

  test('refresh button re-invokes the IPC', async () => {
    invokeFn.mockResolvedValue({ bySource: {} });
    render(<TriggerTelemetryPanel />);
    await screen.findByText(/No telemetry yet/i);
    expect(invokeFn).toHaveBeenCalledTimes(1);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    });
    await waitFor(() => expect(invokeFn).toHaveBeenCalledTimes(2));
  });

  test('shows accept percentage', async () => {
    invokeFn.mockResolvedValue({
      bySource: {
        'phase-7-learning-path': {
          accepted: 3,
          dismissed: 1,
          lastEvent: '2026-06-14T10:00:00Z',
          lastEventKind: 'accept',
        },
      },
    });
    render(<TriggerTelemetryPanel />);
    await screen.findByText('phase-7-learning-path');
    // 3/(3+1) = 75%
    expect(screen.getByText('75%')).toBeInTheDocument();
  });
});
