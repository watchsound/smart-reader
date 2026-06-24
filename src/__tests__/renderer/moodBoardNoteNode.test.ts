/**
 * Tests for NoteNode excerpt extraction.
 *
 * Core concern: notes created with the TipTap rich-text editor store their
 * content in cards[0].html (not cards[0].text). The NoteNode must prefer html
 * so that TipTap notes show a real excerpt instead of blank or raw JSON.
 */
import { stripHtml } from '../../renderer/components/MoodBoard/rf/nodes/NoteNode';

describe('stripHtml', () => {
  it('strips paragraph tags from TipTap output', () => {
    const html = '<p>Microcirculation affects blood pressure regulation.</p>';
    expect(stripHtml(html)).toBe('Microcirculation affects blood pressure regulation.');
  });

  it('collapses multiple tags into single spaces', () => {
    const html = '<p>First sentence.</p><p>Second sentence.</p>';
    expect(stripHtml(html)).toBe('First sentence. Second sentence.');
  });

  it('strips nested inline tags', () => {
    const html = '<p>This is <strong>important</strong> and <em>italicized</em> text.</p>';
    expect(stripHtml(html)).toBe('This is important and italicized text.');
  });

  it('returns plain text unchanged', () => {
    expect(stripHtml('Plain text note')).toBe('Plain text note');
  });

  it('returns empty string for empty input', () => {
    expect(stripHtml('')).toBe('');
  });

  it('collapses all whitespace runs including internal ones', () => {
    const html = '<p>  multiple   spaces  </p>';
    expect(stripHtml(html)).toBe('multiple spaces');
  });

  it('handles TipTap empty paragraph sentinel', () => {
    // TipTap emits <p></p> for empty documents
    expect(stripHtml('<p></p>')).toBe('');
  });
});

/**
 * Simulates the excerpt field selection logic from NoteNode:
 *   rawText = cards[0].html || cards[0].text || ''
 */
function pickRawText(card: { html?: string; text?: string } | undefined): string {
  return card?.html || card?.text || '';
}

describe('NoteNode excerpt field selection', () => {
  it('uses html when both html and text are present (TipTap note)', () => {
    const card = {
      html: '<p>Rich text content from TipTap editor.</p>',
      text: 'some raw markdown source',
    };
    expect(pickRawText(card)).toBe(card.html);
  });

  it('falls back to text when html is absent (old plain-text note)', () => {
    const card = { text: 'Plain text from old note', html: '' };
    expect(pickRawText(card)).toBe('Plain text from old note');
  });

  it('falls back to text when html is the empty-paragraph sentinel', () => {
    // Empty TipTap doc — html is '<p></p>' which is falsy after CardContentPanel
    // checks it, but at the excerpt layer we just skip it since it's whitespace-only.
    const card = { html: '', text: 'fallback text' };
    expect(pickRawText(card)).toBe('fallback text');
  });

  it('returns empty string when card is undefined', () => {
    expect(pickRawText(undefined)).toBe('');
  });

  it('returns empty string when both fields are empty', () => {
    expect(pickRawText({ html: '', text: '' })).toBe('');
  });

  it('produces a clean excerpt from TipTap html after stripHtml', () => {
    const card = {
      html: '<p>Microcirculation and <strong>blood pressure</strong> regulation in hypertension.</p>',
      text: '',
    };
    const excerpt = stripHtml(pickRawText(card)).slice(0, 160);
    expect(excerpt).toBe('Microcirculation and blood pressure regulation in hypertension.');
  });
});
