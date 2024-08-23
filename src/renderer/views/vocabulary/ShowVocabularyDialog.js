import * as React from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import Popover from '@mui/material/Popover';

function ShowVocabularyDialog({
  vocabulary,
  anchorEl,
  handleWindowClose,
  open,
}) {
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
            {vocabulary.word}
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

export default ShowVocabularyDialog;
