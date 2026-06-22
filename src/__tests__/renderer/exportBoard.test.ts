import {
  buildExportFilename,
  triggerDownload,
} from '../../renderer/components/MoodBoard/diagram/canvas/exportBoard';

describe('exportBoard helpers', () => {
  test('buildExportFilename sanitizes the board name and appends extension + date', () => {
    const name = buildExportFilename('My Roman / History! board', 'png', new Date('2026-06-22T10:00:00Z'));
    expect(name).toMatch(/^My_Roman_History_board-2026-06-22\.png$/);
  });

  test('buildExportFilename falls back to "moodboard" when name is empty', () => {
    const name = buildExportFilename('', 'pdf', new Date('2026-06-22T10:00:00Z'));
    expect(name).toMatch(/^moodboard-2026-06-22\.pdf$/);
  });

  test('triggerDownload creates an <a> element with the right href + download attr', () => {
    const clicked: HTMLAnchorElement[] = [];
    const originalCreate = document.createElement.bind(document);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest.spyOn(document, 'createElement').mockImplementation((tag: string): any => {
      const el = originalCreate(tag) as HTMLAnchorElement;
      if (tag === 'a') {
        el.click = () => clicked.push(el);
      }
      return el;
    });
    try {
      triggerDownload('data:image/png;base64,XYZ', 'foo.png');
    } finally {
      (document.createElement as jest.Mock).mockRestore();
    }
    expect(clicked).toHaveLength(1);
    expect(clicked[0].getAttribute('href')).toBe('data:image/png;base64,XYZ');
    expect(clicked[0].getAttribute('download')).toBe('foo.png');
  });
});
