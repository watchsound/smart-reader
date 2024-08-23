import * as React from 'react';

import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import { styled } from '@mui/system';
import TagsInput from 'react-tagsinput';

import 'react-tagsinput/react-tagsinput.css';
import '../../components/CustomizedFilterBase/nodefilter-styles.module.css';
import SmallButton from '../Button/SmallButton';

const TagsInputNoBorder = styled(TagsInput)({
  backgroundColor: '#fff0',
  border: '1px solid #0000 !important',
  overflow: 'hidden',
  paddingLeft: '5px',
});

export default function CreateNoteDialog({
  handleWindowClose,
  inputText,
  ftag,
  open,
}) {
  const [note, setNote] = React.useState(inputText);
  const [tags, setTags] = React.useState([]);

  React.useEffect(() => {
    setNote(inputText);
    let ts = ftag || [];
    if (!ts.map) ts = ts.split(',');
    setTags(ts);
  }, [inputText, ftag]);

  const handleClose = (cancel) => {
    handleWindowClose(note, tags, cancel);
  };
  // const parseMarkdownToHtml = ( e ) => {
  //     var markdown = e.target.value
  //     var t = .parseMarkdown(markdown)
  //     t .then((result) => {
  //         setNote(result)
  //     });
  // }
  return (
    <Dialog fullWidth open={open} onClose={() => handleClose(false)}>
      <DialogContent>
        <DialogContentText>Add Note Here</DialogContentText>
        <TextField
          multiline
          minRows={10}
          maxRows={10}
          value={note}
          placeholder="Type...."
          onChange={(e) => {
            setNote(e.target.value);
          }}
          variant="outlined"
          size="small"
        />
        <div className="note__footer">
          <TagsInputNoBorder
            value={tags}
            onChange={(tags) => {
              setTags(tags);
            }}
          />
        </div>
      </DialogContent>
      <DialogActions>
        <SmallButton onClick={() => handleClose(true)}>Cancel</SmallButton>
        <SmallButton onClick={() => handleClose(false)}>Save</SmallButton>
      </DialogActions>
    </Dialog>
  );
}
