import _ from 'underscore';
import JSON5 from 'json5';
import customStorage from '../store/customStorage';

class RecordLocation {
  static async recordCfi(bookKey: string, cfi: string, percentage: number) {
    const json = (await customStorage.getItem('recordLocation')) as string;
    const obj = JSON5.parse(json || '{}');
    obj[bookKey] = { cfi, percentage };
    customStorage.setItem('recordLocation', JSON.stringify(obj));
  }

  static async getCfi(bookKey: string) {
    const json = (await customStorage.getItem('recordLocation')) as string;
    const obj = JSON5.parse(json || '{}');
    return obj[bookKey] || {};
  }

  static async recordHtmlLocation(
    bookKey: string,
    text: string,
    chapterTitle: string,
    chapterDocIndex: string,
    chapterHref: string,
    count: string,
    percentage: string,
    cfi: string,
  ) {
    if (cfi) {
      const json = (await customStorage.getItem('recordLocation')) as string;
      const obj = JSON5.parse(json || '{}');
      obj[bookKey] = {
        text,
        chapterTitle,
        chapterDocIndex,
        chapterHref,
        count,
        percentage,
        cfi,
      };
      customStorage.setItem('recordLocation', JSON.stringify(obj));
    } else {
      if (!text || !chapterTitle || !chapterDocIndex || !count || !percentage)
        return;
      const json = (await customStorage.getItem('recordLocation')) as string;
      const obj = JSON5.parse(json || '{}');
      obj[bookKey] = {
        text,
        chapterTitle,
        chapterDocIndex,
        chapterHref,
        count,
        percentage,
        cfi,
      };
      customStorage.setItem('recordLocation', JSON.stringify(obj));
    }
  }

  static async getHtmlLocation(bookKey: string) {
    const json = (await customStorage.getItem('recordLocation')) as string;
    const obj = JSON5.parse(json || '{}');
    return obj[bookKey] || {};
  }

  static async getPDFLocation(fingerprint: string) {
    const json = (await customStorage.getItem('pdfjs.history')) as string;
    const arr = JSON5.parse(json || '{}').files || [];
    return arr[_.findLastIndex(arr, { fingerprint })] || {};
  }

  static async recordPDFLocation(fingerprint: string, obj: object) {
    const json = (await customStorage.getItem('pdfjs.history')) as string;
    const _obj = JSON5.parse(json || '{}');
    _obj.files[_.findLastIndex(_obj.files, { fingerprint })] = obj;
    customStorage.setItem('pdfjs.history', JSON.stringify(_obj));
  }

  static async getAllCfi() {
    const json = (await customStorage.getItem('recordLocation')) as string;
    const obj = JSON5.parse(json || '{}');
    return obj;
  }

  static async clear(bookKey: string) {
    const json = (await customStorage.getItem('recordLocation')) as string;
    const obj = JSON5.parse(json || '{}');
    delete obj[bookKey];
    customStorage.setItem('recordLocation', JSON.stringify(obj));
  }
}

export default RecordLocation;
