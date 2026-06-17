import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const sampleTrace = [
  { kind: 'thought', iteration: 0, payload: { reasoning: 'start' } },
  { kind: 'soft-write', iteration: 1, payload: { tool: 'scheduleReread', args: { chapterId: 'ch-3' } } },
  { kind: 'soft-write', iteration: 2, payload: { tool: 'createMicroCard', args: {} } },
  { kind: 'end', iteration: 5, payload: { reason: 'done' } },
];
const fakeApi = { getTrace: jest.fn().mockResolvedValue(sampleTrace) };
jest.mock('../../../renderer/api/sessionApi', () => ({ __esModule: true, default: fakeApi }));
import SessionSummaryView from '../../../renderer/views/aiSession/SessionSummaryView';

test('shows goal + soft-write list + end reason', async () => {
  render(
    <MemoryRouter initialEntries={['/ai-session/s1/summary']}>
      <Routes><Route path="/ai-session/:id/summary" element={<SessionSummaryView />} /></Routes>
    </MemoryRouter>
  );
  await screen.findByText(/Session complete/i);
  expect(screen.getByText(/scheduleReread/)).toBeInTheDocument();
  expect(screen.getByText(/createMicroCard/)).toBeInTheDocument();
  expect(screen.getByText(/done/i)).toBeInTheDocument();
});
