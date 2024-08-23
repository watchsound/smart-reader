import JSON5 from 'json5';
import customStorage from '../store/customStorage';

const defaultShelf = {
  New: null,
  Study: [],
  Work: [],
  Entertainment: [],
};
class ShelfUtil {
  static async setShelf(shelfTitle: string, bookKey: string) {
    const json = (await customStorage.getItem('shelfList')) as string;
    const obj = JSON5.parse(json!) || defaultShelf;
    if (obj[shelfTitle] === undefined) {
      obj[shelfTitle] = [];
    }
    if (obj[shelfTitle].indexOf(bookKey) === -1) {
      obj[shelfTitle].unshift(bookKey);
    }
    customStorage.setItem('shelfList', JSON.stringify(obj));
  }

  static async getShelf() {
    const json = (await customStorage.getItem('shelfList')) as string;
    const obj = (json && JSON5.parse(json!)) || defaultShelf;
    return obj;
  }

  static async clearShelf(shelfIndex: number, bookKey: string) {
    const json = (await customStorage.getItem('shelfList')) as string;
    const obj = JSON5.parse(json!) || defaultShelf;
    const shelfTitle = Object.keys(obj);
    const currentShelfTitle = shelfTitle[shelfIndex];
    const index = obj[currentShelfTitle].indexOf(bookKey);
    obj[currentShelfTitle].splice(index, 1);
    customStorage.setItem('shelfList', JSON.stringify(obj));
  }

  static async deleteFromAllShelf(bookKey: string) {
    const json = (await customStorage.getItem('shelfList')) as string;
    const obj = JSON5.parse(json!) || defaultShelf;
    const shelfTitle = Object.keys(obj);
    shelfTitle.splice(0, 1);
    shelfTitle.forEach((item) => {
      const index = obj[item].indexOf(bookKey);
      if (index > -1) {
        obj[item].splice(index, 1);
      }
    });
    customStorage.setItem('shelfList', JSON.stringify(obj));
  }

  static async removeShelf(shelfTitle: string) {
    const json = (await customStorage.getItem('shelfList')) as string;
    const obj = JSON5.parse(json!) || defaultShelf;
    delete obj[shelfTitle];
    customStorage.setItem('shelfList', JSON.stringify(obj));
  }

  static async getBookPosition(bookKey: string) {
    const json = (await customStorage.getItem('shelfList')) as string;
    const obj = JSON5.parse(json!) || defaultShelf;
    const shelfList: string[] = [];
    for (const item in obj) {
      if (obj[item] && obj[item].indexOf(bookKey) > -1) {
        shelfList.push(item);
      }
    }
    return shelfList;
  }
}

export default ShelfUtil;
