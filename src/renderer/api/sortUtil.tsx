/* eslint-disable no-param-reassign */
/* eslint-disable no-inner-declarations */
import _ from 'underscore';
import JSON5 from 'json5';
import BookModel from '../../commons/model/Book';
import NoteModel from '../../commons/model/Note';
import ReadingTime from './readingTime';
import RecordLocation from './recordLocation';
import RecordRecent from './recordRecent';
import customStorage from '../store/customStorage';

const getBookName = (books: BookModel[]) => {
  return books.map((item) => item.name);
};
const getAuthorName = (books: BookModel[]) => {
  return _.sortBy(
    books.map((item) => {
      return { id: item.id, author: item.author };
    }),
    'author',
  ).map((item: { id: string; author: string }) => item.id);
};
const getBookKey = (books: BookModel[]) => {
  return books.map((item) => item.id);
};
const getBookIndex = (nameArr: string[], oldNameArr: string[]) => {
  const indexArr: number[] = [];
  for (let i = 0; i < nameArr.length; i++) {
    // 如果索引数组已经包含该索引，就把它放在随后一位，取数组长度为索引
    indexArr.push(oldNameArr.indexOf(nameArr[i]));
  }
  if (indexArr.length < oldNameArr.length) {
    oldNameArr.forEach((item) => {
      if (nameArr.indexOf(item) === -1) {
        indexArr.push(indexArr.length);
      }
    });
  }
  return [
    ...new Set(
      indexArr.map((item) => {
        return item - Math.min(...indexArr);
      }),
    ),
  ];
};
const getDurationArr = () => {
  const durationObj = ReadingTime.getAllTime();
  const sortable: [string, number][] = [];
  for (const obj in durationObj) {
    sortable.push([obj, (durationObj as unknown as Record<string, number>)[obj]]);
  }
  sortable.sort(function (a: [string, number], b: [string, number]) {
    return a[1] - b[1];
  });
  return Object.keys(durationObj);
};
const getPercentageArr = () => {
  const locationObj = RecordLocation.getAllCfi();
  const sortable: [string, number][] = [];
  for (const obj in locationObj) {
    sortable.push([obj, ((locationObj as unknown as Record<string, { percentage?: number }>)[obj].percentage) || 0]);
  }
  sortable.sort(function (a: [string, number], b: [string, number]) {
    return a[1] - b[1];
  });
  return sortable.map((item: [string, number]) => item[0]);
};
class SortUtil {
  static sortBooks(
    books: BookModel[],
    bookSortCode: { sort: number; order: number },
  ) {
    books = books || [];
    const oldRecentArr = books.map((item) => item.id);
    if (bookSortCode.sort === 1 || bookSortCode.sort === 0) {
      async function t() {
        const recentArr = await RecordRecent.getAllRecent();
        if (bookSortCode.order === 1) {
          return getBookIndex(recentArr, oldRecentArr).reverse();
        }
        return getBookIndex(recentArr, oldRecentArr);
      }
      return t();
    }
    if (bookSortCode.sort === 2) {
      const oldNameArr = getBookName(books);
      const nameArr = getBookName(books).sort();
      if (bookSortCode.order === 1) {
        return getBookIndex(nameArr, oldNameArr).reverse();
      }
      return getBookIndex(nameArr, oldNameArr);
    }
    if (bookSortCode.sort === 3) {
      const nameArr: number[] = [];
      for (let i = 0; i < books.length; i++) {
        nameArr.push(i);
      }
      if (bookSortCode.order === 1) {
        return nameArr.reverse();
      }
      return nameArr;
    }
    if (bookSortCode.sort === 4) {
      const durationKeys = getDurationArr();

      const bookKeys = getBookKey(books);
      if (bookSortCode.order === 1) {
        return getBookIndex(
          _.union(durationKeys, bookKeys),
          bookKeys,
        ).reverse();
      }
      return getBookIndex(_.union(durationKeys, bookKeys), bookKeys);
    }
    if (bookSortCode.sort === 5) {
      const oldAuthorArr = getBookKey(books);
      const authorArr = getAuthorName(books);
      if (bookSortCode.order === 1) {
        return getBookIndex(authorArr, oldAuthorArr).reverse();
      }
      return getBookIndex(authorArr, oldAuthorArr);
    }
    if (bookSortCode.sort === 6) {
      const percentagenKeys = getPercentageArr();
      const bookKeys = getBookKey(books);
      if (bookSortCode.order === 1) {
        return getBookIndex(percentagenKeys, bookKeys).reverse();
      }
      return getBookIndex(percentagenKeys, bookKeys);
    }
    return [];
  }

  static sortNotes(
    notes: NoteModel[],
    noteSortCode: { sort: number; order: number },
    books: BookModel[] = [],
  ) {
    if (noteSortCode.sort === 2) {
      // 使书摘从晚到早排序
      const noteArr = _.clone(notes).reverse();
      const dateArr = _.uniq(
        notes.map(
          (item) => `${item.date.year}-${item.date.month}-${item.date.day}`,
        ),
      );
      if (noteSortCode.order === 1) {
        dateArr.sort();
      } else {
        dateArr.sort().reverse();
      }
      // 得到以日期为键，书摘为值的对象
      const noteObj: { [id: string]: any } = {};
      dateArr.forEach((date: string) => {
        noteObj[date] = [];
      });
      noteArr.forEach((note: NoteModel) => {
        dateArr.forEach((date: string) => {
          if (
            date === `${note.date.year}-${note.date.month}-${note.date.day}`
          ) {
            noteObj[date].push(note);
          }
        });
      });
      return noteObj || {};
    }
    if (noteSortCode.sort === 1) {
      // 使书摘从晚到早排序
      const noteArr = _.clone(notes).reverse();
      const nameArr = _.uniq(
        notes.map(
          (item) =>
            books[
              _.findLastIndex(books, {
                id: item.sourceKey,
              })
            ].name,
        ),
      );
      if (noteSortCode.order === 1) {
        nameArr.sort();
      } else {
        nameArr.sort().reverse();
      }
      // 得到以日期为键，书摘为值的对象
      const noteObj: { [id: string]: any } = {};
      nameArr.forEach((name: string) => {
        noteObj[name] = [];
      });
      noteArr.forEach((note: NoteModel) => {
        nameArr.forEach((name: string) => {
          if (
            name ===
            books[
              _.findLastIndex(books, {
                id: note.sourceKey,
              })
            ].name
          ) {
            noteObj[name].push(note);
          }
        });
      });
      return noteObj || {};
    }
    return {};
  }

  static async setBookSortCode(sortCode: number, orderCode: number) {
    const json0 = (await customStorage.getItem('bookSortCode')) as string;
    const json = json0 || JSON.stringify({ sort: 1, order: 2 });
    const obj = json ? JSON5.parse(json) : { sort: 1, order: 2 };
    obj.sort = sortCode;
    obj.order = orderCode;
    customStorage.setItem('bookSortCode', JSON.stringify(obj));
  }

  static async getBookSortCode() {
    const json0 = (await customStorage.getItem('bookSortCode')) as string;
    const json = json0 || JSON.stringify({ sort: 1, order: 2 });
    const obj = JSON5.parse(json) || { sort: 1, order: 2 };
    return obj || null;
  }

  static async setNoteSortCode(sort: number, order: number) {
    const json0 = (await customStorage.getItem('noteSortCode')) as string;
    const json = json0 || JSON.stringify({ sort: 2, order: 2 });

    const obj = json ? JSON5.parse(json) : { sort: 2, order: 2 };
    obj.sort = sort;
    obj.order = order;
    customStorage.setItem('noteSortCode', JSON.stringify(obj));
  }

  static async getNoteSortCode() {
    const json0 = (await customStorage.getItem('noteSortCode')) as string;
    const json = json0 || JSON.stringify({ sort: 2, order: 2 });
    const obj = JSON5.parse(json) || { sort: 2, order: 2 };
    return obj || null;
  }
}

export default SortUtil;
