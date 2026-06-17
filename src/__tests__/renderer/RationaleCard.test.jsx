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
  },
}));

import RationaleCard from '../../renderer/components/brainShell/RationaleCard';

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
});
