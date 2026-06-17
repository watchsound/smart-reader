import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import MasterySparkline from '../../../renderer/views/brainVisibility/MasterySparkline';
import MasteryTrajectoryStrip from '../../../renderer/views/brainVisibility/MasteryTrajectoryStrip';

test('MasterySparkline renders an SVG with N polyline points for N events', () => {
  const series = [
    { ts: 1000, box: 1, mastery: 25, eventType: 'imported', source: 'backfill' },
    { ts: 2000, box: 1, mastery: 40, eventType: 'mastery_change', source: 'user-review' },
    { ts: 3000, box: 2, mastery: 55, eventType: 'mastery_change', source: 'production-grade' },
  ];
  const { container } = render(<MasterySparkline series={series} />);
  const polyline = container.querySelector('polyline');
  expect(polyline).toBeInTheDocument();
  expect(polyline.getAttribute('points').split(' ').length).toBe(3);
});

test('MasterySparkline renders empty state for empty series', () => {
  render(<MasterySparkline series={[]} />);
  expect(screen.getByText(/no history/i)).toBeInTheDocument();
});

test('MasteryTrajectoryStrip groups by domain into one line each', () => {
  const data = [
    { day: '2026-06-15', domain: 'vocabulary', avgMastery: 30, eventCount: 2 },
    { day: '2026-06-16', domain: 'vocabulary', avgMastery: 45, eventCount: 1 },
    { day: '2026-06-15', domain: 'concept', avgMastery: 60, eventCount: 1 },
  ];
  const { container } = render(<MasteryTrajectoryStrip data={data} />);
  expect(screen.getByText(/vocabulary/i)).toBeInTheDocument();
  expect(screen.getByText(/concept/i)).toBeInTheDocument();
  expect(container.querySelectorAll('polyline').length).toBe(2);
});
