import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const fakeApi = {
  aggregateByIntent: jest.fn().mockResolvedValue([]),
  aggregateByProvider: jest.fn().mockResolvedValue([]),
  cacheHitRateByIntent: jest.fn().mockResolvedValue({}),
  listSessionTraces: jest.fn().mockResolvedValue([
    { traceId: 'sess-trace-001', startedAt: 1000, endedAt: 2000, callCount: 5, totalCost: 0.0042 },
  ]),
};

jest.mock('../../../renderer/api/callLedgerApi', () => ({
  __esModule: true,
  default: fakeApi,
}));

// EconomicsPanel uses MUI — no Router or Redux needed.
// eslint-disable-next-line import/first
import EconomicsPanel from '../../../renderer/components/brainShell/EconomicsPanel';

beforeEach(() => {
  jest.clearAllMocks();
  fakeApi.aggregateByIntent.mockResolvedValue([]);
  fakeApi.aggregateByProvider.mockResolvedValue([]);
  fakeApi.cacheHitRateByIntent.mockResolvedValue({});
  fakeApi.listSessionTraces.mockResolvedValue([
    { traceId: 'sess-trace-001', startedAt: 1000, endedAt: 2000, callCount: 5, totalCost: 0.0042 },
  ]);
});

test('renders By Session tab and shows session row after click', async () => {
  render(<EconomicsPanel />);

  // Wait for the initial data load to complete.
  await waitFor(() => expect(fakeApi.listSessionTraces).toHaveBeenCalledTimes(1));

  // Click the "By Session" tab.
  fireEvent.click(screen.getByRole('tab', { name: /by session/i }));

  // The traceId should appear truncated to 8 chars: "sess-tra".
  await screen.findByText(/sess-tra/);

  // The cost should be formatted with 4 decimal places.
  expect(screen.getByText(/0\.0042/)).toBeInTheDocument();

  // Call count should be visible.
  expect(screen.getByText('5')).toBeInTheDocument();
});

test('shows empty state when no sessions recorded', async () => {
  fakeApi.listSessionTraces.mockResolvedValue([]);

  render(<EconomicsPanel />);
  await waitFor(() => expect(fakeApi.listSessionTraces).toHaveBeenCalledTimes(1));

  fireEvent.click(screen.getByRole('tab', { name: /by session/i }));

  await screen.findByText(/no sessions recorded yet/i);
});

test('listSessionTraces is called on mount (before tab switch)', async () => {
  render(<EconomicsPanel />);
  await waitFor(() => expect(fakeApi.listSessionTraces).toHaveBeenCalledWith(20));
});
