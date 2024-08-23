import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  CardActions,
} from '@mui/material';
import Popover from '@mui/material/Popover';
import customStorage from '../../store/customStorage';

/**
 * onOpen and onConfirm is for react-pdf-highlighter
 * @param {*} param0
 * @returns
 */
function CreateVocabularyDialog({ text, anchorEl, handleWindowClose, open }) {
  const [vocabulary, setVocabulary] = useState({});

  async function t() {
    if (!text || text.length < 3 || text.length > 30) return;
    const exists = await customStorage.getVocabularyByName(text.trim());
    if (exists) {
      setVocabulary(exists);
      return;
    }
    const newOne = await customStorage.addToVocabulary(text);
    if (!newOne) return;
    setVocabulary(newOne);
  }

  useEffect(() => {
    if (text && text.length > 3) t();
  }, [text]);

  return (
    <Popover
      onClose={() => handleWindowClose()}
      open={open}
      anchorOrigin={{
        vertical: 'center',
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      anchorEl={anchorEl.current}
    >
      <Card>
        <CardContent sx={{ maxHeight: 320, overflowY: 'auto' }}>
          <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
            Definition
          </Typography>
          <Typography variant="h7" component="div">
            {vocabulary.detail ? vocabulary.detail.definition : ''}
          </Typography>
          <Typography sx={{ mb: 1.5 }} color="text.secondary">
            {vocabulary.detail ? vocabulary.detail.root : ''}
          </Typography>
          <Typography variant="body2">
            {vocabulary.detail ? vocabulary.detail.example : ''}
          </Typography>
        </CardContent>
      </Card>
    </Popover>
  );
}

export default CreateVocabularyDialog;
