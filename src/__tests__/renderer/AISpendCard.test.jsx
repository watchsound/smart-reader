import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../../renderer/api/callLedgerApi', () => ({
  __esModule: true,
  default: {
    aggregateByProvider: jest.fn().mockResolvedValue([
      { key: 'deepseek-v3', call_count: 10, total_cost_usd: 0.12, cache_hits: 2 },
      { key: 'claude',      call_count:  5, total_cost_usd: 0.08, cache_hits: 0 },
      { key: 'qwen',        call_count:  3, total_cost_usd: 0.04, cache_hits: 1 },
    ]),
  },
}));

import AISpendCard from '../../renderer/components/home/AISpendCard';

function Wrapper({ children }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('AISpendCard', () => {
  test('shows summed total cost as headline', async () => {
    render(<Wrapper><AISpendCard /></Wrapper>);
    // 0.12 + 0.08 + 0.04 = 0.24
    await waitFor(() => expect(screen.getByText('$0.24')).toBeInTheDocument());
  });

  test('shows /mo projected label', async () => {
    render(<Wrapper><AISpendCard /></Wrapper>);
    await waitFor(() =>
      expect(screen.getByText(/~\$0\.24\/mo projected/i)).toBeInTheDocument()
    );
  });

  test('empty data shows $0.00', async () => {
    const callLedgerApi = require('../../renderer/api/callLedgerApi').default;
    callLedgerApi.aggregateByProvider.mockResolvedValueOnce([]);
    render(<Wrapper><AISpendCard /></Wrapper>);
    await waitFor(() => expect(screen.getByText('$0.00')).toBeInTheDocument());
  });
});
