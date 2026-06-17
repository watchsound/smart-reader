import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

// Mock brainVisibilityApi before importing the component
const fakeVisibilityApi = {
  dashboard: jest.fn().mockResolvedValue({
    mastery: [],
    timeline: [],
    sessions: [],
    topConcepts: [],
  }),
  concept: jest.fn().mockResolvedValue(null),
};

jest.mock('../../../renderer/api/brainVisibilityApi', () => ({
  __esModule: true,
  default: fakeVisibilityApi,
}));

// Mock callLedgerApi so EconomicsPanel can mount without crashing
jest.mock('../../../renderer/api/callLedgerApi', () => ({
  __esModule: true,
  default: {
    aggregateByIntent: jest.fn().mockResolvedValue([]),
    aggregateByProvider: jest.fn().mockResolvedValue([]),
    cacheHitRateByIntent: jest.fn().mockResolvedValue({}),
    listSessionTraces: jest.fn().mockResolvedValue([]),
  },
}));

// Mock triggerBus (used by BrainDashboardPanel overview + BrainShell)
jest.mock('../../../renderer/brain/triggerBus', () => ({
  __esModule: true,
  default: {
    accept: jest.fn(),
    dismiss: jest.fn(),
    pull: jest.fn().mockResolvedValue(null),
    subscribe: jest.fn(() => () => {}),
    _resetForTests: jest.fn(),
  },
}));

// Mock useBrainState so the panel renders without Redux
jest.mock('../../../renderer/brain/useBrainState', () => ({
  __esModule: true,
  default: () => ({ orbState: 'idle', queue: [], activeProposal: null }),
}));

// Mock child sub-strip components so BrainActivityDashboard doesn't need
// canvas/chart dependencies in the test environment
jest.mock('../../../renderer/views/brainVisibility/MasterySnapshotStrip', () => ({
  __esModule: true,
  default: () => <div>Mastery Snapshot</div>,
}));
jest.mock('../../../renderer/views/brainVisibility/BrainActivityTimelineStrip', () => ({
  __esModule: true,
  default: () => <div>Activity Timeline</div>,
}));
jest.mock('../../../renderer/views/brainVisibility/RecentSessionsTable', () => ({
  __esModule: true,
  default: () => <div>Recent Sessions</div>,
}));
jest.mock('../../../renderer/views/brainVisibility/TopTouchedConceptsTable', () => ({
  __esModule: true,
  default: () => <div>Top Concepts</div>,
}));

// Import after mocks
// eslint-disable-next-line import/first
import BrainDashboardPanel from '../../../renderer/components/brainShell/BrainDashboardPanel';

beforeEach(() => {
  jest.clearAllMocks();
  fakeVisibilityApi.dashboard.mockResolvedValue({
    mastery: [],
    timeline: [],
    sessions: [],
    topConcepts: [],
  });
});

test('Visibility tab renders without crashing', async () => {
  render(
    <MemoryRouter>
      <BrainDashboardPanel />
    </MemoryRouter>,
  );

  // The Visibility tab should be present
  const tab = screen.queryByRole('tab', { name: /visibility/i });
  expect(tab).not.toBeNull();

  // Click it
  fireEvent.click(tab);

  // BrainActivityDashboard renders a Loading state initially, then the mocked strips
  await screen.findByText(/Mastery Snapshot|Loading/i);
});

test('Visibility tab calls brainVisibilityApi.dashboard on mount', async () => {
  render(
    <MemoryRouter>
      <BrainDashboardPanel />
    </MemoryRouter>,
  );

  const tab = screen.getByRole('tab', { name: /visibility/i });
  fireEvent.click(tab);

  // After clicking, BrainActivityDashboard mounts and calls dashboard()
  await screen.findByText(/Mastery Snapshot/i);
  expect(fakeVisibilityApi.dashboard).toHaveBeenCalledWith(
    expect.objectContaining({ window: '30d' }),
  );
});

test('Overview, Trigger Log, and Economics tabs are also present', () => {
  render(
    <MemoryRouter>
      <BrainDashboardPanel />
    </MemoryRouter>,
  );

  expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /trigger log/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /economics/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /visibility/i })).toBeInTheDocument();
});
