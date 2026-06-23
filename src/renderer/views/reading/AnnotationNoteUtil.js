export const colors = [
  '#42a5f5',
  '#ba68c8',
  '#FF5733',
  '#ff9800',
  '#3598db',
  '#82dd55',
];

export const colorsMui = [
  'primary',
  'secondary',
  'error',
  'warning',
  'info',
  'success',
];

export const markTypes = {
  Highlight: 'highlight',
  Underline: 'underline',
  Strikeline: 'strikeline',
  Dashline: 'dashline',
  Hasnote: 'hasnote',
};

export function note2rendition(note) {
  // Route every note — highlight or line-style — through epub.js's
  // 'underline' annotation path so it hits our custom View.prototype.underline
  // override. The override dispatches on `mtype` to the right Mark subclass
  // (Highlightmark / Underline / Strikeline / Dashline). Going this way the
  // Mark subclasses see `data.emoji` and render it; the default epub.js
  // 'highlight' path doesn't, which was why old highlights silently lost
  // their emoji.
  const isHighlight = note.type === 'highlight';
  const mtype = isHighlight ? 'Highlight' : note.type;
  const colorStyle = isHighlight
    ? {
        fill: note.color,
        'fill-opacity': '0.5',
        'mix-blend-mode': 'multiply',
      }
    : { stroke: note.color };
  return {
    aType: 'underline',
    cfiRange: note.cfi,
    note: note.note,
    tags: note.tags,
    detail: { noteId: note.id, emoji: note.emoji },
    className: isHighlight ? 'hl' : 'ul',
    style: { mtype, ...colorStyle },
  };
}
