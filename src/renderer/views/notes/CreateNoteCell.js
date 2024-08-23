/* eslint-disable react/button-has-type */
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { v4 as uuid } from 'uuid';
import LinearProgress from '@mui/material/LinearProgress';
import SaveIcon from '@mui/icons-material/Save';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
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

function CreateNoteCell({noteCreationHandler}) {
  // character limit
  const [inputText, setInputText] = useState('');
  const [title, setTitle] = useState('');
  const [selectedSide, setSelectedSide] = useState(0);
  const [values, setValues] = useState(['', '', '']);

  const [imagesSrc, setImagesSrc] = useState([null, null, null]);
  const [overlaps, setOverlaps] = useState([0, 0, 0]);

  const [CreateNote ] = useCreateNoteMutation();
  // const [CreateImage ] = useCreateImageMutation();

  const charLimit = 150;
  const charLeft = charLimit - (inputText || '').length;
  const cardWidth = 360;

  const handleSideChange = (event) => {
    const side = event.target.value;
    setSelectedSide(side);
    setInputText(values[side]);
  };

  const handleImageFileChange = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      // // imageDataUrl will be in the format "data:image/png;base64,...."
      const imageDataUrl = reader.result;
      imagesSrc[selectedSide] = imageDataUrl;
      setImagesSrc(imagesSrc);
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
    setInputText(e.target.value);
    values[selectedSide] = e.target.value;
    setValues(values);
  };
  const onLayoutOptionChanges = (value) => {
    overlaps[selectedSide] = value;
    setOverlaps(overlaps);
  };
  const titleHandler = (e) => {
    setTitle(e.target.value);
  };
  // add new note to the state array
  const saveHandler = async () => {
    // console.log("here")
    if (
      values[0].length === 0 &&
      values[1].length === 0 &&
      values[2].length === 0
    )
      return;
    removeEmptySide(values);
    const imageIds = [];
    for (let i = 0; i < 3; i++) {
      if (imagesSrc[i]) {
        const m = await customStorage.createImage( imagesSrc[i] );
        imageIds[i] = m.id;
      }
    }
    let newNote;
    if (values[1].length === 0) {
      // only A has content
     // const id = uuid();
      newNote = await CreateNote({
        sourceKey: '',
        title,
        cards: [
          {
            text: values[0] || '',
            html: '',
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
    } else if (values[2].length == 0) {
      // only A B  has content

     // const id = uuid();
      newNote = await CreateNote({
        sourceKey: '',
        title,
        cards: [
          {
            text: values[0] || '',
            html: '',
            image: imageIds[0],
            templateId: overlaps[0],
          },
          {
            text: values[1] || '',
            html: '',
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
            text: values[0] || '',
            html: '',
            image: imageIds[0],
            templateId: overlaps[0],
          },
          {
            text: values[1] || '',
            html: '',
            image: imageIds[1],
            templateId: overlaps[1],
          },
          {
            text: values[2] || '',
            html: '',
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
    setImagesSrc([null, null, null]);
    setTitle('');
  };

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
            />
            <Radio
              checked={selectedSide == 1}
              onChange={handleSideChange}
              value="1"
              name="radio-buttons"
              size="small"
              inputProps={{ 'aria-label': '1' }}
            />
            <Radio
              checked={selectedSide == 2}
              onChange={handleSideChange}
              value="2"
              name="radio-buttons"
              size="small"
              inputProps={{ 'aria-label': '2' }}
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
