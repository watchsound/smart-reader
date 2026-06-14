/* eslint-disable prettier/prettier */
// code is modified from  koodo reader
class Note {
  id: string;

  sourceType: string;     // NoteType

  sourceKey: string;  // bookkey, url....

  date: { year: number; month: number; day: number };

  chapter: string;

  chapterIndex: number;

  title: string;

  cards: {
    id: number;
    text: string;
    html: string;
    image: string;
    overlap: number;  //text overlap layout:  0: no-overlap 1: central 2: top 3: bottom
    type: string;
  }[];

  cfi: string;

  range: string;

  percentage: number;

  position: {         //used in pdf view.
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    width: number;
    height: number;
    pageNumber: number;
  }[];

  emoji: string;

  color: string;

  tags: string[];

  rate: number;

  hasQuiz: boolean;

  constructor(
    sourceKey: string,
    chapter: string,
    chapterIndex: number,
    title: string,
    cards: {
      id: number,
      text: string,
      html: string,
      image: string,
      overlap: number,
      type: string,
    }[],
    cfi: string,
    range: string,
    percentage: number,
    position: {         //used in pdf view.
      x1: number,
      y1: number,
      x2: number,
      y2: number,
    width: number,
    height: number,
    pageNumber: number,
    }[],

    emoji: string,
    sourceType: string,
    color: string,
    tags: string[],
    rate: number,
    hasQuiz: boolean,
  ) {
    this.id = `${new Date().getTime()  }`;
    this.sourceKey = sourceKey;
    this.date = {
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      day: new Date().getDate(),
    };
    this.chapter = chapter;
    this.chapterIndex = chapterIndex;
    this.title = title;
    this.cards = cards || [];
    this.cfi = cfi;
    this.range = range;
    this.percentage = percentage;
    this.sourceType = sourceType;
    this.color = color;
    this.tags = tags;
    this.rate = rate;
    this.position = position;
    this.emoji = emoji;
    this.hasQuiz = hasQuiz;  //this is for optimization ...
  }
}

export default Note;

export const NoteType = Object.freeze({
  Note: "note",
  Url: "url",
  Chat: "chat",
  Book: "book",
  LearningPoint: "learning_point"
});

export const CardType = Object.freeze({
  MindMap: "mindmap",
  Normal: "normal", // default is empty
});


export const QuizStatus = Object.freeze({
  NotUsed: "notUsed",
  Failed: "failed",
  Passed: 'passed',
});
