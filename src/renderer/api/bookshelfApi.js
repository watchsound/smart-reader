/* eslint-disable promise/param-names */
/* eslint-disable prettier/prettier */

import customStorage from '../store/customStorage';

/**
  ,
  ,
  ,
  ,
 */

export async function createBookshelf(name) {
  let r = await customStorage.createBookshelf(name);
  return r;
}

export async function renameBookshelf(id, name) {
  const r = await customStorage.renameBookshelf(id, name);
  return r;
}


export async function getAllBookshelf( ) {
  const r = await customStorage.getAllBookshelf( );
  return r ?? null;
}


export async function deleteBookshelfById(bookshelfId) {
  const r = await customStorage.deleteBookshelfById(bookshelfId)
  return r;
}

export async function deleteAllBookshelf( ) {
  const r = await customStorage.deleteAllBookshelf( )
  return r;
}
export async function getBookshelfById(bookshelfId) {
  const r = await customStorage.getBookshelfById(bookshelfId)
  return r;
}
