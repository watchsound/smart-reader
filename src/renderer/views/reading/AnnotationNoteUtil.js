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
  // if (note.highlightOnly) {
  //   return {
  //     aType: 'underline',
  //     cfiRange: note.cfi,
  //     detail: { noteId: note.id },
  //     className: 'ul',
  //     style: { mtype: 'HasNote', stroke: note.color },
  //   };
  // }
  const aType = note.type === 'highlight' ? 'highlight' : 'underline';
  return {
    aType,
    cfiRange: note.cfi,
    note: note.note,
    tags: note.tags,
    detail: { noteId: note.id, emoji: note.emoji },
    className: aType === 'highlight' ? 'hl' : 'ul',
    style:
      aType === 'highlight'
        ? {
            fill: note.color,
            'fill-opacity': '0.5',
            'mix-blend-mode': 'multiply',
          }
        : { mtype: note.type, stroke: note.color },
  };
}
