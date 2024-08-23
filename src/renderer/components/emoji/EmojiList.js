/* eslint-disable prettier/prettier */
import React from 'react';
import { IconButton, Stack } from '@mui/material';
import customStorage from '../../store/customStorage';

function EmojiList({ onEmojiClick }) {
  const [commonEmoji, setCommonEmoji] = React.useState([]);
  React.useEffect(() => {
    async function t() {
      const ce = (await customStorage.getItem('common_emoji')) || [];
      setCommonEmoji(ce);
    }
    t();
  }, []);

  return (
    <Stack direction="row" spacing={0.6} flexWrap="wrap">
      {commonEmoji.map((emoji, index) => (
        <IconButton
          key={index}
          onClick={() => onEmojiClick(emoji)}
          size="small" // Reduce the size for less padding
        >
          {emoji.native}
        </IconButton>
      ))}
    </Stack>
  );
}

export default EmojiList;
