/* eslint-disable promise/param-names */
/* eslint-disable prettier/prettier */
import { matchSorter } from "match-sorter";
import sortBy from "sort-by";
import { v4 as uuid } from 'uuid';
import customStorage from '../store/customStorage';


export async function getBookNotes(bookKey) {
  let notes = await customStorage.queryNoteBySourceKeyAndSourceType(bookKey, 'book');
  // let notes = await customStorage.queryCollection('note', bookKey, 'sourceKey');
  if (!notes) notes = [];
  return notes;
}

export async function getBookNote(noteId) {
  const note = await customStorage.getNoteById(noteId);
  return note ?? null;
  // const notes = await getBookNotes(bookKey);
  // const note = notes.find(anote => anote.id === noteKey);
  // return note ?? null;
}


// export async function saveBookAnnotations(bookKey,annotations) {
//    return customStorage.setItem(`${bookKey}-annotation`, annotations);
// }


//  async function upsertBookAnnotation(bookKey,annotation) {
//   const a = await customStorage.upSertCollectionInStore(`${bookKey}-annotation`, 'id', annotation.id, annotation);
//   return a;
// }

// async function upsertBookNote(bookKey,note) {
//   let n = note;
//    if (!note.sourceKey) n = {...note, sourceKey: bookKey};
//    const a = await customStorage.upSertCollectionInStore('note', 'id', n.id, n);
//    return a;
// }

export async function saveBookNote(bookKey,note) {
  note.sourceKey = bookKey;
  note.sourceType = 'book';
  const r = await customStorage.createNote(note)
  return r;
  // upsertBookNote(bookKey, note);
}
export async function updateBookNote(bookKey,noteId, note) {
  note.sourceKey = bookKey;
  note.sourceType = 'book';
  const r = await customStorage.replaceNote(noteId, note)
  return r;
  // upsertBookNote(bookKey, note);
}

export async function clearBookNotes(bookKey) {
  const r = await customStorage.clearNotesBy(bookKey, 'book');
  return r;
  // await customStorage.deleteCollectionInStore('note', 'sourceKey', bookKey);
  // return true;
}

// export async function deleteBookAnnotation(bookKey, id) {
//   await customStorage.deleteCollectionInStore(`${bookKey}-annotation`, 'id', id);
//   return true;
// }


export async function getBooksByBookshelfId(bookshelfId) {
  const books =  await customStorage.getBooksByBookshelfId(bookshelfId);
  return books??[];
}

export async function getBooksByQuery(query) {
  const books =  await customStorage.getBooksByQuery(query);
  return books??[];
  // let books = await customStorage.getItem("books");
  // if (!books) books = [];
  // if (query) {
  //   books = matchSorter(books, query, { keys: ["name", "category"] });
  // }
  // return books.sort(sortBy("createdAt"));
}

export async function getBooksByCategory(query) {
  const books =  await customStorage.getBooksByCategory(query);
  return books??[];
  // let books = await customStorage.getItem("books");
  // if (!books) books = [];
  // if (query) {
  //   books = matchSorter(books, query, { keys: ["category"] });
  // }
  // return books.sort(sortBy("createdAt"));
}

// export async function saveBooksToDB(books) {
//   await customStorage.setItem('books', books);
//   return books;
// }

export async function getBookById(id) {
  const book = await customStorage.getBookById(id);
  return book ?? null;
}

export async function updateBook({id,  field, value}) {
  const r = await customStorage.updateBook(id,  field, value);
  return r ?? null;
  // if( typeof id === 'string' && updates){
  //   const b = await customStorage.upsertCollectionInStore('books', 'id', id, updates);
  //   return b;
  // }
  // if( typeof id.id === 'string' ){
  //   const b = await customStorage.upsertCollectionInStore('books', 'id', id.id, id);
  //   return b;
  // }
  // throw new Error("input parameters are wrong for updateNote. id = ", id);
}

export async function deleteBook(id) {
  const r = await customStorage.deleteBook(id);
  return r ?? null;
  // await customStorage.deleteCollectionInStore('books', 'id', id);
  // return false;
}

export async function clearAllBooks() {
  const r = await customStorage.clearAllBooks();
  return r ?? null;
  // await customStorage.setItem('books', []);
  // return true;
}

export async function getImage(id) {
  if( !id ) return null
  const r = await customStorage.getImage(id);
  return r ?? null;
 // return customStorage.getItem(`_img_${id}`);
}

export async function createImage( image ) {
  const r = await customStorage.createImage( image );
  return r ?? null;
  // await customStorage.setItem(`_img_${id}`, image);
  // return true;
}

