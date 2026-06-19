/**
 * HealthTab renders Phase 15b anomaly cards driven by anomalyApi. These
 * tests pin: loading state, empty-list narration, severity + kind chip
 * rendering, kind-specific title strings, the Re-scan / Acknowledge wire,
 * and that action-button clicks navigate where the audit promises.
 */

import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../../../renderer/api/anomalyApi', () => ({
  __esModule: true,
  default: {
    list: jest.fn(),
    rescan: jest.fn(),
    acknowledge: jest.fn(),
  },
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const anomalyApi = require('../../../renderer/api/anomalyApi').default;
const HealthTab = require('../../../renderer/components/brainShell/health/HealthTab').default;

function wrap(node) {
  return <MemoryRouter>{node}</MemoryRouter>;
}

beforeEach(() => {
  anomalyApi.list.mockReset();
  anomalyApi.rescan.mockReset();
  anomalyApi.acknowledge.mockReset();
  mockNavigate.mockReset();
});

describe('HealthTab', () => {
  test('shows loading state before the first list resolves', () => {
    // Never-resolving promise so the loading branch stays visible.
    anomalyApi.list.mockReturnValue(new Promise(() => {}));
    render(wrap(<HealthTab />));
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  test('renders "all systems normal" when no anomalies', async () => {
    anomalyApi.list.mockResolvedValue([]);
    render(wrap(<HealthTab />));
    await waitFor(() => {
      expect(screen.getByText(/all systems normal/i)).toBeInTheDocument();
    });
    expect(
      screen.getByText(/no anomalies detected over the last 7 days/i),
    ).toBeInTheDocument();
  });

  test('renders one card per anomaly with severity + kind chips', async () => {
    anomalyApi.list.mockResolvedValue([
      {
        id: 'a1',
        kind: 'mastery-regression',
        key: 'lp-foo',
        severity: 'high',
        sinceTs: Date.now() - 3600_000,
        lastSeenTs: Date.now() - 60_000,
        evidence: { title: 'foo', drop: 12.3, learningPointId: 'lp-foo' },
      },
      {
        id: 'a2',
        kind: 'zero-roi-spend',
        key: 'translate',
        severity: 'medium',
        sinceTs: Date.now() - 7200_000,
        lastSeenTs: Date.now() - 600_000,
        evidence: { intent: 'translate', windowCostUsd: 0.05 },
      },
    ]);

    render(wrap(<HealthTab />));
    await waitFor(() => {
      expect(screen.getByText(/2 anomalies/i)).toBeInTheDocument();
    });
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
    expect(screen.getByText('mastery-regression')).toBeInTheDocument();
    expect(screen.getByText('zero-roi-spend')).toBeInTheDocument();
  });

  test('mastery-regression title shows the drop magnitude', async () => {
    anomalyApi.list.mockResolvedValue([
      {
        id: 'a',
        kind: 'mastery-regression',
        key: 'lp-x',
        severity: 'high',
        evidence: { title: 'X', drop: 14, learningPointId: 'lp-x' },
      },
    ]);
    render(wrap(<HealthTab />));
    await waitFor(() => {
      expect(screen.getByText(/X: mastery dropped 14/i)).toBeInTheDocument();
    });
  });

  test('provider-error-spike title shows the rate + call counts', async () => {
    anomalyApi.list.mockResolvedValue([
      {
        id: 'a',
        kind: 'provider-error-spike',
        key: 'deepseek',
        severity: 'medium',
        evidence: { provider: 'deepseek', errorRate: 0.42, errorCalls: 21, totalCalls: 50 },
      },
    ]);
    render(wrap(<HealthTab />));
    await waitFor(() => {
      expect(
        screen.getByText(/deepseek: 42% error rate \(21\/50 calls\)/i),
      ).toBeInTheDocument();
    });
  });

  test('Inspect navigates to /?inspect=<learningPointId>', async () => {
    anomalyApi.list.mockResolvedValue([
      {
        id: 'a',
        kind: 'mastery-regression',
        key: 'lp-x',
        severity: 'high',
        evidence: { title: 'X', drop: 5, learningPointId: 'lp-target' },
      },
    ]);
    render(wrap(<HealthTab />));
    const btn = await screen.findByRole('button', { name: /inspect/i });
    fireEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith('/?inspect=lp-target');
  });

  test('zero-roi-spend View ROI button routes to economics tab', async () => {
    anomalyApi.list.mockResolvedValue([
      {
        id: 'a',
        kind: 'zero-roi-spend',
        key: 'translate',
        severity: 'medium',
        evidence: { intent: 'translate', windowCostUsd: 0.05 },
      },
    ]);
    render(wrap(<HealthTab />));
    const btn = await screen.findByRole('button', { name: /view roi/i });
    fireEvent.click(btn);
    expect(mockNavigate).toHaveBeenCalledWith('/?tab=economics');
  });

  test('Re-scan calls anomalyApi.rescan and re-fetches the list', async () => {
    anomalyApi.list.mockResolvedValueOnce([]);
    anomalyApi.rescan.mockResolvedValue();
    anomalyApi.list.mockResolvedValueOnce([
      { id: 'a', kind: 'stalled-quest-concept', key: 'k', severity: 'low', evidence: {} },
    ]);

    render(wrap(<HealthTab />));
    await waitFor(() => expect(anomalyApi.list).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /re-scan/i }));
    await waitFor(() => expect(anomalyApi.rescan).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(anomalyApi.list).toHaveBeenCalledTimes(2));
  });

  test('Acknowledge calls anomalyApi.acknowledge(id) and reloads', async () => {
    anomalyApi.list.mockResolvedValueOnce([
      {
        id: 'a-ack',
        kind: 'mastery-regression',
        key: 'lp',
        severity: 'low',
        evidence: { title: 'lp', drop: 3, learningPointId: 'lp' },
      },
    ]);
    anomalyApi.acknowledge.mockResolvedValue();
    anomalyApi.list.mockResolvedValueOnce([]);

    render(wrap(<HealthTab />));
    const ackBtn = await screen.findByRole('button', { name: /acknowledge/i });
    fireEvent.click(ackBtn);
    await waitFor(() => {
      expect(anomalyApi.acknowledge).toHaveBeenCalledWith('a-ack');
    });
    await waitFor(() => expect(anomalyApi.list).toHaveBeenCalledTimes(2));
  });

  test('list failure surfaces the error caption', async () => {
    anomalyApi.list.mockRejectedValue(new Error('ipc down'));
    render(wrap(<HealthTab />));
    await waitFor(() => {
      expect(screen.getByText(/ipc down/i)).toBeInTheDocument();
    });
  });
});
