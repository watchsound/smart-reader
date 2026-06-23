/**
 * Contract tests for BookModel — locks in field naming and positional
 * argument ordering. Regression: BookModel used to store the bookshelf
 * field as `bookShelfId` (camelCase with capital S), but every other
 * caller — dbRowToBook, BookManager.createBook, BookshelfView,
 * Neo4jAdapter, GraphSchema — reads `bookshelfId`. The case mismatch
 * was a silent footgun (file-imported books always defaulted to -1).
 *
 * @jest-environment node
 */

const Book = require('../../commons/model/Book');

describe('BookModel — field contract', () => {
  test('positional arguments map to lowercase-bookshelfId property', () => {
    const b = new Book(
      1,                  // id
      'storage-key',      // keyInStorage
      99,                 // idFromServer
      'Alice',            // name
      'Wonderland Tour',  // subtitle
      'Lewis Carroll',    // author
      'A classic',        // description
      'cover-id',         // cover
      'epub',             // format
      'Macmillan',        // publisher
      'fiction',          // category
      185.3,              // size
      '/path/to.epub',    // path
      'utf-8',            // charset
      '1700000000000',    // createdAt
      1,                  // favorite
      42,                 // bookshelfId
    );
    expect(b.name).toBe('Alice');
    expect(b.subtitle).toBe('Wonderland Tour');
    expect(b.favorite).toBe(true);
    expect(b.bookshelfId).toBe(42);
    expect(b.bookShelfId).toBeUndefined(); // legacy field name must NOT exist
  });

  test('undefined bookshelfId defaults to -1', () => {
    const b = new Book(
      1, 'k', -1, 'n', '', 'a', '', '', 'epub', '', '', 0, '', '', '0', 0,
    );
    expect(b.bookshelfId).toBe(-1);
  });

  test('bookshelfId 0 is preserved (not coerced to -1)', () => {
    // Regression: the previous `bookShelfId || -1` pattern would have
    // turned a legitimate shelf id of 0 into -1.
    const b = new Book(
      1, 'k', -1, 'n', '', 'a', '', '', 'epub', '', '', 0, '', '', '0', 0,
      0,
    );
    expect(b.bookshelfId).toBe(0);
  });
});
