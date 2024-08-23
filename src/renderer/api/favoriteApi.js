/* eslint-disable no-restricted-syntax */
import { matchSorter } from 'match-sorter';
import JSON5 from 'json5';
import sortBy from 'sort-by';
import customStorage from '../store/customStorage';

export async function setFavorite(bookKey) {
  const bookArr0 = await customStorage.getItem('favoriteBooks');
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
export async function setAllFavorite(books) {
  const bookArr = [];
  books.forEach((item) => {
    bookArr.push(item.id);
  });
  customStorage.setItem('favoriteBooks', JSON.stringify(bookArr));
}
export async function clearFavorite(bookKey) {
  const bookArr0 = await customStorage.getItem('favoriteBooks');
  const bookArr =
    bookArr0 !== '{}' && bookArr0 ? JSON5.parse(bookArr0 || '') : [];
  const index = bookArr.indexOf(bookKey);
  if (index > -1) {
    bookArr.splice(index, 1);
  }
  customStorage.setItem('favoriteBooks', JSON.stringify(bookArr));
}
export async function getAllFavorite() {
  const bookArr0 = await customStorage.getItem('favoriteBooks');
  const bookArr =
    bookArr0 !== '{}' && bookArr0 ? JSON5.parse(bookArr0 || '') : [];
  return bookArr || [];
}
