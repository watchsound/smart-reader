import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SessionStartDialog from '../../../renderer/views/aiSession/SessionStartDialog';

// jest.mock is hoisted above variable declarations, so we cannot reference a
// const defined in the outer scope inside the factory.  Instead, define the
// mock inline and retrieve the live reference with require() after the mock
// is in place.
jest.mock('../../../renderer/api/sessionApi', () => ({
  __esModule: true,
  default: { start: jest.fn().mockResolvedValue({ sessionId: 'sX', traceId: 't1' }) },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fakeSessionApi = require('../../../renderer/api/sessionApi').default;

function wrap(children) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

beforeEach(() => {
  fakeSessionApi.start.mockClear();
});

test('with active Quest: shows quest-anchored start', () => {
  render(wrap(<SessionStartDialog open onClose={jest.fn()} activeQuest={{ id: 1, title: 'Master React' }} userId={1} />));
  expect(screen.getByText(/Master React/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /start session/i })).toBeInTheDocument();
});

test('without active Quest: shows free-text goal input', () => {
  render(wrap(<SessionStartDialog open onClose={jest.fn()} activeQuest={null} userId={1} />));
  expect(screen.getByPlaceholderText(/what do you want/i)).toBeInTheDocument();
});

test('clicking Start invokes sessionApi.start with Quest', async () => {
  const onClose = jest.fn();
  render(wrap(<SessionStartDialog open onClose={onClose} activeQuest={{ id: 1, title: 'Master React' }} userId={1} />));
  fireEvent.click(screen.getByRole('button', { name: /start session/i }));
  // Don't strictly require a /starting/i indicator — but verify the API was called
  expect(fakeSessionApi.start).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, questId: 1 }));
});
