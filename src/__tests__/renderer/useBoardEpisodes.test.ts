import { shouldEmitDragEpisode } from '../../renderer/views/reading/hooks/useBoardEpisodes';

describe('shouldEmitDragEpisode', () => {
  test('emits when distance > 50px', () => {
    expect(shouldEmitDragEpisode({ x: 0, y: 0 }, { x: 60, y: 0 })).toBe(true);
    expect(shouldEmitDragEpisode({ x: 0, y: 0 }, { x: 0, y: 60 })).toBe(true);
    expect(shouldEmitDragEpisode({ x: 0, y: 0 }, { x: 40, y: 40 })).toBe(true); // sqrt(3200)≈56
  });

  test('does not emit when distance <= 50px', () => {
    expect(shouldEmitDragEpisode({ x: 0, y: 0 }, { x: 30, y: 30 })).toBe(false);
    expect(shouldEmitDragEpisode({ x: 0, y: 0 }, { x: 50, y: 0 })).toBe(false);
  });

  test('handles zero-delta', () => {
    expect(shouldEmitDragEpisode({ x: 100, y: 100 }, { x: 100, y: 100 })).toBe(false);
  });
});
