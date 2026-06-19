/**
 * BookChunker.test.js
 *
 * Unit tests for the PDF chunker shape contract — what feeds
 * vectorManager.addBookChunks(bookId, chunks, token). The EPUB path
 * runs in the renderer (epubjs needs a DOM) and is exercised by the
 * smoke test instead.
 */

jest.mock('electron', () => ({
  ipcMain: { on: jest.fn(), off: jest.fn() },
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

// Simulated pdf-parse: invoke options.pagerender once per fake page, with
// a getTextContent that resolves to the items array we configure.
let mockPages = [];
jest.mock('pdf-parse/lib/pdf-parse', () =>
  jest.fn(async (_buffer, options) => {
    for (const pageItems of mockPages) {
      // eslint-disable-next-line no-await-in-loop
      await options.pagerender({
        getTextContent: () => Promise.resolve({ items: pageItems }),
      });
    }
    return {};
  }),
);

const fs = require('fs');
const { chunkPDF } = require('../../main/utils/BookChunker');

const mkItem = (str, y) => ({ str, transform: [0, 0, 0, 0, 0, y] });

describe('BookChunker.chunkPDF', () => {
  beforeEach(() => {
    mockPages = [];
    fs.existsSync.mockReset();
    fs.readFileSync.mockReset();
  });

  it('returns [] when file does not exist', async () => {
    fs.existsSync.mockReturnValue(false);
    const result = await chunkPDF('/no/such/file.pdf');
    expect(result).toEqual([]);
    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  it('returns [] when path is empty', async () => {
    const result = await chunkPDF('');
    expect(result).toEqual([]);
  });

  it('emits one chunk per non-empty page with shape {text, chunkIndex, pageNum}', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(Buffer.from('fake-pdf'));
    mockPages = [
      [mkItem('hello ', 700), mkItem('world', 700)],
      [mkItem('second page', 700)],
      [mkItem('third', 700)],
    ];

    const chunks = await chunkPDF('/fake.pdf');
    expect(chunks).toHaveLength(3);

    expect(chunks[0]).toEqual({
      text: 'hello world',
      chunkIndex: 0,
      pageNum: 1,
    });
    expect(chunks[1]).toEqual({
      text: 'second page',
      chunkIndex: 1,
      pageNum: 2,
    });
    expect(chunks[2]).toEqual({ text: 'third', chunkIndex: 2, pageNum: 3 });
  });

  it('drops pages whose accumulated text is whitespace-only', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(Buffer.from('fake-pdf'));
    mockPages = [
      [mkItem('  ', 700), mkItem('\t', 700)],
      [mkItem('real content', 700)],
    ];

    const chunks = await chunkPDF('/fake.pdf');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({
      text: 'real content',
      chunkIndex: 0,
      pageNum: 2,
    });
  });

  it('inserts a newline when y-coordinate changes (line break)', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(Buffer.from('fake-pdf'));
    mockPages = [
      [mkItem('line one', 700), mkItem('line two', 680)],
    ];

    const chunks = await chunkPDF('/fake.pdf');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('line one\nline two');
  });

  it('returns [] when pdf-parse throws', async () => {
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockImplementation(() => {
      throw new Error('disk read failed');
    });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const chunks = await chunkPDF('/fake.pdf');
    expect(chunks).toEqual([]);
    consoleSpy.mockRestore();
  });
});
