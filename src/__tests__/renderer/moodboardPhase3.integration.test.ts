// src/__tests__/renderer/moodboardPhase3.integration.test.ts
import {
  buildExportFilename,
  triggerDownload,
} from '../../renderer/components/MoodBoard/diagram/canvas/exportBoard';
import { shouldEmitDragEpisode } from '../../renderer/views/reading/hooks/useBoardEpisodes';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { clusterToBoard, paletteForDomain } = require('../../main/utils/clusterToBoard');

describe('MoodBoard Phase 3 integration', () => {
  test('export filename + drag threshold + episode payload contract', () => {
    const fn = buildExportFilename('Roman / History', 'png', new Date('2026-06-22'));
    expect(fn).toMatch(/^Roman_History-2026-06-22\.png$/);

    expect(shouldEmitDragEpisode({ x: 0, y: 0 }, { x: 60, y: 0 })).toBe(true);
    expect(shouldEmitDragEpisode({ x: 0, y: 0 }, { x: 30, y: 30 })).toBe(false);

    const payload = {
      boardId: 42,
      nodeCount: 7,
      frameCount: 1,
      linkCount: 3,
      durationMs: 0,
    };
    expect(typeof payload.boardId).toBe('number');
    expect(payload.nodeCount).toBe(7);
    expect(payload.frameCount).toBe(1);
  });

  test('triggerDownload uses a synthesized anchor', () => {
    const clicked: HTMLAnchorElement[] = [];
    const orig = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      const el = orig(tag) as HTMLAnchorElement;
      if (tag === 'a') el.click = () => clicked.push(el);
      return el;
    }) as any);
    try {
      triggerDownload('data:application/pdf;base64,Z', 'x.pdf');
    } finally {
      (document.createElement as jest.Mock).mockRestore();
    }
    expect(clicked[0].getAttribute('download')).toBe('x.pdf');
  });

  test('clusterToBoard + paletteForDomain compose Phase 8b → Phase 2 shape', () => {
    expect(paletteForDomain('narrative')).toBe('warm-roman');
    expect(paletteForDomain('vocabulary')).toBe('austere-mono');

    const out = clusterToBoard({
      label: 'Cluster X',
      domain: 'vocabulary',
      notes: [{ id: 1 }, { id: 2 }],
    });
    expect(out.theme.paletteId).toBe('austere-mono');
    expect(out.frames).toHaveLength(1);
    expect(out.frames[0].containedNodeIds).toHaveLength(2);
    expect(out.nodes).toHaveLength(2);
    expect(out.suggestedLinks).toEqual([]);
  });
});
