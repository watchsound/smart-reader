import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import ROITab from '../../renderer/components/brainShell/spendReturns/ROITab';

jest.mock('../../renderer/api/callLedgerApi', () => ({
  __esModule: true,
  default: {
    attributionBars: jest.fn().mockResolvedValue([
      { groupKey: 'focused-session', groupLabel: 'Focused session',
        eventCount: 5, totalCostUsd: 0.05, costPerEvent: 0.01,
        directlyAttributedCount: 5, amortizedCount: 0 },
      { groupKey: 'while-reading', groupLabel: 'While reading',
        eventCount: 3, totalCostUsd: 0.06, costPerEvent: 0.02,
        directlyAttributedCount: 0, amortizedCount: 3 },
    ]),
    attributionDensityStrip: jest.fn().mockResolvedValue([]),
  },
}));

beforeEach(() => {
  // Reset localStorage so window state doesn't leak between tests
  if (typeof localStorage !== 'undefined') localStorage.clear();
});

describe('ROITab', () => {
  it('renders one row per bar with label and $/move headline', async () => {
    render(<ROITab />);
    await waitFor(() => screen.getByText('Focused session'));
    // The $0.01/move and $0.02/move headlines should appear
    expect(screen.getByText(/\$0?\.01.*\/.*move/i)).toBeInTheDocument();
    expect(screen.getByText(/\$0?\.02.*\/.*move/i)).toBeInTheDocument();
  });

  it('LensToggle switches the lens that gets fetched', async () => {
    const callLedgerApi = require('../../renderer/api/callLedgerApi').default;
    render(<ROITab />);
    await waitFor(() => expect(callLedgerApi.attributionBars).toHaveBeenCalled());
    // Initial: default lens is 'attention'
    expect(callLedgerApi.attributionBars.mock.calls[0][0].lens).toBe('attention');

    // Click Phase toggle
    const phaseBtn = screen.getByRole('button', { name: /Phase/i });
    phaseBtn.click();

    await waitFor(() =>
      expect(callLedgerApi.attributionBars).toHaveBeenCalledWith(
        expect.objectContaining({ lens: 'phase' }),
      ),
    );
  });
});
