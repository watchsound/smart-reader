/* eslint-disable no-restricted-syntax */
/* eslint-disable prettier/prettier */
/**
 CREATE TABLE "book" (
  "id"  INTEGER PRIMARY KEY,
  "key_in_storage" TEXT,
  "id_from_server" INTEGER,
  "name"  TEXT,
  "subtitle" TEXT,
  "author"  TEXT,
  "description" TEXT,
  "cover"  TEXT,
  "format" TEXT,
  "publisher"  TEXT,
  "category" TEXT,
  "from_library" INTEGER,
  "size" INTEGER,
  "path" TEXT,
  "charset"  TEXT,
  "favorite"  INTEGER,
  "bookshelf_id"  INTEGER,
  "created_at" TEXT,
  "user_id"  INTEGER
);

 *
 */
import db, { getUserIdFromToken, addUserIdCreatedAt, escapeString } from './dbManager';

const dbRowToBook = (card) => {
  return {
    id : card.id,
    name:  card.name || '',
    keyInStorage: card.key_in_storage || '',
    idFromServer: card.id_from_server || -1,
    subtitle: card.subtitle || '',
    author: card.author || '',
    description: card.description || '',
    cover: card.cover || '',
    format: card.format || '',
    publisher: card.publisher || '',
    category: card.category || '',
    fromLibrary: card.from_library || 0,
    size: card.size || 0,
    path: card.path || '',
    charset: card.charset || '',
    favorite: card.favorite || 0,
    bookshelfId: card.bookshelf_id  ,
    createdAt: card.created_at || '',
    userId: card.user_id || 0,
  };
}

export const getBookById = (id, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return null;
  }
  try {
    const stmt = db.prepare('SELECT * FROM book WHERE id = ? and user_id = ?');
    const book = stmt.get(id, userId);
    if (book) return dbRowToBook(book);
    return null;
  } catch (err) {
    console.error(err);
    return null;
  }
};
export const getBookByIdFromServer = (idFromServer, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return null;
  }
  try {
    const stmt = db.prepare('SELECT * FROM book WHERE id_from_server = ? and user_id = ?');
    const book = stmt.get(idFromServer, userId);
    if (book) return dbRowToBook(book);
    return null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

export const getBookByKeyInStorage = (keyInStorage, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return null;
  }
  try {
    const stmt = db.prepare('SELECT * FROM book WHERE key_in_storage = ? and user_id = ?');
    const book = stmt.get(keyInStorage, userId);
    if (book) return dbRowToBook(book);
    return null;
  } catch (err) {
    console.error(err);
    return null;
  }
};

/**
 *
 * @param {*} book
 * @param {*} token
 * @returns book.  if book.id  means success
 */
export const createBook = (book, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return book;
  }
  addUserIdCreatedAt(book, userId);
  try {
    const name =     escapeString( book.name || '' );
    const keyInStorage = book.keyInStorage || '';
    const idFromServer = book.idFromServer || -1;
    const subtitle =   escapeString(  book.subtitle || '');
    const author =    escapeString(  book.author || '');
    const  description =   escapeString(  book.description || '');
    const  cover =    escapeString( book.cover || '');
    const  format =    escapeString( book.format || '');
    const  publisher =   escapeString(  book.publisher || '');
    const  category =  escapeString(  book.category || '');
    const  fromLibrary = book.fromLibrary ? 1 : 0,
    const  size =   book.size || '';
    const  path =   book.path || '';
    const  charset =   book.charset || '';
    const  favorite =   book.favorite || 0;
    const  bookshelfId =  typeof book.bookshelfId === 'undefined' ? -1 : book.bookshelfId;
    const  createdAt =   book.createdAt || '';



    const stmt = db.prepare(
      'INSERT INTO book (name, key_in_storage, id_from_server, subtitle, author,description,cover,format,publisher,category,from_library,size,path,charset,favorite, bookshelf_id, created_at,user_id) ' +
      `VALUES ('${name}', '${keyInStorage}', ${idFromServer}, '${subtitle}','${author}','${description}','${cover}','${format}','${publisher}','${category}', ${fromLibrary},${size},'${path}','${charset}', ${favorite}, ${bookshelfId},  '${createdAt}',${userId}) `
    );
    const result = stmt.run();
    book.id = result.lastInsertRowid;
    return getBookById(book.id);
  } catch (err) {
    console.error(err);
  }
  return book;
};

export const getBooks = (token) => {
  return this.getBooksByCategory('', token);
}



/**
 *
 * @param {*} category
 * @param {*} token
 * @returns return list of books
 */
export const getBooksByCategory = (category, token) => {
  const books = [];
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return books;
  }
  try {
    const stmt = category ?
       db.prepare('SELECT * FROM book WHERE category = ? AND user_id = ?  ORDER BY created_at DESC').bind(category, userId)
       :
       db.prepare('SELECT * FROM book WHERE  user_id = ?  ORDER BY created_at DESC').bind( userId);


    for (const card of stmt.iterate()) {
       books.push(dbRowToBook(card));
    }
    return books;
  } catch (err) {
    console.error(err);
    return books;
  }
};

export const getAllBooks = (token) => {
  const books = [];
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return books;
  }
  try {
    const stmt = db.prepare('SELECT * FROM book  ORDER BY created_at DESC ');
    for (const card of stmt.iterate()) {
      if (card.user_id === userId) {
        books.push(dbRowToBook(card));
      }
    }
    return books;
  } catch (err) {
    console.error(err);
    return books;
  }
};

/**
 *
 * @param {*} query
 * @param {*} token
 * @returns a list of books
 */
export const getBooksByQuery = (query, token) => {
  const books = [];
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return books;
  }
  if (!query) return getAllBooks(token);
  try {
    const stmt = db.prepare('SELECT * FROM book WHERE name LIKE ? or subtitle LIKE ? or description LIKE ?  ORDER BY created_at DESC').bind(`'%${query}%'`, `'%${query}%'`, `'%${query}%'`);
    for (const card of stmt.iterate()) {
      if (card.user_id === userId) {
        books.push(dbRowToBook(card));
      }
    }
    return books;
  } catch (err) {
    console.error(err);
    return books;
  }
};



/**
 *
 * @param {*} bookshelfId
 * @param {*} token
 * @returns a list of books
 */
export const getBooksByBookshelfId = (bookshelfId, token) => {
  const books = [];
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return books;
  }
  try {
    const stmt = db.prepare('SELECT * FROM book WHERE bookshelf_id = ?  ORDER BY created_at DESC').bind(bookshelfId);
    for (const card of stmt.iterate()) {
      if (card.user_id === userId) {
        books.push(dbRowToBook(card));
      }
    }
    return books;
  } catch (err) {
    console.error(err);
    return books;
  }
};

/**
 *
 * @param {*} id
 * @param {*} field
 * @param {*} value
 * @param {*} token
 * @returns  1  or  -1
 */
export function updateBook(id, field, value, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  console.log(` updatebook = ${  id  } field = ${  field  } value = ${  value}`)
  try {
    // Assuming the field is at the root of the JSON object.
    const sql = `UPDATE book SET ${field} = ? WHERE id = ? AND user_id = ?`;
    const query = db.prepare(sql);
    query.run( [value, id, userId]);
  return 1;
  } catch (err) {
    console.error(err);
    return -1;
  }
}

/**
 *
 * @param {*} bookId bookId id
 * @param {*} newId bookshelf id , if -1, no bookshelf
 * @param {*} token
 * @returns   1  or -1
 */
export function changeBookshelf(bookId, newId, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    // Assuming the field is at the root of the JSON object.
    const sql = `UPDATE book SET bookshelf_id  = ${newId} WHERE id = ${bookId} AND user_id = ${userId}`;
    console.log(sql);
    const query = db.prepare(sql);
    query.run();
    return 1;
  } catch (err) {
    console.error(err);
    return -1;
  }
}

export function deleteBookshelf(bookshelfId, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    // Assuming the field is at the root of the JSON object.
    const sql = `UPDATE book SET bookshelf_id  = -1 WHERE bookshelf_id = ${bookshelfId} AND user_id = ${userId}`;
    console.log(sql);
    const query = db.prepare(sql);
    query.run();
    return 1;
  } catch (err) {
    console.error(err);
    return -1;
  }
}
/**
 *
 * @param {*} id
 * @param {*} token
 * @returns  1 or -1
 */
export function deleteBookById(id, token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `
        DELETE FROM book
        WHERE id = ? AND user_id = ?
    `;
    const query = db.prepare(sql);
    query.run( [id, userId] );
    return 1;
  } catch (err) {
    console.error(err);
    return -1;
  }
}

/**
 *
 * @param {*} token
 * @returns  1 or -1
 */
export function deleteAllBook(token) {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.log('session is invalid, userid not found')
    return -1;
  }
  try {
    const sql = `
        DELETE FROM book
        WHERE  user_id = ?
    `;
    const query = db.prepare(sql);
    query.run( [userId] );
    return 1;
  } catch (err) {
    console.error(err);
    return -1;
  }
}
