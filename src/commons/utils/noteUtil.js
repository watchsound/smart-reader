import { color2mui } from './colors';
/**
 * NOTE:::  image is not
 * @param {*} noteJson
 * @returns
 */
export const noteJson2pdfJson = (noteJson, theme) => {
  const hasBoundingRect = typeof noteJson.position.boundingRect !== 'undefined';
  const pdfJson = {
    content: {},
    position: {
      boundingRect: hasBoundingRect
        ? noteJson.position.boundingRect
        : {
            ...noteJson.position.rects[0],
            pageNumber: noteJson.chapterIndex < 0 ? 0 : noteJson.chapterIndex,
          },
      rects: [],
      pageNumber: noteJson.chapterIndex < 0 ? 0 : noteJson.chapterIndex,
    },
    comment: {},
    id: noteJson.id,
  };
  if (noteJson.cards[0].image) pdfJson.content.image = noteJson.cards[0].image;
  else pdfJson.content.text = noteJson.cards[0].text;

  if (hasBoundingRect) {
    pdfJson.position.rects = [...noteJson.position.rects];
  } else if (noteJson.position.rects.length > 1) {
    pdfJson.position.rects = noteJson.position.rects.filter(
      (data, idx) => idx !== 0,
    );
  }

  if (noteJson.emoji) pdfJson.comment.emoji = noteJson.emoji;
  pdfJson.comment.text = noteJson.title;
  if (noteJson.emoji) pdfJson.emoji = noteJson.emoji;
  pdfJson.highlightType = noteJson.highlightType;
  pdfJson.color = color2mui(noteJson.color, theme);

  if (noteJson.cards[0].image) {
    pdfJson.comment.text += ` | ${noteJson.cards[0].text}`;
  } else if (noteJson.cards.length > 1 && noteJson.cards[1].text) {
    pdfJson.comment.text += ` | ${noteJson.cards[1].text}`;
  }

  return pdfJson;
};

export const pdfJson2noteJson = (pdfJson, sourceKey) => {
  const noteJson = {
    id: pdfJson.id,
    sourceKey,
    title: '',
    cards: [],
    cfi: '',
    range: '',
    chapter: '',
    chapterIndex: pdfJson.position.pageNumber,
    percentage: 0,
    sourceType: 'book', // type
    color: '', // color
    tags: [],
    rate: 0,
    hasQuiz: false,
    position: [],
    emoji: pdfJson.comment.emoji || '',
  };
  const position = [];
  position.push(pdfJson.position.boundingRect);
  pdfJson.position.rects.forEach((element) => {
    position.push(element);
  });
  noteJson.position = position;

  const content = pdfJson.comment.text;
  const index = content.indexOf('|');
  const title = index > 0 ? content.substring(0, index) : content;
  const comment = index > 0 ? content.substring(index) : '';
  noteJson.title = title;
  if (pdfJson.content.image) {
    noteJson.cards.push({
      image: pdfJson.content.image,
      text: comment,
    });
  } else {
    noteJson.cards.push({
      text: pdfJson.content.text,
    });
    if (comment) {
      noteJson.cards.push({
        text: comment,
      });
    }
  }
  return noteJson;
};
