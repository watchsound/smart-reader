import { useRef, useState } from 'react';
// import { Card, CardActions, CardContent, IconButton, Tooltip, Typography } from '@mui/material';
import MoveUpIcon from '@mui/icons-material/MoveUp';
import AddToDriveIcon from '@mui/icons-material/AddToDrive';

import {
  Card,
  CardActions,
  CardContent,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import { useDispatch } from 'react-redux';


import ShowVocabularyDialog from './ShowVocabularyDialog';

import { vocabularyAdded } from '../../store/reducers/vocabularySlice';

function VocabularyItemView({ vocabulary }) {
  const cellRef = useRef();
  const [openVocabularyDialog, setOpenVocabularyDialog] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const dispatch = useDispatch();
  const addToLearningStack = () => {
    dispatch(vocabularyAdded(vocabulary));
  };

  return (
    <Card sx={{ minWidth: 120 }} key={vocabulary.id} ref={cellRef}>
      <CardContent>
        <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
          {vocabulary.word}
        </Typography>
      </CardContent>
      <CardActions>
        <Tooltip title="Show Definition">
          <IconButton
            size="small"
            onClick={() => setOpenVocabularyDialog(true)}
            aria-label="edit"
          >
            <MoveUpIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Add To Learning Stack">
          <IconButton
            size="small"
            onClick={() => addToLearningStack()}
            aria-label="edit"
          >
            <AddToDriveIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </CardActions>

      {cellRef.current && (
        <ShowVocabularyDialog
          vocabulary={vocabulary}
          anchorEl={cellRef}
          handleWindowClose={() => setOpenVocabularyDialog(false)}
          open={openVocabularyDialog}
        />
      )}
    </Card>
  );
}

export default VocabularyItemView;
