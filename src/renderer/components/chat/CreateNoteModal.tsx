/* eslint-disable react/require-default-props */
import { useEffect, useState } from 'react';
import IconButton from '@mui/material/IconButton';
import AddCardOutlinedIcon from '@mui/icons-material/AddCardOutlined';
import Dialog from '@mui/material/Dialog';
import Tooltip from '@mui/material/Tooltip';
import Slide from '@mui/material/Slide';
import { TransitionProps } from '@mui/material/transitions';
import { styled, useTheme } from '@mui/material/styles';
import React from 'react';

import Note from '../../../commons/model/Note';
import CreateNotePanel from './CreateNotePanel';

// Slide transition for dialog
const Transition = React.forwardRef(function Transition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

// Styled Dialog
const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: '16px',
    overflow: 'hidden',
    background: 'transparent',
    boxShadow: theme.palette.mode === 'dark'
      ? '0 24px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08)'
      : '0 24px 80px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05)',
    maxHeight: '85vh',
  },
  '& .MuiBackdrop-root': {
    backdropFilter: 'blur(8px)',
    background: theme.palette.mode === 'dark'
      ? 'rgba(0, 0, 0, 0.7)'
      : 'rgba(0, 0, 0, 0.4)',
  },
}));

// Styled Add Button
const AddButton = styled(IconButton)(({ theme }) => ({
  width: 30,
  height: 30,
  borderRadius: 8,
  transition: 'all 0.15s ease-in-out',
  '&:hover': {
    backgroundColor: theme.palette.mode === 'dark'
      ? 'rgba(97, 31, 105, 0.3)'
      : 'rgba(97, 31, 105, 0.12)',
    color: '#611f69',
    transform: 'scale(1.08)',
  },
  '& .MuiSvgIcon-root': {
    fontSize: 16,
    color: theme.palette.mode === 'dark' ? '#e8e8e8' : '#611f69',
  },
}));

/**
 *  if noteType is book,  we treat new note separately, as currently we keep book note
 *  at different location.
 * @param param0
 * @returns
 */
function CreateNoteModal({
  sourceType,
  sourceKey,
  content,
  imageData,
  cfi,
  url,
  emoji,
  color,
  highlightType,
  showButton,
  openDialog,
  dialogHandle,
}: {
  sourceType: string;
  sourceKey: number;
  content: string;
  imageData: string;
  cfi: string;
  url: string;
  emoji: string;
  color: string;
  highlightType: string;
  showButton: boolean;
  openDialog: boolean;
  dialogHandle?: (newNote: Note) => void;
}) {
  const [opened, setOpened] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    setOpened(openDialog);
  }, [openDialog]);

  return (
    <>
      {showButton && (
        <Tooltip title="Create Note" arrow>
          <AddButton
            onClick={() => setOpened(true)}
            aria-label="create note"
          >
            <AddCardOutlinedIcon fontSize="small" />
          </AddButton>
        </Tooltip>
      )}
      <StyledDialog
        open={opened}
        onClose={() => {
          setOpened(false);
          if (dialogHandle) dialogHandle(null);
        }}
        TransitionComponent={Transition}
        aria-labelledby="create-note-dialog"
        maxWidth="sm"
        fullWidth
      >
        <CreateNotePanel
          sourceType={sourceType}
          sourceKey={sourceKey}
          content={content}
          imageData={imageData}
          cfi={cfi}
          url={url}
          emoji={emoji}
          color={color}
          highlightType={highlightType}
          dialogHandle={(note) => {
            if (dialogHandle) dialogHandle(note);
            setOpened(false);
          }}
        />
      </StyledDialog>
    </>
  );
}

export default CreateNoteModal;
