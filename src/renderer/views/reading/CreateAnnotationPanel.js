import * as React from 'react';
import { useState } from 'react';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import EditNoteIcon from '@mui/icons-material/EditNote';
import BorderColorIcon from '@mui/icons-material/BorderColor';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import CoPresentIcon from '@mui/icons-material/CoPresent';
import PowerInputIcon from '@mui/icons-material/PowerInput';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import CameraIcon from '@mui/icons-material/Camera';
import HighlightOffIcon from '@mui/icons-material/HighlightOff';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import EmojiList from '../../components/emoji/EmojiList';

import { markTypes } from './AnnotationNoteUtil';
import ColorPicker from '../../components/ColorPicker';

export const SelectionType = Object.freeze({
  Note: 'note',
  Image: 'image',
  Highlight: 'highlight',
  Presentation: 'presentation',
  Cancel: 'cancel',
});
/**
 * onOpen and onConfirm is for react-pdf-highlighter
 * @param {*} param0
 * @returns
 */
function CreateAnnotationPanel({
  handleWindowClose,
  setMarkColor,
  setMarkType,
  setEmoji,
  showImageOption,
  showPresentOption,
}) {
  const [markColor, setMarkColor0] = useState('primary');
  const [markType0, setMarkType0] = useState('underline');
  const [emoji, setEmoji0] = useState('');

  const handleClose = (selectionType) => {
    handleWindowClose(selectionType, markType0, markColor, emoji);
  };


  return (
    <>
      <Paper
        component="form"
        sx={{
          p: '2px 4px',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          borderStyle: 'none  none solid none',
          borderWidth: '1px',
        }}
      >
        <Tooltip title="Highlight Annotation">
          <Button
            color="info"
            onClick={() => {
              setMarkType(markTypes.Highlight);
              setMarkType0(markTypes.Highlight);
            }}
            variant="contained"
            endIcon={<FormatColorFillIcon />}
          >
            H
          </Button>
        </Tooltip>
        <Tooltip title="Underline Annotation">
          <Button
            color="info"
            onClick={() => {
              setMarkType(markTypes.Underline);
              setMarkType0(markTypes.Underline);
            }}
            variant="contained"
            endIcon={<BorderColorIcon />}
          >
            U
          </Button>
        </Tooltip>
        <Tooltip title="StrikeLine Annotation">
          <Button
            color="info"
            onClick={() => {
              setMarkType(markTypes.Strikeline);
              setMarkType0(markTypes.Strikeline);
            }}
            variant="contained"
            endIcon={<BorderColorIcon />}
          >
            S
          </Button>
        </Tooltip>
        <Tooltip title="DashLine Annotation">
          <Button
            color="info"
            onClick={() => {
              setMarkType(markTypes.Dashline);
              setMarkType0(markTypes.Dashline);
            }}
            variant="contained"
            endIcon={<PowerInputIcon />}
          >
            D
          </Button>
        </Tooltip>
      </Paper>

      <Paper
        component="form"
        sx={{
          p: '2px 4px',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          borderStyle: 'none  none solid none',
          borderWidth: '1px',
        }}
      >
        <ColorPicker
          getInitialSelection={() => null}
          selectionCallback={(color) => {
            setMarkColor(color);
            setMarkColor0(color);
          }}
          orientation="horizontal"
        />
      </Paper>
      <Paper
        component="form"
        sx={{
          p: '2px 4px',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <EmojiList
          onEmojiClick={(e) => {
            setEmoji(e.native);
            setEmoji0(e.native);
          }}
        />
      </Paper>

      <Paper
        component="form"
        sx={{
          p: '2px 4px',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          marginTop: '6px',
        }}
      >
        <Grid container justifyContent="flex-end">
          <Tooltip title="Create Text Note">
            <IconButton
              size="small"
              onClick={() => {
                handleClose(SelectionType.Note);
              }}
              sx={{ p: '10px' }}
              aria-label="note"
            >
              <EditNoteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {showImageOption && (
            <>
              <Divider sx={{ height: 28, m: 0.5 }} orientation="vertical" />
              <Tooltip title="Create Image Note (Using Screenshot)">
                <IconButton
                  size="small"
                  onClick={() => {
                    setMarkType(markTypes.underline);
                    setMarkType0(markTypes.underline);
                    handleClose(SelectionType.Image);
                  }}
                  sx={{ p: '10px' }}
                  aria-label="note"
                >
                  <CameraIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
          {showPresentOption && (
            <>
              <Divider sx={{ height: 28, m: 0.5 }} orientation="vertical" />
              <Tooltip title="Slider Show">
                <IconButton
                  size="small"
                  onClick={() => {
                    handleClose(SelectionType.Presentation);
                  }}
                  sx={{ p: '10px' }}
                  aria-label="note"
                >
                  <CoPresentIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Divider sx={{ height: 28, m: 0.5 }} orientation="vertical" />
          <Tooltip title="Create Highlight Annotation">
            <IconButton
              size="small"
              onClick={() => {
                handleClose(SelectionType.Highlight);
              }}
              sx={{ p: '10px' }}
              aria-label="note"
            >
              <CheckCircleOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Cancel">
            <IconButton
              size="small"
              onClick={() => {
                handleClose(SelectionType.Cancel);
              }}
              sx={{ p: '10px' }}
              aria-label="note"
            >
              <HighlightOffIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Grid>
      </Paper>
    </>
  );
}

export default CreateAnnotationPanel;
