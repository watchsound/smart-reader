/* eslint-disable react/button-has-type */
import { useState, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { v4 as uuid } from 'uuid';
import LinearProgress from '@mui/material/LinearProgress';
import SaveIcon from '@mui/icons-material/Save';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
// import Filter1Icon from '@mui/icons-material/Filter1';
// import Filter2Icon from '@mui/icons-material/Filter2';
// import Filter3Icon from '@mui/icons-material/Filter3';
import Radio from '@mui/material/Radio';

import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardMedia from '@mui/material/CardMedia';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';

import customStorage from '../../store/customStorage';
import {
  useCreateNoteMutation,
  useCreateImageMutation,
} from '../../store/api/noteApiSlice';
import parseMarkdownToHtml, { removeEmptySide } from '../../components/note/NoteUtil';
import ImageFileInput from '../../components/imageFileInput';
import LayoutOptions from './LayoutOptions';
import { NoteType } from '../../../commons/model/Note';
import { cardImageOverlapTemplateId } from '../../components/cardsetting/card-templates';
import { RichMarkdownEditor } from '../../components/editor';

function CreateNoteCell({noteCreationHandler}) {
  // character limit
  const [inputText, setInputText] = useState('');
  const [title, setTitle] = useState('');
  const [selectedSide, setSelectedSide] = useState(0);
  const [values, setValues] = useState(['', '', '']);
  const [valuesHtml, setValuesHtml] = useState(['', '', '']);
  const [useRichEditor, setUseRichEditor] = useState(true);
  const editorRef = useRef(null);

  const [imagesSrc, setImagesSrc] = useState([null, null, null]);
  const [overlaps, setOverlaps] = useState([0, 0, 0]);

  const [CreateNote ] = useCreateNoteMutation();
  // const [CreateImage ] = useCreateImageMutation();

  const charLimit = 150;
  const charLeft = charLimit - (inputText || '').length;
  const cardWidth = 360;

  // Save current editor content before switching sides
  const saveCurrentSideContent = useCallback(() => {
    if (useRichEditor && editorRef.current) {
      const html = editorRef.current.getHTML();
      const text = editorRef.current.getText();
      setValuesHtml((prev) => {
        const newHtml = [...prev];
        newHtml[selectedSide] = html;
        return newHtml;
      });
      setValues((prev) => {
        const newText = [...prev];
        newText[selectedSide] = text;
        return newText;
      });
    }
  }, [useRichEditor, selectedSide]);

  // Handle editor content change
  const handleEditorChange = useCallback((html, text) => {
    setValuesHtml((prev) => {
      const newHtml = [...prev];
      newHtml[selectedSide] = html;
      return newHtml;
    });
    setValues((prev) => {
      const newText = [...prev];
      newText[selectedSide] = text;
      return newText;
    });
    setInputText(text);
  }, [selectedSide]);

  const handleSideChange = (event) => {
    // Save current side content first
    saveCurrentSideContent();
    const side = parseInt(event.target.value, 10);
    setSelectedSide(side);
    setInputText(values[side]);
  };

  const handleImageFileChange = (file) => {
    if (!file) return;
    // Capture current side at the time of function call (before async operation)
    const currentSide = selectedSide;
    const reader = new FileReader();
    reader.onload = () => {
      // imageDataUrl will be in the format "data:image/png;base64,...."
      const imageDataUrl = reader.result;
      // Create new array to trigger React re-render
      setImagesSrc((prev) => {
        const newImagesSrc = [...prev];
        newImagesSrc[currentSide] = imageDataUrl;
        return newImagesSrc;
      });
    };
    reader.readAsDataURL(file);
  };
  const getImageCode = () => {
    if (!imagesSrc) return null;
    if (selectedSide == 2) return imagesSrc[2];
    if (selectedSide == 1) return imagesSrc[1];
    return imagesSrc[0];
  };
  const getOverlapCode = () => {
    if (!overlaps) return null;
    if (selectedSide == 2) return overlaps[2];
    if (selectedSide == 1) return overlaps[1];
    return overlaps[0];
  };
  // get text and store in state
  const textHandler = (e) => {
    const newValue = e.target.value;
    setInputText(newValue);
    // Create new array to trigger React re-render
    setValues((prev) => {
      const newValues = [...prev];
      newValues[selectedSide] = newValue;
      return newValues;
    });
  };
  const onLayoutOptionChanges = (value) => {
    // Create new array to trigger React re-render
    setOverlaps((prev) => {
      const newOverlaps = [...prev];
      newOverlaps[selectedSide] = value;
      return newOverlaps;
    });
  };
  const titleHandler = (e) => {
    setTitle(e.target.value);
  };
  // add new note to the state array
  const saveHandler = async () => {
    // Save current editor content first
    saveCurrentSideContent();

    // Get final values
    const finalValues = [...values];
    const finalValuesHtml = [...valuesHtml];

    // If using rich editor, get latest content
    if (useRichEditor && editorRef.current) {
      finalValues[selectedSide] = editorRef.current.getText();
      finalValuesHtml[selectedSide] = editorRef.current.getHTML();
    }

    if (
      finalValues[0].length === 0 &&
      finalValues[1].length === 0 &&
      finalValues[2].length === 0
    )
      return;
    removeEmptySide(finalValues);
    const imageIds = [];
    for (let i = 0; i < 3; i++) {
      if (imagesSrc[i]) {
        const m = await customStorage.createImage( imagesSrc[i] );
        imageIds[i] = m.id;
      }
    }
    let newNote;
    if (finalValues[1].length === 0) {
      // only A has content
     // const id = uuid();
      newNote = await CreateNote({
        sourceKey: '',
        title,
        cards: [
          {
            text: finalValues[0] || '',
            html: finalValuesHtml[0] || '',
            image: imageIds[0],
            templateId: overlaps[0],
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
    } else if (finalValues[2].length == 0) {
      // only A B  has content

     // const id = uuid();
      newNote = await CreateNote({
        sourceKey: '',
        title,
        cards: [
          {
            text: finalValues[0] || '',
            html: finalValuesHtml[0] || '',
            image: imageIds[0],
            templateId: overlaps[0],
          },
          {
            text: finalValues[1] || '',
            html: finalValuesHtml[1] || '',
            image: imageIds[1],
            templateId: overlaps[1],
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
    } else {
      // A B C has content

     // const id = uuid();
      newNote = await CreateNote({
        sourceKey: '',
        title,
        cards: [
          {
            text: finalValues[0] || '',
            html: finalValuesHtml[0] || '',
            image: imageIds[0],
            templateId: overlaps[0],
          },
          {
            text: finalValues[1] || '',
            html: finalValuesHtml[1] || '',
            image: imageIds[1],
            templateId: overlaps[1],
          },
          {
            text: finalValues[2] || '',
            html: finalValuesHtml[2] || '',
            image: imageIds[2],
            templateId: overlaps[2],
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
    }
    if (newNote && noteCreationHandler) {
      noteCreationHandler(newNote.data ? newNote.data: newNote);
    }

    // clear the textarea
    setInputText('');
    setSelectedSide(0);
    setValues(['', '', '']);
    setValuesHtml(['', '', '']);
    setImagesSrc([null, null, null]);
    setTitle('');
    // Clear editor
    if (editorRef.current) {
      editorRef.current.clear();
    }
  };

  // Check if a side has an image
  const sideHasImage = (side) => imagesSrc[side] !== null;

  return (
    <Card sx={{ maxWidth: { cardWidth } }}>
      {getImageCode() && (
        <CardMedia component="img" height="194" image={getImageCode()} />
      )}
      <CardContent style={{ flex: '1 1 auto' }}>
        <TextField
          fullWidth
          value={title}
          placeholder="Title...."
          onChange={titleHandler}
          variant="outlined"
          sx={{  height: '35px', marginBottom: '5px' }}
          size="small"
        />
        <FormControlLabel
          control={
            <Switch
              checked={useRichEditor}
              onChange={(e) => setUseRichEditor(e.target.checked)}
              size="small"
            />
          }
          label="Rich Editor"
          sx={{ mb: 1 }}
        />
        {useRichEditor ? (
          <RichMarkdownEditor
            key={`side-${selectedSide}`}
            ref={editorRef}
            content={valuesHtml[selectedSide] || values[selectedSide]}
            onChange={handleEditorChange}
            placeholder="Content... Use $...$ for math"
            minHeight={150}
            maxHeight={250}
          />
        ) : (
          <TextField
            fullWidth
            multiline
            minRows={8}
            maxRows={20}
            value={inputText}
            placeholder="Content...."
            onChange={textHandler}
            variant="outlined"
            size="small"
          />
        )}
      </CardContent>
      <CardActions disableSpacing>
        <div className="two_end_container">
          <div className="two_end_start">
            <Radio
              checked={selectedSide == 0}
              onChange={handleSideChange}
              value="0"
              name="radio-buttons"
              size="small"
              inputProps={{ 'aria-label': '0' }}
              sx={{
                color: sideHasImage(0) ? '#4caf50' : undefined,
                '&.Mui-checked': {
                  color: sideHasImage(0) ? '#4caf50' : undefined,
                },
              }}
            />
            <Radio
              checked={selectedSide == 1}
              onChange={handleSideChange}
              value="1"
              name="radio-buttons"
              size="small"
              inputProps={{ 'aria-label': '1' }}
              sx={{
                color: sideHasImage(1) ? '#4caf50' : undefined,
                '&.Mui-checked': {
                  color: sideHasImage(1) ? '#4caf50' : undefined,
                },
              }}
            />
            <Radio
              checked={selectedSide == 2}
              onChange={handleSideChange}
              value="2"
              name="radio-buttons"
              size="small"
              inputProps={{ 'aria-label': '2' }}
              sx={{
                color: sideHasImage(2) ? '#4caf50' : undefined,
                '&.Mui-checked': {
                  color: sideHasImage(2) ? '#4caf50' : undefined,
                },
              }}
            />
            <ImageFileInput onChange={handleImageFileChange} />
            {getImageCode() && (
              <LayoutOptions
                overlap={getOverlapCode()}
                onLayoutOptionChanges={onLayoutOptionChanges}
              />
            )}
          </div>
          <div className="two_end_end">
            <IconButton size="small" onClick={saveHandler} aria-label="edit">
              <SaveIcon fontSize="small" />
            </IconButton>
          </div>
        </div>
      </CardActions>
    </Card>
  );
}

export default CreateNoteCell;

//  <LinearProgress
//           className="char__progress"
//           variant="determinate"
//           value={charLeft}
//         />
