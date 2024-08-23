import JSON5 from 'json5';
import BookModel from '../../commons/model/Book';
import customStorage from '../store/customStorage';

class AddFavorite {
  static async setFavorite(bookKey: string) {
    const bookArr0 = (await customStorage.getItem('favoriteBooks')) as string;
    const bookArr =
      bookArr0 !== '{}' && bookArr0 ? JSON5.parse(bookArr0 || '') : [];
    const index = bookArr.indexOf(bookKey);
    if (index > -1) {
      bookArr.splice(index, 1);
      bookArr.unshift(bookKey);
    } else {
      bookArr.unshift(bookKey);
    }

    customStorage.setItem('favoriteBooks', JSON.stringify(bookArr));
  }

  static setAllFavorite(books: BookModel[]) {
    const bookArr: string[] = [];
    books.forEach((item) => {
      bookArr.push(item.id);
    });
    customStorage.setItem('favoriteBooks', JSON.stringify(bookArr));
  }

  static async clear(bookKey: string) {
    const bookArr0 = (await customStorage.getItem('favoriteBooks')) as string;
    const bookArr =
      bookArr0 !== '{}' && bookArr0 ? JSON5.parse(bookArr0 || '') : [];
    const index = bookArr.indexOf(bookKey);
    if (index > -1) {
      bookArr.splice(index, 1);
    }
    customStorage.setItem('favoriteBooks', JSON.stringify(bookArr));
  }

  static async getAllFavorite() {
    const bookArr0 = (await customStorage.getItem('favoriteBooks')) as string;
    const bookArr =
      bookArr0 !== '{}' && bookArr0 ? JSON5.parse(bookArr0 || '') : [];
    return bookArr || [];
  }
}

export default AddFavorite;
