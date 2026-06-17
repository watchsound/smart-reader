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
  },
}));

import EconomicsPanel from '../../renderer/components/brainShell/EconomicsPanel';

describe('EconomicsPanel', () => {
  test('renders intent + provider tables and projected monthly cost', async () => {
    render(<EconomicsPanel />);
    await waitFor(() => expect(screen.getByText('propose-microcard')).toBeInTheDocument());
    expect(screen.getByText('grade-comprehension')).toBeInTheDocument();
    expect(screen.getByText('deepseek-v3')).toBeInTheDocument();
    expect(screen.getByText(/Projected\/mo:/)).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });
});
