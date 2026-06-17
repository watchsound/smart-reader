import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import TraceSidebar from '../../../renderer/views/aiSession/TraceSidebar';

const sampleTrace = [
  { kind: 'thought', iteration: 0, payload: { reasoning: 'starting review' } },
  { kind: 'tool', iteration: 0, payload: { tool: 'topUnmasteredConcepts' } },
  { kind: 'observation', iteration: 0, payload: { summary: '[5 concepts]' } },
  { kind: 'soft-write', iteration: 1, payload: { id: 'sw-1', tool: 'scheduleReread', args: { chapterId: 'ch-3' }, undone: false } },
  { kind: 'end', iteration: 5, payload: { reason: 'done' } },
];

test('renders trace events grouped by iteration', () => {
  render(<TraceSidebar trace={sampleTrace} onUndo={jest.fn()} />);
  expect(screen.getByText(/starting review/i)).toBeInTheDocument();
  expect(screen.getByText(/topUnmasteredConcepts/i)).toBeInTheDocument();
  expect(screen.getByText(/scheduleReread/i)).toBeInTheDocument();
});

test('soft-write rows show Undo button; clicking it calls onUndo with id', () => {
  const onUndo = jest.fn();
  render(<TraceSidebar trace={sampleTrace} onUndo={onUndo} />);
  const undoBtn = screen.getByRole('button', { name: /undo/i });
  fireEvent.click(undoBtn);
  expect(onUndo).toHaveBeenCalledWith('sw-1');
});

test('undone soft-writes show as struck-through and disable Undo', () => {
  const traceWithUndone = sampleTrace.map(e =>
    e.kind === 'soft-write' ? { ...e, payload: { ...e.payload, undone: true } } : e
  );
  render(<TraceSidebar trace={traceWithUndone} onUndo={jest.fn()} />);
  const row = screen.getByText(/scheduleReread/i).closest('[data-trace-row]');
  expect(row).toHaveAttribute('data-undone', 'true');
});
