import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import triggerBus from '../../renderer/brain/triggerBus';
import InlineSequenceHost from '../../renderer/components/brainShell/InlineSequenceHost';

const makeProposal = (steps, over = {}) => ({
  id: 'seq-1',
  source: 'phase-6-comprehension',
  unit: 'inline-sequence',
  surfaceTarget: { kind: 'view', view: 'reader' },
  priority: 'normal',
  freshness: 60_000,
  emittedAt: Date.now(),
  queuedAt: Date.now(),
  status: 'queued',
  payload: { title: 'Comprehension check', steps },
  ...over,
});

beforeEach(() => {
  triggerBus._resetForTests();
  window.electron = {
    ipcRenderer: {
      on: () => {},
      removeListener: () => {},
      invoke: jest.fn().mockResolvedValue({ ok: true }),
    },
  };
});

afterEach(() => {
  delete window.electron;
});

describe('InlineSequenceHost', () => {
  test('renders step 1 of N with progress and title', () => {
    const proposal = makeProposal([
      { title: 'Q1', body: 'first question' },
      { title: 'Q2', body: 'second question' },
      { title: 'Q3', body: 'third question' },
    ]);
    render(<InlineSequenceHost proposal={proposal} />);
    expect(screen.getByText('Q1')).toBeInTheDocument();
    expect(screen.getByText('step 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Comprehension check')).toBeInTheDocument();
  });

  test('Next advances through steps', () => {
    const proposal = makeProposal([
      { title: 'A' },
      { title: 'B' },
      { title: 'C' },
    ]);
    render(<InlineSequenceHost proposal={proposal} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('step 2 of 3')).toBeInTheDocument();
  });

  test('last step shows Done; clicking it emits onStepResult kind=done', () => {
    const onStepResult = jest.fn();
    const proposal = makeProposal([{ title: 'Only' }]);
    render(
      <InlineSequenceHost proposal={proposal} onStepResult={onStepResult} />,
    );
    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    const kinds = onStepResult.mock.calls.map((c) => c[0].kind);
    expect(kinds).toContain('next');
    expect(kinds).toContain('done');
  });

  test('Abort emits onStepResult kind=abort and dismisses', () => {
    const onStepResult = jest.fn();
    const proposal = makeProposal([{ title: 'X' }, { title: 'Y' }]);
    triggerBus.accept = jest.fn();
    triggerBus.dismiss = jest.fn();
    triggerBus.completeActive = jest.fn();
    render(
      <InlineSequenceHost proposal={proposal} onStepResult={onStepResult} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /abort/i }));
    expect(onStepResult).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'abort', step: 0 }),
    );
    expect(triggerBus.dismiss).toHaveBeenCalledWith('seq-1');
    expect(triggerBus.completeActive).toHaveBeenCalled();
  });
});
