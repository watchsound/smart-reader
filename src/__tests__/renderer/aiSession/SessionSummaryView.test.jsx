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
const fakeApi = { getTrace: jest.fn().mockResolvedValue({ traceId: 'tr-abcdef12', events: sampleTrace }) };
jest.mock('../../../renderer/api/sessionApi', () => ({ __esModule: true, default: fakeApi }));
import SessionSummaryView from '../../../renderer/views/aiSession/SessionSummaryView';

test('shows goal + soft-write list + end reason + traceId fragment', async () => {
  render(
    <MemoryRouter initialEntries={['/ai-session/s1/summary']}>
      <Routes><Route path="/ai-session/:id/summary" element={<SessionSummaryView />} /></Routes>
    </MemoryRouter>
  );
  await screen.findByText(/Session complete/i);
  // Phase 15a-3: scheduleReread + createMicroCard now appear in BOTH the
  // "Actions taken" list AND the new "Director rationale, step by step"
  // list, so getAllByText is the correct assertion.
  expect(screen.getAllByText(/scheduleReread/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/createMicroCard/).length).toBeGreaterThan(0);
  expect(screen.getByText(/done/i)).toBeInTheDocument();
  // traceId snippet: first 8 chars of 'tr-abcdef12' = 'tr-abcde'
  expect(screen.getByText(/trace tr-abcde/i)).toBeInTheDocument();
  // Director rationale section is rendered when steps exist.
  expect(screen.getByText(/Director rationale/i)).toBeInTheDocument();
});
