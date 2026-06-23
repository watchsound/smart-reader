/**
 * Regression: BookModel constructor coerces `favorite` to a boolean (`!!favorite`).
 * BookManager.createBook used to forward `book.favorite || 0`, which kept the boolean
 * intact — and better-sqlite3 rejects booleans with
 *   "SQLite3 can only bind numbers, strings, bigints, buffers, and null"
 * Crash repro happened on every EPUB import (logged 2026-06-20).
 *
 * @jest-environment node
 */

const runMock = jest.fn(() => ({ changes: 1, lastInsertRowid: 42 }));
const getMock = jest.fn(() => undefined);

const mockDb = {
  prepare: jest.fn(() => ({ run: runMock, get: getMock, all: jest.fn(() => []) })),
  exec: jest.fn(),
};

jest.mock('../../main/db/dbManager', () => ({
  __esModule: true,
  default: mockDb,
  getUserIdFromToken: jest.fn(() => 1),
  addUserIdCreatedAt: jest.fn((obj, userId) => {
    obj.userId = userId;
    obj.createdAt = String(Date.now());
  }),
  assertUpdateField: jest.fn(),
}));

const { createBook } = require('../../main/db/BookManager');

beforeEach(() => {
  runMock.mockClear();
  mockDb.prepare.mockClear();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('BookManager.createBook — favorite/bind safety', () => {
  test('boolean true favorite (from BookModel !!(-1)) is bound as integer 1', () => {
    createBook({ name: 'Alice', favorite: true }, 'tok');
    expect(runMock).toHaveBeenCalled();
    const args = runMock.mock.calls[0];
    // Positional bind: name, keyInStorage, idFromServer, subtitle, author,
    // description, cover, format, publisher, category, fromLibrary, size,
    // path, charset, favorite, bookshelfId, createdAt, userId — favorite is 15th (index 14).
    expect(args[14]).toBe(1);
    expect(typeof args[14]).toBe('number');
  });

  test('boolean false favorite is bound as integer 0', () => {
    createBook({ name: 'Alice', favorite: false }, 'tok');
    const args = runMock.mock.calls[0];
    expect(args[14]).toBe(0);
  });

  test('numeric 1 favorite stays 1', () => {
    createBook({ name: 'Alice', favorite: 1 }, 'tok');
    expect(runMock.mock.calls[0][14]).toBe(1);
  });

  test('undefined favorite defaults to 0', () => {
    createBook({ name: 'Alice' }, 'tok');
    expect(runMock.mock.calls[0][14]).toBe(0);
  });

  test('every bound value is a SQLite-safe primitive (no booleans)', () => {
    createBook({ name: 'Alice', favorite: true, fromLibrary: true }, 'tok');
    const args = runMock.mock.calls[0];
    for (const v of args) {
      expect(['number', 'string', 'bigint']).toContain(typeof v);
    }
  });
});
