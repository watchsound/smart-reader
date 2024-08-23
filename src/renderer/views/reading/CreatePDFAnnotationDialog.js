/* eslint-disable react/button-has-type */
/* eslint-disable prettier/prettier */
/* eslint-disable no-undef */
import * as React from 'react';
import { useState, useRef } from 'react';
// import Button from '@mui/material/Button';
// import ButtonGroup from '@mui/material/ButtonGroup';
// import Paper from '@mui/material/Paper';
// import EditNoteIcon from '@mui/icons-material/EditNote';
// import BorderColorIcon from '@mui/icons-material/BorderColor';
// import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
// import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
// import PowerInputIcon from '@mui/icons-material/PowerInput';
// import Divider from '@mui/material/Divider';
// import IconButton from '@mui/material/IconButton';
// import CameraIcon from '@mui/icons-material/Camera';
// import Popover from '@mui/material/Popover';
import { useSelector, useDispatch } from 'react-redux';
import {
  // GhostHighlight,
  PdfSelection,
  usePdfHighlighterContext,
} from "react-pdf-highlighter-extended-x2";

// import EmojiList from '../../components/emoji/EmojiList';
// import { markTypes } from './AnnotationNoteUtil';
// import ColorPicker from '../../components/ColorPicker';
// import CreateAnnotationDialog from './CreateAnnotationDialog';
// import CreateNoteModal from '../../components/chat/CreateNoteModal';
import { useCreateNoteMutation } from '../../store/api/noteApiSlice';
import CreateAnnotationPanel, { SelectionType } from './CreateAnnotationPanel';
import CreateNotePanel from '../../components/chat/CreateNotePanel';
import { roundDecimals } from '../../../commons/utils/commonUtil';

import openImpressWindow from '../../components/impressjs';
/**
 *  onConfirm is for react-pdf-highlighter
 * @param {*} param0
 * @returns
 */
function CreatePDFAnnotationDialog({ bookId,  onConfirm }) {
  const [compact, setCompact] = useState(true);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  // const [showImpressjs, setShowImpressjs] = useState(false);
  const [type, setType] = useState('');
  const [color, setColor] = useState('');
  const [emoji, setEmoji] = useState('');
  const [highlightType, setHighlightType] = useState('');
  const [isImage, setIsImage] = useState(false);
  const [CreateNote] = useCreateNoteMutation();
  const selectionRef = useRef(null);

  const dispatch = useDispatch();

  const {
    getCurrentSelection,
    removeGhostHighlight,
    setTip,
    updateTipPosition,
  } = usePdfHighlighterContext();

  React.useLayoutEffect(() => {
    if (updateTipPosition) updateTipPosition();
  }, [compact, updateTipPosition]);

  const handleAnnotationWindowClose = async (selectionType, type, color, emoji) => {
    if (selectionType === SelectionType.Cancel) {
      removeGhostHighlight();
      setTip(null);
      // setShowImpressjs(false);
      setShowNoteDialog(false);
      onConfirm(null);
      return;
    }

    if (selectionType === SelectionType.Presentation) {
      const text =  selectionRef.current ? selectionRef.current.content.text : '';
      // removeGhostHighlight();
      if (text.length > 50) openImpressWindow({ paragraph: text });
      setShowNoteDialog(false);
      onConfirm(null);
      return;
    }

    if (selectionType === SelectionType.Note) {
      setColor(color);
      setEmoji(emoji);
      setType(type)
      setShowNoteDialog(true);
      // setShowImpressjs(false);
      return;
    }
    const selectedContent =  selectionRef.current ? selectionRef.current.content.text : '';
    const position = selectionRef.current ? roundDecimals(selectionRef.current.position) :
       {
         boundingRect: {
          x1: 0,
          y1: 0,
          x2: 1,
          y2: 1,
          width: 1,
          height: 1,
        },
        rects: [
          {
            x1: 0,
            y1: 0,
            x2: 1,
            y2: 1,
            width: 1,
            height: 1,
          },
        ],
        pageNumber: 1,
      };
    const newNote = {
      sourceKey: bookId,
      title: selectedContent? selectedContent.substring(0,10) : '',
      cards: [
        {
          text: selectedContent,
          html: '',
        },
      ],
      chapter: '',
      chapterIndex: -1,
      cfi: '', // cfi
      range: '', // range
      percentage: 0, /// percentage
      sourceType: 'book', // type
      color, // color
      tags: [],
      rate: 0,
      hasQuiz: false, // bug, if create quiz failed?
      position,
      emoji,
      highlightOnly: true,
      highlightType: type,
    };
    const newNote2 = await CreateNote(newNote);
    removeGhostHighlight();
    setTip(null);
    onConfirm(newNote2.data ? newNote2.data : newNote2);
  };

  const handleNoteWindowClose = async (note) => {
     removeGhostHighlight();
     setTip(null);
      // setShowImpressjs(false);
      setShowNoteDialog(false);
     onConfirm(note);
  };

  if (compact) {
    return (
      <div className="Tip">
        <button
          className="Tip__compact"
          onClick={() => {
            setCompact(false);
            selectionRef.current = getCurrentSelection();
            if (selectionRef.current) selectionRef.current.makeGhostHighlight();
          }}
        >
          Add highlight
        </button>
      </div>
    )
  };
  // if (showImpressjs) {
  //   const selectedContent = selectionRef.current ? selectionRef.current.content : '';
  //   return (
  //       <Impressjs
  //         paragraph={selectedContent}
  //         closeHandler={() => setShowImpressjs(false)}
  //       />
  //   );
  // }

  if (showNoteDialog) {
    const selectedContent = selectionRef.current ? selectionRef.current.content : '';
    return (
      <CreateNotePanel
        sourceType='book'
        sourceKey={bookId}
        content={selectedContent}
        imageData=""
        cfi=""
        url=""
        emoji={emoji}
        color={color}
        highlightType={highlightType}
        dialogHandle={handleNoteWindowClose}
      />
    );
  }
  return  (
    <CreateAnnotationPanel
        handleWindowClose={handleAnnotationWindowClose}
        showImageOption={false}
        showPresentOption={(selectionRef.current ? selectionRef.current.content.text : '').length > 50}
        setMarkColor={()=>{ }}
        setMarkType={()=>{ }}
        setEmoji={()=>{ }}
      />
  );
}

export default CreatePDFAnnotationDialog;
