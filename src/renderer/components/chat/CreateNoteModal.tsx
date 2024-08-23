/* eslint-disable react/require-default-props */
import { useEffect, useState } from 'react';
import IconButton from '@mui/material/IconButton';

import AddCardOutlinedIcon from '@mui/icons-material/AddCardOutlined';
import Dialog from '@mui/material/Dialog';

import Tooltip from '@mui/material/Tooltip';

import Note from '../../../commons/model/Note';
import CreateNotePanel from './CreateNotePanel';
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

  useEffect(() => {
    setOpened(openDialog);
  }, [openDialog]);

  return (
    <>
      {showButton && (
        <Tooltip title="Create Card">
          <IconButton
            size="small"
            onClick={() => setOpened(true)}
            aria-label="create"
          >
            <AddCardOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      <Dialog
        open={opened}
        onClose={() => {
          setOpened(false);
          if (dialogHandle) dialogHandle(null);
        }}
        aria-labelledby="custom-modal-title"
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
      </Dialog>
    </>
  );
}

export default CreateNoteModal;
