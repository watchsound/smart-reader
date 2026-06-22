import { useEffect, useRef } from 'react';
import brainApi, { EPISODE_TYPES } from '../../../api/brainApi';

const DRAG_THRESHOLD_PX = 50;

export function shouldEmitDragEpisode(
  start: { x: number; y: number },
  end: { x: number; y: number },
): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD_PX;
}

interface BoardEpisodePayload {
  boardId: string | number;
  nodeCount: number;
  frameCount: number;
  linkCount: number;
  durationMs: number;
}

export function emitBoardArrangedEpisode(payload: BoardEpisodePayload): void {
  if (!brainApi || typeof brainApi.recordEpisode !== 'function') return;
  brainApi
    .recordEpisode({
      eventType: EPISODE_TYPES.BOARD_ARRANGED,
      payload,
      sourceContext: { view: 'moodboard' },
    })
    .catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.warn('BOARD_ARRANGED episode emit failed:', err);
    });
}

export function useBoardEpisodes(): {
  shouldEmitDragEpisode: typeof shouldEmitDragEpisode;
  emitBoardArrangedEpisode: typeof emitBoardArrangedEpisode;
} {
  const handlers = useRef({ shouldEmitDragEpisode, emitBoardArrangedEpisode });
  useEffect(() => {
    // Reserved for future listener-based wiring; intentionally empty in v1.
  }, []);
  return handlers.current;
}
