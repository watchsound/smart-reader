/**
 * BookChunker.js
 *
 * Produces vector-store-ready chunks from EPUB and PDF books at import time.
 * Chunks are shaped for `vectorManager.addBookChunks(bookId, chunks, token)`:
 *
 *   EPUB → { text, chunkIndex, cfi, sectionTitle }
 *   PDF  → { text, chunkIndex, pageNum }
 *
 * EPUB parsing has to happen in the renderer (epub.js needs DOM). The PDF
 * path uses pdf-parse main-side. Both return a plain array of chunks.
 */

import { ipcMain } from 'electron';
import fs from 'fs';
import pdf from 'pdf-parse/lib/pdf-parse';

const DEFAULT_MAX_CHUNK_SIZE = 250;
const EPUB_TIMEOUT_MS = 60_000;

/**
 * Parse a PDF page-by-page and emit one chunk per page (the original
 * ChromaManager.addPDFToVecterDB granularity). Pages with no text are
 * dropped. Returns `[]` on read or parse failure rather than throwing,
 * so a bad PDF doesn't break the import.
 *
 * @param {string} filePath
 * @returns {Promise<Array<{text:string, chunkIndex:number, pageNum:number}>>}
 */
export async function chunkPDF(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];

  const chunks = [];
  let pageIndex = 0;

  function renderPage(pageData) {
    pageIndex += 1;
    const currentPage = pageIndex;
    const options = {
      normalizeWhitespace: false,
      disableCombineTextItems: false,
    };
    return pageData.getTextContent(options).then((textContent) => {
      let lastY;
      let text = '';
      for (const item of textContent.items) {
        if (lastY === item.transform[5] || lastY === undefined) {
          text += item.str;
        } else {
          text += `\n${item.str}`;
        }
        lastY = item.transform[5];
      }
      const trimmed = text.trim();
      if (trimmed.length > 0) {
        chunks.push({
          text: trimmed,
          chunkIndex: chunks.length,
          pageNum: currentPage,
        });
      }
      return text;
    });
  }

  try {
    const buffer = fs.readFileSync(filePath);
    await pdf(buffer, { pagerender: renderPage });
    return chunks;
  } catch (e) {
    console.error('BookChunker.chunkPDF:', e.message || e);
    return [];
  }
}

/**
 * Ask the renderer to parse an EPUB and ship back a chunk array. Uses a
 * requestId so concurrent imports don't cross-talk. Resolves to `[]`
 * after EPUB_TIMEOUT_MS if the renderer never replies (e.g. window closed
 * mid-import) — caller treats empty as "no chunks indexed," not a crash.
 *
 * @param {Electron.BrowserWindow} mainWin
 * @param {string} bookKey
 * @param {string} filePath
 * @param {number} maxChunkSize
 * @returns {Promise<Array<{text:string, chunkIndex:number, cfi:string, sectionTitle:string|null}>>}
 */
export function requestEPubChunks(
  mainWin,
  bookKey,
  filePath,
  maxChunkSize = DEFAULT_MAX_CHUNK_SIZE,
) {
  if (!mainWin || !mainWin.webContents || !filePath) {
    return Promise.resolve([]);
  }

  const requestId = `epub_${bookKey}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  return new Promise((resolve) => {
    let settled = false;

    const onReply = (_event, payload) => {
      if (settled) return;
      if (!payload || payload.requestId !== requestId) return;
      settled = true;
      ipcMain.off('epub-chunks-extracted', onReply);
      clearTimeout(timer);
      resolve(Array.isArray(payload.chunks) ? payload.chunks : []);
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      ipcMain.off('epub-chunks-extracted', onReply);
      console.warn(
        `BookChunker.requestEPubChunks: timeout for book ${bookKey}`,
      );
      resolve([]);
    }, EPUB_TIMEOUT_MS);

    ipcMain.on('epub-chunks-extracted', onReply);

    try {
      mainWin.webContents.send('extract-epub-chunks', {
        requestId,
        bookKey: String(bookKey),
        filePath,
        maxChunkSize,
      });
    } catch (e) {
      if (settled) return;
      settled = true;
      ipcMain.off('epub-chunks-extracted', onReply);
      clearTimeout(timer);
      console.error('BookChunker.requestEPubChunks: send failed', e);
      resolve([]);
    }
  });
}

/**
 * Dispatch on book.format. Returns the chunk array for whichever path
 * applies, or `[]` if the format isn't supported.
 *
 * @param {Electron.BrowserWindow} mainWin
 * @param {{id:string|number, path:string, format:string}} book
 * @param {number} maxChunkSize
 */
export async function chunkBookForVector(
  mainWin,
  book,
  maxChunkSize = DEFAULT_MAX_CHUNK_SIZE,
) {
  if (!book || !book.path) return [];
  if (book.format === 'pdf') {
    return chunkPDF(book.path);
  }
  if (book.format === 'epub') {
    return requestEPubChunks(mainWin, book.id, book.path, maxChunkSize);
  }
  return [];
}
