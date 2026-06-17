import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

const fakeApi = {
  concept: jest.fn().mockResolvedValue({
    meta: { id: 7, title: 'parse', domain: 'vocabulary', box: 2, masteryPct: 40, nextReview: '2026-06-20', sourceType: 'book', sourceId: 'p-abc', createdAt: '2026-06-15' },
    lineage: [
      { kind: 'created', ts: 1000, sourceType: 'book', sourceId: 'p-abc' },
      { kind: 'brain-decision', ts: 2000, sessionId: 'sess-1', tool: 'openLeitnerCard', args: { learningPointId: 7 } },
    ],
    costToDate: 0.003,
    boxOverTime: null,
  }),
};
jest.mock('../../../renderer/api/brainVisibilityApi', () => ({ __esModule: true, default: fakeApi }));

import ConceptInspector from '../../../renderer/views/brainVisibility/ConceptInspector';

test('fetches concept on mount; renders header + lineage', async () => {
  render(<ConceptInspector learningPointId={7} onClose={jest.fn()} />);
  await waitFor(() => expect(fakeApi.concept).toHaveBeenCalledWith({ learningPointId: 7 }));
  await screen.findByText(/parse/);
  expect(screen.getByText(/box 2/i)).toBeInTheDocument();
  expect(screen.getByText(/openLeitnerCard/)).toBeInTheDocument();
  expect(screen.getByText(/0\.003/)).toBeInTheDocument();
});

test('null learningPointId: renders nothing', () => {
  const { container } = render(<ConceptInspector learningPointId={null} onClose={jest.fn()} />);
  expect(container.textContent).toBe('');
});

test('onClose fires when close button clicked', async () => {
  const onClose = jest.fn();
  render(<ConceptInspector learningPointId={7} onClose={onClose} />);
  await screen.findByText(/parse/);
  fireEvent.click(screen.getByRole('button', { name: /close|×/i }));
  expect(onClose).toHaveBeenCalled();
});
