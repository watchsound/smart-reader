import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import MasterySnapshotStrip from '../../../renderer/views/brainVisibility/MasterySnapshotStrip';
import BrainActivityTimelineStrip from '../../../renderer/views/brainVisibility/BrainActivityTimelineStrip';
import RecentSessionsTable from '../../../renderer/views/brainVisibility/RecentSessionsTable';
import TopTouchedConceptsTable from '../../../renderer/views/brainVisibility/TopTouchedConceptsTable';

test('MasterySnapshotStrip renders bars for each domain×box', () => {
  render(<MasterySnapshotStrip data={[
    { domain: 'vocabulary', box: 1, count: 12 },
    { domain: 'vocabulary', box: 2, count: 5 },
    { domain: 'concept', box: 1, count: 3 },
  ]} />);
  expect(screen.getByText(/vocabulary/i)).toBeInTheDocument();
  expect(screen.getByText('12')).toBeInTheDocument();
});

test('BrainActivityTimelineStrip groups by day + intent class', () => {
  render(<BrainActivityTimelineStrip data={[
    { day: '2026-06-15', intentClass: 'director', count: 5, cost: 0.005 },
    { day: '2026-06-15', intentClass: 'legacy', count: 3, cost: 0.001 },
  ]} />);
  expect(screen.getByText(/2026-06-15/i)).toBeInTheDocument();
  expect(screen.getByText(/director/i)).toBeInTheDocument();
});

test('RecentSessionsTable rows are clickable', () => {
  const onRowClick = jest.fn();
  render(<RecentSessionsTable rows={[
    { id: 'sess-1', goal: 'Review weak', startedAt: 1000, iteration: 3, budget: 12, status: 'completed', totalCost: 0.002, firstTouchedConceptId: 42 },
  ]} onRowClick={onRowClick} />);
  fireEvent.click(screen.getByText(/Review weak/));
  expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'sess-1' }));
});

test('TopTouchedConceptsTable rows are clickable', () => {
  const onRowClick = jest.fn();
  render(<TopTouchedConceptsTable rows={[
    { id: 7, title: 'parse', domain: 'vocabulary', decisionCount: 5, box: 2, masteryPct: 40 },
  ]} onRowClick={onRowClick} />);
  fireEvent.click(screen.getByText(/parse/));
  expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }));
});
