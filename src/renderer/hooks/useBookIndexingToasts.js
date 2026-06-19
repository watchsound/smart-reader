import { useEffect } from 'react';
import toast from 'react-hot-toast';

/**
 * Subscribes to book-indexing progress events from main and shows toasts.
 * Mount once at app root so the listener lives across route changes.
 *
 * Events: book-indexing-started / completed / failed — see BookIndexer.js.
 * Each toast is keyed on the bookId, so the loading toast morphs into the
 * success/error one rather than stacking.
 */
export default function useBookIndexingToasts() {
  useEffect(() => {
    const { ipcRenderer } = window.electron;

    const onStart = (payload) => {
      const { bookId, bookTitle } = payload || {};
      if (!bookId) return;
      toast.loading(`Indexing "${bookTitle || 'book'}"\u2026`, {
        id: `book-index-${bookId}`,
      });
    };

    const onDone = (payload) => {
      const { bookId, bookTitle, chunkCount = 0 } = payload || {};
      if (!bookId) return;
      // chunkCount === 0 means we ran but found nothing to embed (unsupported
      // format, empty doc, or embeddings disabled). Dismiss silently rather
      // than confusingly claiming success.
      if (chunkCount > 0) {
        toast.success(
          `Indexed "${bookTitle || 'book'}" (${chunkCount} chunks)`,
          { id: `book-index-${bookId}`, duration: 3000 },
        );
      } else {
        toast.dismiss(`book-index-${bookId}`);
      }
    };

    const onFail = (payload) => {
      const { bookId, bookTitle } = payload || {};
      if (!bookId) return;
      toast.error(`Failed to index "${bookTitle || 'book'}"`, {
        id: `book-index-${bookId}`,
        duration: 4000,
      });
    };

    const unsubStart = ipcRenderer.on('book-indexing-started', onStart);
    const unsubDone = ipcRenderer.on('book-indexing-completed', onDone);
    const unsubFail = ipcRenderer.on('book-indexing-failed', onFail);

    return () => {
      unsubStart?.();
      unsubDone?.();
      unsubFail?.();
    };
  }, []);
}
