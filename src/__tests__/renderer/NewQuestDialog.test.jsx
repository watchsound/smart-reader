import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NewQuestDialog from '../../renderer/components/brainShell/NewQuestDialog';

let invokeFn;

beforeEach(() => {
  invokeFn = jest.fn();
  window.electron = {
    ipcRenderer: {
      on: () => {},
      removeListener: () => {},
      invoke: invokeFn,
    },
  };
});

afterEach(() => {
  delete window.electron;
});

describe('NewQuestDialog', () => {
  test('renders fields when open', () => {
    render(<NewQuestDialog open onClose={() => {}} />);
    expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Goal/)).toBeInTheDocument();
  });

  test('Create button disabled until both fields filled', () => {
    render(<NewQuestDialog open onClose={() => {}} />);
    const create = screen.getByRole('button', { name: /create/i });
    expect(create).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Name/), {
      target: { value: 'X' },
    });
    expect(create).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Goal/), {
      target: { value: 'Y' },
    });
    expect(create).not.toBeDisabled();
  });

  test('Create invokes quest-create IPC with trimmed values', async () => {
    invokeFn.mockResolvedValue({ id: 'q1', name: 'X', goal: 'Y' });
    const onClose = jest.fn();
    const onCreated = jest.fn();
    render(
      <NewQuestDialog open onClose={onClose} onCreated={onCreated} />,
    );
    fireEvent.change(screen.getByLabelText(/Name/), {
      target: { value: '  German B2  ' },
    });
    fireEvent.change(screen.getByLabelText(/Goal/), {
      target: { value: 'reach B2' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    await waitFor(() => {
      expect(invokeFn).toHaveBeenCalledWith('quest-create', {
        name: 'German B2',
        goal: 'reach B2',
      });
    });
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  test('Create surfaces error returned from IPC', async () => {
    invokeFn.mockResolvedValue({ error: 'name is required' });
    render(<NewQuestDialog open onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'X' } });
    fireEvent.change(screen.getByLabelText(/Goal/), { target: { value: 'Y' } });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    await waitFor(() =>
      expect(screen.getByText(/name is required/i)).toBeInTheDocument(),
    );
  });
});
