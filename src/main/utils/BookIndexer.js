/**
 * BookIndexer.js
 *
 * Runs the chunk → store flow at book-import time and emits progress events
 * the renderer can translate into toasts. Wrapping the fire-and-forget chain
 * here keeps main.ts's import handlers small and gives a single spot to
 * adjust event shape later.
 *
 * Events sent to the renderer:
 *   book-indexing-started   { bookId, bookTitle }
 *   book-indexing-completed { bookId, bookTitle, chunkCount }
 *   book-indexing-failed    { bookId, bookTitle, error }
 */

import { chunkBookForVector } from './BookChunker';
import vectorManager from './VectorManager';

function send(mainWin, channel, payload) {
  try {
    mainWin?.webContents?.send(channel, payload);
  } catch (e) {
    // Renderer closed mid-import; the toast just won't show.
    console.warn(`BookIndexer.send(${channel}):`, e?.message || e);
  }
}

/**
 * Chunk + store + emit progress events. Always returns; never throws.
 *
 * @param {Electron.BrowserWindow} mainWin
 * @param {{id:string|number, path:string, format:string, title?:string}} book
 * @param {string} token
 */
export async function indexBookWithProgress(mainWin, book, token) {
  if (!book || !book.path || !book.format) return;

  const meta = {
    bookId: String(book.id),
    bookTitle: book.title || 'Untitled',
  };

  send(mainWin, 'book-indexing-started', meta);

  try {
    const chunks = await chunkBookForVector(mainWin, book);
    let chunkCount = 0;
    if (chunks.length > 0) {
      const result = await vectorManager.addBookChunks(book.id, chunks, token);
      chunkCount = result?.chunksCreated || 0;
    }
    send(mainWin, 'book-indexing-completed', { ...meta, chunkCount });
  } catch (err) {
    console.error('BookIndexer: indexing failed', err);
    send(mainWin, 'book-indexing-failed', {
      ...meta,
      error: err?.message || String(err),
    });
  }
}
