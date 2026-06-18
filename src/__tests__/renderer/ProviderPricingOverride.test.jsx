import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

// Mock aiPricingApi before importing the component.
const mockDefaults = {
  chatgpt: { input: 2.50, output: 10.00 },
  deepseek: { input: 0.27, output: 1.10 },
};
const mockGet = jest.fn().mockResolvedValue({});
const mockSet = jest.fn().mockResolvedValue({});
const mockDefaultsFn = jest.fn().mockResolvedValue(mockDefaults);

jest.mock('../../renderer/api/aiPricingApi', () => ({
  __esModule: true,
  default: {
    get: (...args) => mockGet(...args),
    set: (...args) => mockSet(...args),
    defaults: (...args) => mockDefaultsFn(...args),
  },
}));

import ProviderPricingOverride from '../../renderer/views/settings/ProviderPricingOverride';

beforeEach(() => {
  mockGet.mockResolvedValue({});
  mockSet.mockResolvedValue({});
  mockDefaultsFn.mockResolvedValue(mockDefaults);
  jest.clearAllMocks();
  // Restore after clear
  mockGet.mockResolvedValue({});
  mockSet.mockResolvedValue({});
  mockDefaultsFn.mockResolvedValue(mockDefaults);
});

describe('ProviderPricingOverride', () => {
  test('renders the Pricing accordion', async () => {
    render(<ProviderPricingOverride providerKey="chatgpt" label="OpenAI ChatGPT" />);
    await waitFor(() =>
      expect(screen.getByText(/Pricing/i)).toBeInTheDocument()
    );
  });

  test('shows effective rate from defaults in the accordion summary', async () => {
    render(<ProviderPricingOverride providerKey="chatgpt" label="OpenAI ChatGPT" />);
    // The rate appears in both the summary line and the expanded detail footer;
    // use getAllByText to tolerate multiple matches.
    await waitFor(() => {
      const matches = screen.getAllByText(/\$2\.50 in \/ \$10\.00 out per 1M tokens/i);
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  test('does not show override Chip when no override is set', async () => {
    render(<ProviderPricingOverride providerKey="chatgpt" label="OpenAI ChatGPT" />);
    await waitFor(() =>
      expect(screen.getByText(/Pricing/i)).toBeInTheDocument()
    );
    expect(screen.queryByText('override')).not.toBeInTheDocument();
  });

  test('shows override Chip when override is already set', async () => {
    mockGet.mockResolvedValue({ chatgpt: { input: 1.00, output: 4.00 } });
    render(<ProviderPricingOverride providerKey="chatgpt" label="OpenAI ChatGPT" />);
    await waitFor(() =>
      expect(screen.getByText('override')).toBeInTheDocument()
    );
  });

  test('Save button calls aiPricingApi.set with parsed numbers', async () => {
    mockSet.mockResolvedValue({ chatgpt: { input: 1.50, output: 6.00 } });
    render(<ProviderPricingOverride providerKey="chatgpt" label="OpenAI ChatGPT" />);
    // Open the accordion
    await waitFor(() =>
      expect(screen.getByText(/Pricing/i)).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText(/Pricing/i));

    // Find inputs by label
    await waitFor(() =>
      expect(screen.getByLabelText(/Input \$\/MTok/i)).toBeInTheDocument()
    );

    const inputField = screen.getByLabelText(/Input \$\/MTok/i);
    const outputField = screen.getByLabelText(/Output \$\/MTok/i);

    fireEvent.change(inputField, { target: { value: '1.50' } });
    fireEvent.change(outputField, { target: { value: '6.00' } });

    const saveBtn = screen.getByRole('button', { name: /Save override/i });
    fireEvent.click(saveBtn);

    await waitFor(() =>
      expect(mockSet).toHaveBeenCalledWith({
        providerKey: 'chatgpt',
        input: 1.5,
        output: 6.0,
      })
    );
  });

  test('Reset button calls aiPricingApi.set with null values', async () => {
    mockGet.mockResolvedValue({ chatgpt: { input: 1.00, output: 4.00 } });
    mockSet.mockResolvedValue({});
    render(<ProviderPricingOverride providerKey="chatgpt" label="OpenAI ChatGPT" />);

    await waitFor(() =>
      expect(screen.getByText('override')).toBeInTheDocument()
    );

    // Open the accordion
    fireEvent.click(screen.getByText(/Pricing/i));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Reset to default/i })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /Reset to default/i }));

    await waitFor(() =>
      expect(mockSet).toHaveBeenCalledWith({
        providerKey: 'chatgpt',
        input: null,
        output: null,
      })
    );
  });
});
