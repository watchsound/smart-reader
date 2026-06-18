import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('../../renderer/api/callLedgerApi', () => ({
  __esModule: true,
  default: {
    aggregateByProvider: jest.fn().mockResolvedValue([
      { key: 'deepseek-v3', call_count: 10, total_cost_usd: 0.12, cache_hits: 2 },
      { key: 'claude',      call_count:  5, total_cost_usd: 0.08, cache_hits: 0 },
    ]),
  },
}));

jest.mock('../../renderer/api/aiPricingApi', () => ({
  __esModule: true,
  default: {
    defaults: jest.fn().mockResolvedValue({
      'deepseek-v3': { input: 0.27, output: 1.10 },
      claude:        { input: 3.00, output: 15.00 },
    }),
    get: jest.fn().mockResolvedValue({}),
  },
}));

import ProviderSpendStats from '../../renderer/views/settings/ProviderSpendStats';

describe('ProviderSpendStats', () => {
  test('renders a stat box per provider', async () => {
    render(<ProviderSpendStats />);
    // textTransform:uppercase is CSS-only; DOM text stays lowercase
    await waitFor(() => expect(screen.getByText('deepseek-v3')).toBeInTheDocument());
    expect(screen.getByText('claude')).toBeInTheDocument();
  });

  test('shows cost and call count for each provider', async () => {
    render(<ProviderSpendStats />);
    await waitFor(() => expect(screen.getByText('$0.12')).toBeInTheDocument());
    expect(screen.getByText('$0.08')).toBeInTheDocument();
    // deepseek: 10 calls
    expect(screen.getByText(/10 calls/)).toBeInTheDocument();
  });

  test('shows empty-state placeholder when no calls', async () => {
    const callLedgerApi = require('../../renderer/api/callLedgerApi').default;
    callLedgerApi.aggregateByProvider.mockResolvedValueOnce([]);
    render(<ProviderSpendStats />);
    await waitFor(() =>
      expect(
        screen.getByText(/No LLM calls yet this month/i)
      ).toBeInTheDocument()
    );
  });

  test('filters out providers with zero call_count', async () => {
    const callLedgerApi = require('../../renderer/api/callLedgerApi').default;
    callLedgerApi.aggregateByProvider.mockResolvedValueOnce([
      { key: 'deepseek-v3', call_count: 5,  total_cost_usd: 0.05, cache_hits: 0 },
      { key: 'ollama',      call_count: 0,  total_cost_usd: 0,    cache_hits: 0 },
    ]);
    render(<ProviderSpendStats />);
    await waitFor(() => expect(screen.getByText('deepseek-v3')).toBeInTheDocument());
    expect(screen.queryByText('ollama')).not.toBeInTheDocument();
  });
});
