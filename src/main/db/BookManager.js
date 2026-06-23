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
import db, { getUserIdFromToken, addUserIdCreatedAt, assertUpdateField } from './dbManager';

const BOOK_UPDATABLE = new Set([
  'name', 'subtitle', 'author', 'description', 'cover', 'format',
  'publisher', 'category', 'from_library', 'size', 'path', 'charset',
  'favorite', 'bookshelf_id', 'key_in_storage', 'id_from_server',
  'first_opened_at', 'diagnostic_data',
]);

// Phase 5: pre-book diagnostic columns. Added at runtime via idempotent
// ALTER TABLE — the project ships a baseline sqlite_tables.db and has no
// migration framework, so additive columns are introduced here. Only the
// expected "duplicate column" error is swallowed; any other failure (DB
// locked, read-only, etc.) is surfaced so a real schema problem doesn't
// silently degrade later UPDATEs to "no such column" errors.
let schemaEnsured = false;
const ensureDiagnosticColumns = () => {
  if (schemaEnsured) return;
  schemaEnsured = true;
  const additions = [
    "ALTER TABLE book ADD COLUMN first_opened_at TEXT",
    "ALTER TABLE book ADD COLUMN diagnostic_data TEXT",
  ];
  additions.forEach((sql) => {
    try {
      db.exec(sql);
    } catch (err) {
      const msg = String(err?.message || err);
      if (/duplicate column/i.test(msg)) return; // expected on second launch
      console.error('[BookManager] schema-ensure failed:', sql, err);
    }
  });
};
ensureDiagnosticColumns();

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
    bookshelfId: card.bookshelf_id ?? -1,
    createdAt: card.created_at || '',
    userId: card.user_id || 0,
    firstOpenedAt: card.first_opened_at || '',
    diagnosticData: card.diagnostic_data || '',
  };
}

export const getBookById = (id, token) => {
  const userId = getUserIdFromToken(token);
  if( userId < 0) {
    console.warn('session is invalid, userid not found')
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
    console.warn('session is invalid, userid not found')
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
    console.warn('session is invalid, userid not found')
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
    console.warn('session is invalid, userid not found')
    return book;
  }
  addUserIdCreatedAt(book, userId);
  try {
    const name = book.name || '';
    const keyInStorage = book.keyInStorage || '';
    const idFromServer = book.idFromServer || -1;
    const subtitle = book.subtitle || '';
    const author = book.author || '';
    const description = book.description || '';
    const cover = book.cover || '';
    const format = book.format || '';
    const publisher = book.publisher || '';
    const category = book.category || '';
    const fromLibrary = book.fromLibrary ? 1 : 0;
    const size = book.size || '';
    const path = book.path || '';
    const charset = book.charset || '';
    const favorite = book.favorite ? 1 : 0;
    const bookshelfId = typeof book.bookshelfId === 'undefined' ? -1 : book.bookshelfId;
    const createdAt = book.createdAt || '';

    const stmt = db.prepare(
      'INSERT INTO book (name, key_in_storage, id_from_server, subtitle, author, description, cover, format, publisher, category, from_library, size, path, charset, favorite, bookshelf_id, created_at, user_id) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(
      name, keyInStorage, idFromServer, subtitle, author, description,
      cover, format, publisher, category, fromLibrary, size, path,
      charset, favorite, bookshelfId, createdAt, userId,
    );
    book.id = result.lastInsertRowid;
    return getBookById(book.id, token);
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
    console.warn('session is invalid, userid not found')
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
    console.warn('session is invalid, userid not found')
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
    console.warn('session is invalid, userid not found')
    return books;
  }
  if (!query) return getAllBooks(token);
  try {
    const stmt = db.prepare('SELECT * FROM book WHERE name LIKE ? or subtitle LIKE ? or description LIKE ?  ORDER BY created_at DESC');
    const pattern = `%${query}%`;
    for (const card of stmt.iterate(pattern, pattern, pattern)) {
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
    console.warn('session is invalid, userid not found')
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
    console.warn('session is invalid, userid not found')
    return -1;
  }
  console.log(` updatebook = ${  id  } field = ${  field  } value = ${  value}`)
  try {
    assertUpdateField('book', BOOK_UPDATABLE, field);
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
    console.warn('session is invalid, userid not found')
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
    console.warn('session is invalid, userid not found')
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
 * @param {*} token
 * @returns  1 or -1
 */
/**
 * Phase 5: mark a book as first-opened (idempotent — keeps the original
 * timestamp on subsequent calls). Returns 1 if the row was updated this
 * call, 0 if it was already marked, -1 on error.
 */
export function markBookFirstOpened(id, token) {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return -1;
  try {
    const row = db
      .prepare('SELECT first_opened_at FROM book WHERE id = ? AND user_id = ?')
      .get(id, userId);
    if (!row) return -1;
    if (row.first_opened_at) return 0;
    const ts = new Date().toISOString();
    db.prepare('UPDATE book SET first_opened_at = ? WHERE id = ? AND user_id = ?')
      .run(ts, id, userId);
    return 1;
  } catch (err) {
    console.error(err);
    return -1;
  }
}

/**
 * Phase 5: read the cached diagnostic JSON for a book (null if not run yet).
 */
export function getBookDiagnostic(id, token) {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return null;
  try {
    const row = db
      .prepare('SELECT diagnostic_data FROM book WHERE id = ? AND user_id = ?')
      .get(id, userId);
    if (!row || !row.diagnostic_data) return null;
    try { return JSON.parse(row.diagnostic_data); } catch (_) { return null; }
  } catch (err) {
    console.error(err);
    return null;
  }
}

/**
 * Phase 5: persist the diagnostic JSON for a book. Returns 1 on success, -1 on error.
 */
export function setBookDiagnostic(id, data, token) {
  const userId = getUserIdFromToken(token);
  if (userId < 0) return -1;
  try {
    const json = data == null ? null : JSON.stringify(data);
    db.prepare('UPDATE book SET diagnostic_data = ? WHERE id = ? AND user_id = ?')
      .run(json, id, userId);
    return 1;
  } catch (err) {
    console.error(err);
    return -1;
  }
}

