import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const fakeApi = {
  dashboard: jest.fn().mockResolvedValue({
    mastery: [{ domain: 'vocabulary', box: 1, count: 5 }],
    timeline: [{ day: '2026-06-15', intentClass: 'director', count: 3, cost: 0.003 }],
    sessions: [{ id: 'sess-1', goal: 'Review', startedAt: 1000, iteration: 2, budget: 12, status: 'completed', totalCost: 0.001, firstTouchedConceptId: 7 }],
    topConcepts: [{ id: 7, title: 'parse', domain: 'vocabulary', decisionCount: 2, box: 1, masteryPct: 30 }],
  }),
};
jest.mock('../../../renderer/api/brainVisibilityApi', () => ({ __esModule: true, default: fakeApi }));

import BrainActivityDashboard from '../../../renderer/views/brainVisibility/BrainActivityDashboard';

beforeEach(() => {
  fakeApi.dashboard.mockClear();
});

test('fetches dashboard on mount with default 30d window', async () => {
  render(<BrainActivityDashboard onConceptClick={jest.fn()} />);
  await waitFor(() => expect(fakeApi.dashboard).toHaveBeenCalledWith({ window: '30d' }));
});

test('window toggle re-fetches', async () => {
  render(<BrainActivityDashboard onConceptClick={jest.fn()} />);
  await waitFor(() => expect(fakeApi.dashboard).toHaveBeenCalledWith({ window: '30d' }));
  fireEvent.click(screen.getByRole('button', { name: /7d/i }));
  await waitFor(() => expect(fakeApi.dashboard).toHaveBeenCalledWith({ window: '7d' }));
});

test('clicking a session row calls onConceptClick with firstTouchedConceptId', async () => {
  const onConceptClick = jest.fn();
  render(<BrainActivityDashboard onConceptClick={onConceptClick} />);
  await screen.findByText(/Review/);
  fireEvent.click(screen.getByText(/Review/));
  expect(onConceptClick).toHaveBeenCalledWith(7);
});

test('clicking a concept row calls onConceptClick with concept id', async () => {
  const onConceptClick = jest.fn();
  render(<BrainActivityDashboard onConceptClick={onConceptClick} />);
  await screen.findByText(/parse/);
  fireEvent.click(screen.getByText(/parse/));
  expect(onConceptClick).toHaveBeenCalledWith(7);
});
