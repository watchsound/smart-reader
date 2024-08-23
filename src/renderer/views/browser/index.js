/* eslint-disable prettier/prettier */
import React from 'react'
import { useLoaderData } from 'react-router-dom';
import Browser from './Browser';
import {
  getBookById,
} from '../../api/booksApi';
import customStorage from '../../store/customStorage';
import join from '../../../commons/utils/content/joinUtil';

export async function loader({ params }) {
  const book = await getBookById(params.id);
  // if (!book) {
  //   throw new Response('', {
  //     status: 404,
  //     statusText: `Book Not Found FOR ${params.id}`,
  //   });
  // }
  return { book, url : params.id };
}

function BrowserPage() {
  const [bookPath, setBookPath] = React.useState('');
  const { book, url } = useLoaderData();

  React.useEffect(() => {
    if (!book) { // is bookmark
      if (url) {
        const unescapedUrl = url.replace(/\\\//g, '/');
        const decoded = decodeURIComponent(unescapedUrl);
        setBookPath( decoded );
        console.log( decoded );
      }
      return;
    }
    async function cdr() {
      const dataPath = await customStorage.getItem('storageLocation');
      const outPath = join(dataPath, `book`, `${book.keyInStorage || book.id}`, `index.html`);
      setBookPath(`file://${outPath}`);
      console.log(`file://${outPath}`);
    }
    cdr();
  }, [book, url]);

  return (
    <div className="main note__main">
      <Browser urlPath={bookPath} curBook={book}/>
    </div>
  );
}
export default BrowserPage;
