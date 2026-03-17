/* eslint-disable react/function-component-definition */
/* eslint-disable react/prop-types */
import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardMedia,
  Grid,
  IconButton,
} from '@mui/material';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import { useCreateNoteMutation } from '../../../store/api/noteApiSlice';
import customStorage from '../../../store/customStorage';
import { NoteType } from '../../../../commons/model/Note';

const InteractiveList = ({ title, items }) => {
  const [CreateNote] = useCreateNoteMutation();

  const createNoteByItem = async (item) => {
    const { title, content, image } = item;
    let imageId = '';
    if (image) {
      const m = await customStorage.createImage(image);
      imageId = m.id;
    }
    await CreateNote({
      sourceKey: '',
      title,
      cards: [
        {
          text: content || '',
          html: '',
          image: imageId,
          templateId: 0,
        },
      ],
      chapter: '',
      chapterIndex: -1,
      cfi: '', // cfi
      range: '', // range
      percentage: 0, /// percentage
      sourceType: NoteType.Note, // type
      color: '', // color
      tags: [],
      rate: 0,
      position: [],
      emoji: '',
      highlightOnly: false,
      highlightType: '',
      hasQuiz: false,
    });
  };

  return (
    <Box sx={{ maxWidth: 600, margin: '0 auto', padding: 2 }}>
      <Typography variant="h8" component="div" sx={{ marginBottom: 2 }}>
        {title}
      </Typography>
      <Grid container spacing={2}>
        {items.map((item, index) => (
          <Grid item xs={12} key={index}>
            <Card sx={{ display: 'flex', alignItems: 'center' }}>
              <CardMedia
                component="img"
                sx={{ width: 100, height: 100 }}
                image={item.image}
                alt={item.title}
              />
              <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <CardContent>
                  <Typography variant="h6" component="div">
                    {item.title}
                    <IconButton sx={{ width: 20, height: 20 }} onClick={() => createNoteByItem(item)}>
                      <BookmarkAddIcon
                        sx={{ marginRight: 1, fontSize: 16, color: '#f1c40f' }}
                      />
                    </IconButton>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {item.content}
                  </Typography>
                </CardContent>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default InteractiveList;
