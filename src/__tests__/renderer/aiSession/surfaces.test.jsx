import { render, screen, fireEvent } from '@testing-library/react';
import LeitnerSurface from '../../../renderer/views/aiSession/surfaces/LeitnerSurface';
import ComprehensionSurface from '../../../renderer/views/aiSession/surfaces/ComprehensionSurface';
import MicroCardChipSurface from '../../../renderer/views/aiSession/surfaces/MicroCardChipSurface';
import MoodBoardSurface from '../../../renderer/views/aiSession/surfaces/MoodBoardSurface';

jest.mock('../../../renderer/api/learningPointApi', () => ({
  default: { get: jest.fn().mockResolvedValue({ id: 42, title: 'parse', definition: 'to analyze' }) },
}));

test('LeitnerSurface: rating buttons fire onSubmit with rating', async () => {
  const onSubmit = jest.fn();
  render(<LeitnerSurface args={{ learningPointId: 42 }} onSubmit={onSubmit} />);
  await screen.findByText(/parse/i);
  fireEvent.click(screen.getByRole('button', { name: /easy/i }));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ rating: 'easy' }));
});

test('ComprehensionSurface: submit fires onSubmit with answer', () => {
  const onSubmit = jest.fn();
  render(<ComprehensionSurface args={{ bookId: 1, chapterId: 'ch-3' }} onSubmit={onSubmit} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'my answer' } });
  fireEvent.click(screen.getByRole('button', { name: /submit/i }));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ answer: 'my answer' }));
});

test('MicroCardChipSurface: accept fires onSubmit with accepted=true', () => {
  const onSubmit = jest.fn();
  render(<MicroCardChipSurface args={{ proposal: { headword: 'parse' } }} onSubmit={onSubmit} />);
  fireEvent.click(screen.getByRole('button', { name: /accept/i }));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ accepted: true }));
});

test('MoodBoardSurface: dismiss fires onSubmit with dismissed=true', () => {
  const onSubmit = jest.fn();
  render(<MoodBoardSurface args={{ boardId: 7 }} onSubmit={onSubmit} />);
  fireEvent.click(screen.getByRole('button', { name: /done|close|dismiss/i }));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ dismissed: true }));
});
