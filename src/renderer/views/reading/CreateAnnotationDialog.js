import * as React from 'react';
import { useState } from 'react';

import Popover from '@mui/material/Popover';

import CreateAnnotationPanel from './CreateAnnotationPanel';
/**
 * onOpen and onConfirm is for react-pdf-highlighter
 * @param {*} param0
 * @returns
 */
function CreateAnnotationDialog({ handleWindowClose, popupLoc, open, showImageOption, showPresentOption }) {
  const [markColor, setMarkColor] = useState('primary');
  const [markType, setMarkType] = useState('underline');
  const [emoji, setEmoji] = useState('');

  const handleClose = (useNote) => {
    handleWindowClose(useNote, markType, markColor, emoji, false);
  };

  return (
    <Popover
      onClose={() => handleClose(undefined)}
      open={open}
      anchorReference="anchorPosition"
      anchorPosition={popupLoc}
      anchorOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
    >
      <CreateAnnotationPanel
        handleWindowClose={handleWindowClose}
        showImageOption={showImageOption}
        showPresentOption={showPresentOption}
        setMarkColor={setMarkColor}
        setMarkType={setMarkType}
        setEmoji={setEmoji}
      />
    </Popover>
  );
}

export default CreateAnnotationDialog;
