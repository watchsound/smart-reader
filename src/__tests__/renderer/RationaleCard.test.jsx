import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('../../renderer/api/callLedgerApi', () => ({
  __esModule: true,
  default: {
    rationaleByTrigger: jest.fn().mockResolvedValue({
      intent: 'propose-microcard',
      provider: 'deepseek-v3',
      context_keys: ['currentBook', 'mastery'],
      cost_usd: 0.00014,
      cache_hit: false,
      output_summary: 'card: duration',
      output_json: { front: 'q', back: 'a' },
    }),
    tracesByCallId: jest.fn().mockResolvedValue([]),
  },
}));

import RationaleCard from '../../renderer/components/brainShell/RationaleCard';
import callLedgerApi from '../../renderer/api/callLedgerApi';

describe('RationaleCard', () => {
  test('renders nothing when no triggerId given', () => {
    const { container } = render(<RationaleCard />);
    expect(container.firstChild).toBeNull();
  });

  test('expands and shows intent + provider + cost on click', async () => {
    render(<RationaleCard triggerId="trig_42" />);
    fireEvent.click(screen.getByRole('button', { name: /toggle rationale/i }));
    await waitFor(() => expect(screen.getByText(/propose-microcard/)).toBeInTheDocument());
    expect(screen.getByText(/deepseek-v3/)).toBeInTheDocument();
    expect(screen.getByText(/\$0\.00014/)).toBeInTheDocument();
    expect(screen.getByText(/currentBook, mastery/)).toBeInTheDocument();
  });

  test('handles object output_json', async () => {
    render(<RationaleCard triggerId="trig_obj" />);
    fireEvent.click(screen.getByRole('button', { name: /toggle rationale/i }));
    await waitFor(() => expect(screen.getByText(/card: duration/)).toBeInTheDocument());
  });

  test('renders director trace when row has trace_id', async () => {
    callLedgerApi.rationaleByTrigger.mockResolvedValue({
      id: 5, intent: 'director-pull-suggestion', provider: 'deepseek-v3',
      context_keys: [], cost_usd: 0.0001, cache_hit: false,
      output_summary: 'step 3: answer', output_json: { title: 't' },
      trace_id: 'tr_abc',
    });
    callLedgerApi.tracesByCallId.mockResolvedValue([
      { id: 3, output_summary: 'step 1: tool=topUnmasteredConcepts' },
      { id: 4, output_summary: 'step 2: tool=recentEpisodeSummary' },
      { id: 5, output_summary: 'step 3: answer' },
    ]);
    render(<RationaleCard triggerId="trig_director" />);
    fireEvent.click(screen.getByRole('button', { name: /toggle rationale/i }));
    await waitFor(() => expect(screen.getByText(/Director trace/)).toBeInTheDocument());
    expect(screen.getByText(/Step 1:.*topUnmasteredConcepts/)).toBeInTheDocument();
  });
});
