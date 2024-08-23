import JSON5 from 'json5';
import customStorage from '../store/customStorage';

class ReadingTime {
  static async setTime(bookKey: string, time: number) {
    const json = (await customStorage.getItem('readingTime')) as string;

    const obj = JSON5.parse(json!) || {};
    obj[bookKey] = time;
    customStorage.setItem('readingTime', JSON.stringify(obj));
  }

  static async getTime(bookKey: string) {
    const json = (await customStorage.getItem('readingTime')) as string;
    const obj = JSON5.parse(json!) || {};
    return obj[bookKey] || 0;
  }

  static async getAllTime() {
    const json = (await customStorage.getItem('readingTime')) as string;
    const obj = JSON5.parse(json!) || {};
    return obj || [];
  }

  static async clearTime(bookKey: string) {
    const json = (await customStorage.getItem('readingTime')) as string;
    const obj = JSON5.parse(json!) || {};
    delete obj[bookKey];
    customStorage.setItem('readingTime', JSON.stringify(obj));
  }
}

export default ReadingTime;
