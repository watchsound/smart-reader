import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const fakeApi = {
  subscribeTrace: jest.fn().mockReturnValue(() => {}),
  get: jest.fn().mockResolvedValue({ id: 's1', goal: 'Review weak vocab', iteration: 3, budget: 12 }),
  userResult: jest.fn(),
  cancel: jest.fn(),
};
jest.mock('../../../renderer/api/sessionApi', () => ({ __esModule: true, default: fakeApi }));
import AISessionView from '../../../renderer/views/aiSession/AISessionView';

test('renders goal pill + iteration counter + End button', async () => {
  render(
    <MemoryRouter initialEntries={['/ai-session/s1']}>
      <Routes><Route path="/ai-session/:id" element={<AISessionView />} /></Routes>
    </MemoryRouter>
  );
  await screen.findByText(/Review weak vocab/);
  expect(screen.getByText(/3.*12/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /end/i })).toBeInTheDocument();
});
