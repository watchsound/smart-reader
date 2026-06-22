import { toPng, toJpeg } from 'html-to-image';

const SAFE_NAME = /[^A-Za-z0-9_-]+/g;

export function buildExportFilename(
  boardName: string | undefined,
  ext: 'png' | 'pdf' | 'jpg',
  now: Date = new Date(),
): string {
  const date = now.toISOString().slice(0, 10);
  const base = (boardName || '').trim().replace(SAFE_NAME, '_').replace(/^_+|_+$/g, '');
  const safe = base || 'moodboard';
  return `${safe}-${date}.${ext}`;
}

export function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export async function captureElementAsPng(
  el: HTMLElement,
  pixelRatio = 2,
): Promise<string> {
  return toPng(el, { pixelRatio, cacheBust: true });
}

export async function captureElementAsJpeg(
  el: HTMLElement,
  pixelRatio = 2,
  quality = 0.92,
): Promise<string> {
  return toJpeg(el, { pixelRatio, quality, cacheBust: true });
}
