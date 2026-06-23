/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { isElectron } from 'react-device-detect';
import toast from 'react-hot-toast';
import customStorage from '../store/customStorage';

// const isElectron = true;
class BookUtil {
  static async RedirectBook(book, history) {
    const e = await window.electron.ipcRenderer.isBookExist(book.id, book.path);
    if (!e)  {
      toast.error('Book not exist');
      return;
    }
    const isOpenInMain = await customStorage.getReaderConfig('isOpenInMain');
    if (isOpenInMain === 'yes') {
      history.pushState({}, '', `${BookUtil.getBookUrl(book)}?title=${book.name}`);
      return;
    }

    const ref = book.format.toLowerCase();

    if (isElectron) {
      const isFullscreen = await customStorage.getReaderConfig('isAutoFullscreen');
      const isPreventSleep = await customStorage.getReaderConfig('isPreventSleep');
      const isMergeWord = await customStorage.getReaderConfig('isMergeWord');

      window.electron.ipcRenderer.invoke('open-book', {
        url: `${window.location.href.split('#')[0]}#/${ref}/${book.id}?title=${book.name}`,
        isMergeWord:
          ref === 'pdf' || ref === 'djvu' ? 'no' : isMergeWord,
        isFullscreen,
        isPreventSleep,
      });
    } else {
      window.open(
        `${window.location.href.split('#')[0]}#/${ref}/${book.id}?title=${book.name}`,
      );
    }
  }
}
export default BookUtil;
