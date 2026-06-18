import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('../../renderer/api/callLedgerApi', () => ({
  __esModule: true,
  default: {
    aggregateByIntent:    jest.fn().mockResolvedValue([
      { key: 'propose-microcard',  call_count: 12, total_cost_usd: 0.0042, cache_hits: 5 },
      { key: 'grade-comprehension', call_count: 3,  total_cost_usd: 0.0018, cache_hits: 0 },
    ]),
    aggregateByProvider:  jest.fn().mockResolvedValue([
      { key: 'deepseek-v3', call_count: 15, total_cost_usd: 0.0060, cache_hits: 5 },
    ]),
    cacheHitRateByIntent: jest.fn().mockResolvedValue({
      'propose-microcard': 0.4,
      'grade-comprehension': 0,
    }),
    listSessionTraces: jest.fn().mockResolvedValue([]),
    attributionBars: jest.fn().mockResolvedValue([]),
    attributionDensityStrip: jest.fn().mockResolvedValue([]),
  },
}));

import EconomicsPanel from '../../renderer/components/brainShell/EconomicsPanel';

describe('EconomicsPanel', () => {
  test('renders intent + provider tables and projected monthly cost', async () => {
    render(<EconomicsPanel />);
    // Switch to intent tab since ROI is now default
    const intentTab = await screen.findByRole('tab', { name: /By Intent/i });
    intentTab.click();
    await waitFor(() => expect(screen.getByText('propose-microcard')).toBeInTheDocument());
    expect(screen.getByText('grade-comprehension')).toBeInTheDocument();
    expect(screen.queryByText('deepseek-v3')).not.toBeInTheDocument(); // hidden until provider tab selected
    expect(screen.getByText(/Projected\/mo:/)).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('EconomicsPanel shows ROI as the first tab and selects it by default', async () => {
    render(<EconomicsPanel />);
    const tabs = await screen.findAllByRole('tab');
    // The window-selector tabs (7d, 30d) appear first in the DOM; find the view tabs
    const roiTab = tabs.find((t) => /ROI/i.test(t.textContent));
    expect(roiTab).toBeTruthy();
    expect(roiTab.getAttribute('aria-selected')).toBe('true');
    // ROI must appear before By Intent in DOM order
    const intentTab = tabs.find((t) => /By Intent/i.test(t.textContent));
    expect(tabs.indexOf(roiTab)).toBeLessThan(tabs.indexOf(intentTab));
  });

  it('EconomicsPanel header shows "Spend & Returns" title', () => {
    render(<EconomicsPanel />);
    expect(screen.getByText(/Spend & Returns/i)).toBeInTheDocument();
  });
});
