import React, { useState } from 'react';
import {  useTheme } from '@mui/material';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';

import customStorage from '../../store/customStorage';

function BookmarkUI({ curBookmark, cardWidth, cardHeight, selectHandler }) {
  const [bookmark, setBookmark] = React.useState(null);
  const [imageBase64, setImageBase64] = React.useState('');
  const theme = useTheme();
  // React.useEffect(() => {
  //   async function t() {
  //     const d = await customStorage.jsonBookmarkGroupStructure();
  //     setTreeData(d);
  //   }
  //   t();
  // }, []);
  React.useEffect(() => {
    if (!curBookmark) return;
    setBookmark(curBookmark);
    async function t() {
      const base64 = await customStorage.getImage(curBookmark.image);
      setImageBase64(base64);
    }
    if (curBookmark.image) {
      t();
    }
  }, [curBookmark]);

  return (
    <Card
      sx={{
        maxWidth: cardWidth,
        maxHeight: cardHeight,
        display: 'flex',
      }}
      onClick={selectHandler}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
        }}
      >
        <CardContent sx={{ flex: '1 0 auto' }}>
          <Typography component="div" variant="title">
            {bookmark && bookmark.title}
          </Typography>
          <Typography variant="content" color="text.secondary" component="div">
            {bookmark && bookmark.description.slice(0, 100)}
          </Typography>
        </CardContent>
      </Box>
      {imageBase64 && (
        <CardMedia
          component="img"
          sx={{ width: 80, height: 'auto' }}
          image={imageBase64}
        />
      )}
    </Card>
  );
}
export default BookmarkUI;
