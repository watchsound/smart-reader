import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import GroupDetailDrawer from '../../renderer/components/brainShell/spendReturns/GroupDetailDrawer';

const mockGroupDetail = jest.fn();
jest.mock('../../renderer/api/callLedgerApi', () => ({
  __esModule: true,
  default: {
    attributionGroupDetail: (...args) => mockGroupDetail(...args),
  },
}));

describe('GroupDetailDrawer', () => {
  beforeEach(() => { mockGroupDetail.mockReset(); });

  it('fetches group detail when opened with a groupKey', async () => {
    mockGroupDetail.mockResolvedValue({
      group: { key: 'director-session', label: 'Director', eventCount: 2, totalCostUsd: 0.02 },
      events: [
        { learningPointId: 'lp-a', ts: 1700000000000, featureSurface: 'director-session',
          proximateCallId: 42, intent: 'director-session-step', eventCostUsd: 0.012, amortized: false },
        { learningPointId: 'lp-b', ts: 1700000000000, featureSurface: 'director-session',
          proximateCallId: null, intent: null, eventCostUsd: 0.008, amortized: true },
      ],
    });

    render(
      <GroupDetailDrawer
        open={true}
        onClose={jest.fn()}
        lens="intent"
        groupKey="director-session-step"
        windowRange={{ from: 0, to: 9999 }}
        userId={1}
        onOpenRationale={jest.fn()}
      />,
    );

    await waitFor(() => screen.getByText(/lp-a/));
    expect(screen.getByText(/lp-b/)).toBeInTheDocument();
    expect(mockGroupDetail).toHaveBeenCalledWith(
      expect.objectContaining({ groupKey: 'director-session-step', lens: 'intent' }),
    );
  });

  it('amortized rows show AmortizedBadge label', async () => {
    mockGroupDetail.mockResolvedValue({
      group: { key: 'reading-microcard', label: 'Reading', eventCount: 1, totalCostUsd: 0.05 },
      events: [
        { learningPointId: 'lp-c', ts: 1700000000000, featureSurface: 'reading-microcard',
          proximateCallId: null, intent: null, eventCostUsd: 0.05, amortized: true },
      ],
    });
    render(
      <GroupDetailDrawer
        open={true} onClose={jest.fn()} lens="phase" groupKey="reading-loop"
        windowRange={{ from: 0, to: 9999 }} userId={1}
        onOpenRationale={jest.fn()}
      />,
    );
    await waitFor(() => screen.getByText(/lp-c/));
    expect(screen.getByText(/amortized/i)).toBeInTheDocument();
  });

  it('clicking a direct-attributed event fires onOpenRationale with the callId', async () => {
    const onOpenRationale = jest.fn();
    mockGroupDetail.mockResolvedValue({
      group: { key: 'director-session', label: 'Director', eventCount: 1, totalCostUsd: 0.012 },
      events: [
        { learningPointId: 'lp-a', ts: 1700000000000, featureSurface: 'director-session',
          proximateCallId: 42, intent: 'director-session-step', eventCostUsd: 0.012, amortized: false },
      ],
    });
    render(
      <GroupDetailDrawer
        open={true} onClose={jest.fn()} lens="intent" groupKey="director-session-step"
        windowRange={{ from: 0, to: 9999 }} userId={1}
        onOpenRationale={onOpenRationale}
      />,
    );
    await waitFor(() => screen.getByText(/lp-a/));
    // Click the event row
    fireEvent.click(screen.getByText(/lp-a/));
    expect(onOpenRationale).toHaveBeenCalledWith(42);
  });
});
