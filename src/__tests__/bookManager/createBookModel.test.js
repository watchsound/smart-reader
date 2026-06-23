/**
 * Regression: createBookModel used to derive `extension` from `filePath`
 * (the user's source filename). When importBookFromFile / importBookFromServer
 * converts a doc/docx to pdf or epub, `filePath` still ends in `.docx` while
 * `outPath` ends in `.pdf` / `.epub`. The book was therefore stored with
 * `format='docx'` even though the on-disk file was PDF/EPUB, leaving the
 * reader unable to open it.
 *
 * Pair fix: the missing `await` on `handleDocFile` in both importers
 * (the conversion happened in the background and was silently orphaned).
 *
 * @jest-environment node
 */

// Heavy bookUtil deps that fail to import in a node test env without an
// Electron context. Each mock returns a minimal usable surface.
jest.mock('mammoth', () => ({ images: { imgElement: jest.fn() }, convertToHtml: jest.fn() }));
jest.mock('pdf-parse/lib/pdf-parse', () => jest.fn());
jest.mock('jsdom', () => ({ JSDOM: jest.fn() }));
jest.mock('epubjs', () => ({ Book: jest.fn() }));
jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('adm-zip', () => jest.fn());
jest.mock('fs-extra', () => ({}));
jest.mock('react-device-detect', () => ({ isElectron: false }));
jest.mock('react-hot-toast', () => ({ default: jest.fn() }));
jest.mock('electron', () => ({ dialog: { showOpenDialog: jest.fn() } }));
jest.mock('../../main/db/ImageManager', () => ({ createImage: jest.fn() }));

const BookUtilModule = require('../../main/utils/bookUtil');
const BookUtil = BookUtilModule.default;
const { normalizeMetadataField, coerceStringField } = BookUtilModule;

beforeEach(() => {
  jest.spyOn(BookUtil, 'createMD5').mockResolvedValue('mock-md5');
  jest.spyOn(BookUtil, 'getFileSize').mockReturnValue(100);
  // generateBook is the seam — capture what arguments it receives.
  jest.spyOn(BookUtil, 'generateBook').mockResolvedValue({ ok: true });
});
afterEach(() => {
  jest.restoreAllMocks();
});

describe('createBookModel — extension derivation', () => {
  test('uses outPath extension when source and converted differ (docx→pdf)', async () => {
    await BookUtil.createBookModel(
      'key-1',
      'C:/Users/me/foo.docx',
      'C:/storage/book/key-1.pdf',
      Buffer.from('pdf-bytes'),
    );
    expect(BookUtil.generateBook).toHaveBeenCalled();
    const [, bookName, extension] = BookUtil.generateBook.mock.calls[0];
    expect(extension).toBe('pdf');
    // bookName must still come from the user's filename, not the storage uuid
    expect(bookName).toBe('foo');
  });

  test('docx→epub conversion records format as epub', async () => {
    await BookUtil.createBookModel(
      'key-2',
      'C:/Users/me/notes.docx',
      'C:/storage/book/key-2.epub',
      Buffer.from('epub-bytes'),
    );
    const [, , extension] = BookUtil.generateBook.mock.calls[0];
    expect(extension).toBe('epub');
  });

  test('source and converted match (epub import) → epub', async () => {
    await BookUtil.createBookModel(
      'key-3',
      'C:/Users/me/book.epub',
      'C:/storage/book/key-3.epub',
      Buffer.from('epub-bytes'),
    );
    const [, , extension] = BookUtil.generateBook.mock.calls[0];
    expect(extension).toBe('epub');
  });

  test('mixed-case outPath extension is lowercased', async () => {
    await BookUtil.createBookModel(
      'key-4',
      'C:/Users/me/book.PDF',
      'C:/storage/book/key-4.PDF',
      Buffer.from('pdf-bytes'),
    );
    const [, , extension] = BookUtil.generateBook.mock.calls[0];
    expect(extension).toBe('pdf');
  });

  describe('normalizeMetadataField — server-shape tolerance', () => {
    test('plain string passes through', () => {
      expect(normalizeMetadataField('Lewis Carroll')).toBe('Lewis Carroll');
    });

    test('array of {name} objects extracts first name (legacy shape)', () => {
      expect(normalizeMetadataField([{ name: 'Lewis Carroll' }, { name: 'Other' }]))
        .toBe('Lewis Carroll');
    });

    test('array of strings extracts first', () => {
      expect(normalizeMetadataField(['Lewis Carroll', 'Other'])).toBe('Lewis Carroll');
    });

    test('plain {name} object extracts name', () => {
      expect(normalizeMetadataField({ name: 'Lewis Carroll' })).toBe('Lewis Carroll');
    });

    test('null / undefined / empty array / empty string → empty string', () => {
      expect(normalizeMetadataField(null)).toBe('');
      expect(normalizeMetadataField(undefined)).toBe('');
      expect(normalizeMetadataField([])).toBe('');
      expect(normalizeMetadataField('')).toBe('');
    });

    test('array with non-name first element returns empty (no fake undefined)', () => {
      // Regression guard for the original bug: the OLD code did
      // book.author[0].name on a string-array, getting undefined and
      // assigning it to a column. Normalize must NOT do that.
      expect(normalizeMetadataField([{ notName: 'X' }])).toBe('');
    });
  });

  describe('coerceStringField — SQLite-bind safety for text fields', () => {
    // Same crash class as the favorite-boolean fix earlier — better-sqlite3
    // rejects objects, so a server returning `description: {…}` would crash
    // INSERT. This helper is the boundary guard.
    test('string passes through', () => {
      expect(coerceStringField('A classic novel')).toBe('A classic novel');
    });
    test('object becomes empty string (no [object Object] in column)', () => {
      expect(coerceStringField({ html: '<p>hi</p>' })).toBe('');
    });
    test('null / undefined / number / array become empty string', () => {
      expect(coerceStringField(null)).toBe('');
      expect(coerceStringField(undefined)).toBe('');
      expect(coerceStringField(42)).toBe('');
      expect(coerceStringField(['a', 'b'])).toBe('');
    });
    test('empty string is preserved', () => {
      expect(coerceStringField('')).toBe('');
    });
  });

  test('size is measured from outPath (saved file), not filePath (source)', async () => {
    // Regression: file size used to come from filePath. After docx→pdf
    // conversion the source is the original docx (smaller) but the actual
    // on-disk artifact is the converted PDF. Recording the source size is
    // wrong — it diverges from what the user paid for in disk space.
    await BookUtil.createBookModel(
      'key-5',
      'C:/Users/me/foo.docx',
      'C:/storage/book/key-5.pdf',
      Buffer.from('pdf-bytes'),
    );
    expect(BookUtil.getFileSize).toHaveBeenCalledWith('C:/storage/book/key-5.pdf');
    expect(BookUtil.getFileSize).not.toHaveBeenCalledWith('C:/Users/me/foo.docx');
  });
});
