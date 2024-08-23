/* eslint-disable promise/param-names */
/* eslint-disable prettier/prettier */
// import { matchSorter } from "match-sorter";
import sortBy from "sort-by";
import customStorage from '../store/customStorage';


// export async function saveNotes(notes) {
//    customStorage.setItem("note", notes);
// }


export async function getNotesByQuery({query, tag, star, page, limit}) {
  const notes = await customStorage.getNotesByQuery({query, tag, star, page, limit});
  return notes;
}



export async function createNote(note) {
  const note2 = await customStorage.createNote(note);
  return note2?? null;
  // if (typeof note.id === 'undefined')
  //   note.id = Math.random().toString(36).substring(2, 9);
  // if (typeof note.createdAt === 'undefined')
  //   note.createdAt = Date.now();
  // await customStorage.upSertCollectionInStore('note', 'id', note.id, note);
  // return note;
}

export async function getNoteById(id) {
  const note2 = await customStorage.getNoteById(id);
  return note2?? null;
  // const note= await customStorage.getOneInCollection('note', 'id', id);
  // return note ?? null;
}
export async function replaceNote(noteId, note) {
  const note2 = await customStorage.replaceNote(noteId,note);
  return note2?? null;
  // const note = await customStorage.upSertCollectionInStore('note', 'id', id, updates);
  // return note;
}

export async function updateNote(noteId, field, value) {
  const note2 = await customStorage.updateNote(noteId, field, value);
  return note2?? null;
  // const note = await customStorage.upSertCollectionInStore('note', 'id', id, updates);
  // return note;
}

export async function deleteNoteById(id) {
  const r = await customStorage.deleteNoteById(id);
  return r;
  // await customStorage.deleteCollectionInStore("note", 'id', id);
  // return true;
}

export async function deleteAllNote() {
  const r = await customStorage.deleteAllNote();;
  return r;
}
