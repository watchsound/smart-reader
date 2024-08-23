/* eslint-disable prettier/prettier */
/* eslint-disable camelcase */
import { useState, useEffect } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import 'highlight.js/styles/github.css'; // Import the desired highlight.js CSS style

import parseMarkdownToHtml from '../../components/note/NoteUtil';

const cardWidth = 360;

function BookmarkUI({ content, bookKey, cfi, selectHandler }) {
  const [htmlCode, setHtmlCode] = useState('');

  function truncate(str, n){
    return (str.length > n) ? `${str.slice(0, n-1)  }&hellip;` : str;
  };

  useEffect(() => {
    if (!content) return;
    parseMarkdownToHtml(truncate(content,200), (html) => {
      setHtmlCode(html);
    });
  }, [content]);

  const onClickHandler = () => {
    selectHandler(bookKey, cfi);
  };

  return (
    <Card sx={{ maxWidth: { cardWidth } }} onClick={onClickHandler}>
      <CardContent>
        <div
          className="note__body"
          dangerouslySetInnerHTML={{ __html: htmlCode }}
        />
      </CardContent>
    </Card>
  );
}

export default BookmarkUI;
