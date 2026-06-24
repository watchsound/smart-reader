/* eslint-disable camelcase */
import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';

import SaveIcon from '@mui/icons-material/Save';

import Rating from '@mui/material/Rating';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import { v4 as uuid } from 'uuid';
import { styled } from '@mui/material/styles';
import Card from '@mui/material/Card';

import CardMedia from '@mui/material/CardMedia';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import IconButton from '@mui/material/IconButton';

import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import TagsInput from 'react-tagsinput';
import { useNavigate } from 'react-router-dom';

import 'react-tagsinput/react-tagsinput.css';
import 'highlight.js/styles/github.css'; // Import the desired highlight.js CSS style

import '../CustomizedFilterBase/nodefilter-styles.module.css';
import { Box, Grid } from '@mui/material';
import { getQuizProblemsBySourceKey } from '../../api/quizApi';

// import { getNote as getNote } from '../../api/notesApi';
import {
  useGetNoteByIdQuery,
  useReplaceNoteMutation,
} from '../../store/api/noteApiSlice';
import { removeEmptyPages } from './NoteUtil';
import ImageFileInput from '../imageFileInput';

import { getImage } from '../../api/booksApi';
import customStorage from '../../store/customStorage';
import CardSettingModal from '../cardsetting/CardSettingModal';
import PageSwitcher from './PageSwitcher';
import CardHeaderNoSwitch from './CardHeaderNoSwitch';
import CardContentSwitcher from './CardContentSwitcher';
import NoteCardSurface from './NoteCardSurface';

// Kept for the legacy edit-mode card body where the gradient stripe + hover
// effects would interfere with the inline editor. Edit mode falls back to a
// minimal MUI Card. The two non-edit render paths use NoteCardSurface.
const StyledCard = styled(Card)({
  position: 'relative',
  overflow: 'hidden',
  borderRadius: '8px',
  transition: 'box-shadow 0.2s ease',
});
const FlexCardContent = styled(CardContent)({
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center', // Center content vertically if desired
  alignItems: 'stretch', // Stretch children to fill available space
  padding: '16px', // Adjust padding as needed
  width: '100%',
  height: '100%',
});
const ResponsiveTextField = styled(TextField)({
  flexGrow: 1, // Make TextField grow to fill available space
  minHeight: '100px', // Adjust minimum height as needed
});
const TagsInputNoBorder = styled(TagsInput)({
  backgroundColor: '#fff0',
  border: '1px solid #0000 !important',
  overflow: 'hidden',
  paddingLeft: '5px',
});

// Debounce function
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

function NoteUI({
  selectedNoteKey,
  selectHandler,
  showQuizHandler,
  compactView, // show note only
  customActionName,
  customAction,
  cardWidth,
  cardHeight,
  useMiniHeight, // height can grow, it applies only when compactView is true.
  maxHeight, // optional upper bound (px) when useMiniHeight is true
  deleteActionName,
  deleteAction,
  useBgColor,
  isInNotesUIView,
  noPadding, // When true, removes margin for use in diagram nodes
  // When true, the ⋮ menu hides items that don't apply in a
  // browsing-only context: Layout (card-design modal), Entry Effects,
  // Emphasis Effects, Reset (all animation/presentation features).
  // Used by reading sidebars (BookNotesPanel, BrowserSidebar) where
  // notes are just viewed, not designed or animated.
  compactMenu = false,
  toolbarMode = false,
}) {
  const [edit, setEdit] = useState(false);
  const [inputText, setInputText] = useState('');
  const [selectedSide, setSelectedSide] = useState(0);
  const [values, setValues] = useState(['', '', '']);

  const [cardTypes, setCardTypes] = useState(['', '', '']);
  const [cardData, setCardData] = useState([null, null, null]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [tags, setTags] = useState([]);
  const [showAnnotation, setShowAnnotation] = useState(true);

  const [emphasis, setEmphasis] = useState('');
  const [entry, setEntry] = useState('');

  const [openCarSettingModal, setOpenCarSettingModal] = useState(false);
  const { data: result } = useGetNoteByIdQuery(selectedNoteKey);
  // const navigate = useNavigate();
  const [ReplaceNote] = useReplaceNoteMutation();
  const [size, setSize] = useState({ width: cardWidth, height: cardHeight });
  const containerRef = useRef(null);
  const updateSize = () => {
    if (containerRef.current) {
   //   const { offsetWidth, offsetHeight } = containerRef.current;
   //   setSize({ width: offsetWidth, height: offsetHeight });
    }
  };
  const debouncedUpdateSize = debounce(updateSize, 200);

  useEffect(() => {
    setSize({ width: cardWidth, height: cardHeight });
  }, [cardWidth, cardHeight]);

  useEffect(() => {
    updateSize();
    window.addEventListener('resize', debouncedUpdateSize);
    return () => {
      window.removeEventListener('resize', debouncedUpdateSize);
    };
  }, []);

  const showNoteOnly = useSelector((state) => state.note.showTextOnly);

  // const dispatch = useDispatch();

  const [imagesId, setImagesId] = useState([null, null, null]);
  const [imagesSrc, setImagesSrc] = useState([null, null, null]);
  const [twoTextMore, setTwoTextMore] = useState(false);

  useEffect(() => {
    if (!result) return;
    const { note } = result;
    if (!note) return;
    const t0 = note.cards[0] && note.cards[0].text ? note.cards[0].text : '';
    const t1 = note.cards[1] && note.cards[1].text ? note.cards[1].text : '';
    const t2 = note.cards[2] && note.cards[2].text ? note.cards[2].text : '';

    const i0 = note.cards[0] && note.cards[0].image ? note.cards[0].image : '';
    const i1 = note.cards[1] && note.cards[1].image ? note.cards[1].image : '';
    const i2 = note.cards[2] && note.cards[2].image ? note.cards[2].image : '';

    const cardType0 =
      note.cards[0] && note.cards[0].type ? note.cards[0].type : '';
    const cardType1 =
      note.cards[1] && note.cards[1].type ? note.cards[1].type : '';
    const cardType2 =
      note.cards[2] && note.cards[2].type ? note.cards[2].type : '';

    const cardData0 =
      note.cards[0] && note.cards[0].data ? note.cards[0].data : null;
    const cardData1 =
      note.cards[1] && note.cards[1].data ? note.cards[1].data : null;
    const cardData2 =
      note.cards[2] && note.cards[2].data ? note.cards[2].data : null;

    setValues([t0, t1, t2]);

    async function t() {
      const img0 =
        typeof i0 === 'string' && i0.startsWith('data:image/png;base64')
          ? i0
          : await getImage(i0);
      const img1 =
        typeof i1 === 'string' && i1.startsWith('data:image/png;base64')
          ? i1
          : await getImage(i1);
      const img2 =
        typeof i2 === 'string' && i2.startsWith('data:image/png;base64')
          ? i2
          : await getImage(i2);
      setImagesSrc([img0, img1, img2]);
    }
    t();

    setImagesId([i0, i1, i2]);
    setCardTypes([cardType0, cardType1, cardType2]);
    setCardData([cardData0, cardData1, cardData2]);

    setSelectedNote(result.note);
    setInputText(t0);
    setTwoTextMore(!!t1 || !!t2 || !!i1 || !!i2 || result.note.hasQuiz);

    let ts = result.note.tags || [];
    if (!ts.map) ts = ts.split(',');
    setTags(ts);
  }, [result]);

  useEffect(() => {
    setShowAnnotation(!compactView);
  }, [compactView]);

  useEffect(() => {
    if (isInNotesUIView) {
      setShowAnnotation(!showNoteOnly);
    }
  }, [showNoteOnly]);

  const tryToJumpQuiz = async () => {
    if (!selectedNote || !selectedNote.hasQuiz) return;
    const quizList = await getQuizProblemsBySourceKey(selectedNote.id);
    if (quizList && quizList.length > 0) showQuizHandler(quizList);
  };

  const handleImageFileChange = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imageDataUrl = reader.result;
      imagesSrc[selectedSide] = imageDataUrl;
      setImagesSrc(imagesSrc);
    };
    reader.readAsDataURL(file);
  };

  const handleSideChange = (event) => {
    const side = event.target.value;
    setSelectedSide(side);
    setInputText(values[side]);
  };

  const handleTextChanges = (text) => {
    setValues([
      selectedSide == 0 ? text : values[0],
      selectedSide == 1 ? text : values[1],
      selectedSide == 2 ? text : values[2],
    ]);
    setInputText(text);
  };

  const handleNoteSettingChanged = (note) => {
    setSelectedNote(note);
    setOpenCarSettingModal(false);
  };

  const getImageCode = () => {
    if (!imagesSrc) return null;
    return imagesSrc[selectedSide || 0];
  };
  const updateFieldForNote = (prop2values) => {
    if (!selectedNote) return;
    const updatedNote = {
      ...selectedNote,
      ...prop2values,
    };
    ReplaceNote(updatedNote);
  };

  const updateTextForNote = async () => {
    let newPages = [];
    for (let i = 0; i < 3; i++) {
      let imageId = imagesId[i];
      const image = imagesSrc[i];
      if (image) {
        const m = await customStorage.createImage(image);
        imageId = m.id;
      } else {
        imageId = null;
      }
      const card =
        selectedNote && selectedNote.cards[i] ? selectedNote.cards[i] : {};
      newPages[i] = {
        ...card,
        text: values[i],
        image: imageId,
        type: cardTypes[i],
        data: cardData[i],
      };
    }
    newPages = removeEmptyPages(newPages);
    const updatedNote = {
      ...selectedNote,
      cards: newPages,
    };
    setSelectedNote(updatedNote);
    ReplaceNote(updatedNote);
  };
  // update rate
  const updateRateForNote = (newValue) => {
    updateFieldForNote({ rate: newValue });
  };
  const updateColorForNote = (newValue) => {
    updateFieldForNote({ color: newValue });
  };

  // in current implementation, tags update available in none-edit mode.
  const updateTagsForNote = (tags) => {
    updateFieldForNote({ tags });
    setTags(tags);
  };

  // delete note function
  const deleteNote = () => {
    // const deleted = notes.filter((note) => note.id !== id);
    if (selectedNote && deleteAction) deleteAction(selectedNote);
  };

  if (selectedNote == null) return null;
  const hasCard1 = selectedNote.cards[1] && selectedNote.cards[1].text;
  const hasCard2 = selectedNote.cards[2] && selectedNote.cards[2].text;
  const needPageSwitch = edit || hasCard1 || hasCard2 || selectedNote.hasQuiz;

  if (edit)
    return (
      <StyledCard
        ref={containerRef}
        sx={{
          margin: noPadding ? 0 : '4px',
          maxWidth: size.width,
          maxHeight: size.height,
          width: noPadding ? '100%' : undefined,
          height: noPadding ? '100%' : undefined,
          backgroundColor: useBgColor ? selectedNote.color : 'white',
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          borderRadius: noPadding ? '12px' : undefined,
        }}
      >
        <CardHeaderNoSwitch
          selectedNote={selectedNote}
          compact={!showAnnotation}
          useJumpToSource
          colorAction={(color) => updateColorForNote(color)}
          {...(compactMenu
            ? { showLayout: false }
            : { setEmphasis, setEntry })}
          openCarSettingModal={setOpenCarSettingModal}
          deleteNoteAction={deleteNote}
          toolbarMode={toolbarMode}
        />
        {getImageCode() && (
          <CardMedia component="img" height="194" image={getImageCode()} />
        )}

        <CardContent
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            margin: '2px !important',
            paddingBottom: '0px !important',
          }}
        >
          <TextField
            fullWidth
            multiline
            minRows={6}
            value={inputText}
            placeholder="Type...."
            onChange={(e) => {
              handleTextChanges(e.target.value);
            }}
            sx={{ flexGrow: 1 }}
            variant="outlined"
          />
        </CardContent>
        <CardActions
          disableSpacing
          sx={{ margin: '0px !important', paddingBottom: '0px !important' }}
        >
          <Grid container spacing={0.5} alignItems="center">
            <Grid item container justifyContent="flex-start" spacing={0.5}>
              <ImageFileInput onChange={handleImageFileChange} />
            </Grid>
            <Grid item container justifyContent="flex-end" spacing={0.5}>
              {needPageSwitch && (
                <PageSwitcher
                  selectedNote={selectedNote}
                  edit={edit}
                  selectedSide={selectedSide}
                  handleSideChange={handleSideChange}
                  openQuizView={tryToJumpQuiz}
                />
              )}
              <Tooltip title="Save">
                <IconButton
                  size="small"
                  onClick={() => {
                    setEdit(!edit);
                    updateTextForNote();
                  }}
                  aria-label="edit"
                >
                  <SaveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  onClick={() => deleteNote()}
                  aria-label="delete"
                >
                  <DeleteForeverOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Grid>
          </Grid>
        </CardActions>
        {openCarSettingModal && (
          <CardSettingModal
            curNote={selectedNote}
            width="240"
            height="330"
            open
            callback={handleNoteSettingChanged}
          />
        )}
      </StyledCard>
    );
  if (!showAnnotation)
    return (
      <NoteCardSurface
        ref={containerRef}
        accentColor={selectedNote.color}
        useFlatBackground={!!useBgColor}
        dense={!!noPadding}
        sx={{
          margin: noPadding ? 0 : '6px 3px',
          height: noPadding ? '100%' : (useMiniHeight ? undefined : size.height),
          minHeight: useMiniHeight ? size.height : undefined,
          maxHeight: useMiniHeight && maxHeight ? maxHeight : undefined,
          overflow: useMiniHeight && maxHeight ? 'hidden' : undefined,
          width: noPadding ? '100%' : size.width,
        }}
        onClick={selectHandler}
      >
        <CardHeaderNoSwitch
          selectedNote={selectedNote}
          compact={!showAnnotation}
          useJumpToSource
          toggleAnnotation={() => setShowAnnotation(!showAnnotation)}
          customActionName={customActionName}
          customAction={customAction}
          {...(compactMenu
            ? { showLayout: false }
            : { setEmphasis, setEntry })}
          openCarSettingModal={setOpenCarSettingModal}
          setEditMode={setEdit}
          deleteNoteAction={deleteNote}
          toolbarMode={toolbarMode}
        />

        <CardContentSwitcher
          imageCodes={imagesSrc}
          cardTypes={cardTypes}
          cardDatums={selectedNote ? selectedNote.cards : []}
          title={selectedNote ? selectedNote.title : ''}
          selectedSide={selectedSide}
          cardWidth={size.width - 8}
          cardHeight={size.height - (needPageSwitch ? 40 : 10)}
          entryEffect={entry}
          emphasisEffect={emphasis}
          useMiniHeight={useMiniHeight}
        />

        <CardActions
          disableSpacing
          sx={{ margin: '0px !important', paddingBottom: '0px !important' }}
        >
          {needPageSwitch && (
            <Grid container spacing={0.5} alignItems="center">
              <Grid
                item
                container
                xs={12}
                justifyContent="flex-start"
                spacing={0.5}
              >
                <PageSwitcher
                  selectedNote={selectedNote}
                  edit={edit}
                  selectedSide={selectedSide}
                  handleSideChange={handleSideChange}
                  openQuizView={tryToJumpQuiz}
                />
              </Grid>
            </Grid>
          )}
        </CardActions>
      </NoteCardSurface>
    );

  return (
    <NoteCardSurface
      ref={containerRef}
      accentColor={selectedNote.color}
      useFlatBackground={!!useBgColor}
      dense={!!noPadding}
      sx={{
        // useMiniHeight on Path 3 means "fill the parent (column / grid
        // cell) horizontally and grow with content vertically, but never
        // shrink below size.{width,height} as a minimum". This makes
        // masonry-style layouts work correctly — the card uses the full
        // column width instead of leaving ~70px empty when columns are
        // wider than cardWidth, and short content doesn't get forced
        // into oversized cards.
        width: noPadding ? '100%' : (useMiniHeight ? '100%' : size.width),
        minWidth: useMiniHeight ? size.width : undefined,
        height: noPadding
          ? '100%'
          : (useMiniHeight ? undefined : size.height),
        minHeight: useMiniHeight ? size.height : undefined,
        maxHeight: useMiniHeight && maxHeight ? maxHeight : undefined,
        overflow: useMiniHeight && maxHeight ? 'hidden' : undefined,
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={selectHandler}
    >
      <CardHeaderNoSwitch
        selectedNote={selectedNote}
        compact={!showAnnotation}
        useJumpToSource
        toggleAnnotation={() => setShowAnnotation(!showAnnotation)}
        colorAction={(color) => updateColorForNote(color)}
        customActionName={customActionName}
        customAction={customAction}
        deleteActionName={deleteActionName}
        deleteAction={deleteAction}
        {...(compactMenu
          ? { showLayout: false }
          : { setEmphasis, setEntry })}
        openCarSettingModal={setOpenCarSettingModal}
        setEditMode={setEdit}
        deleteNoteAction={deleteNote}
        toolbarMode={toolbarMode}
      />
      <Grid container spacing={0.5} alignItems="center">
        <Grid item container justifyContent="flex-start" spacing={0.5}>
          <Rating
            name="note-rate"
            size="small"
            sx={{
              marginTop: '2px !important',
              marginLeft: '12px !important',
              padding: '0px !important',
              // Shrink stars from MUI's default 18px → 14px so the
              // rating row doesn't dominate the card's vertical space.
              '& .MuiSvgIcon-root': {
                fontSize: 14,
              },
            }}
            value={selectedNote.rate}
            onChange={(event, newValue) => updateRateForNote(newValue)}
          />
        </Grid>
      </Grid>
      <CardContentSwitcher
        imageCodes={imagesSrc}
        cardTypes={cardTypes}
        cardDatums={selectedNote ? selectedNote.cards : []}
        title={selectedNote ? selectedNote.title : ''}
        selectedSide={selectedSide}
        cardWidth={size.width - 8}
        cardHeight={size.height - (selectedNote.title ? 80 : 40)}
        entryEffect={entry}
        emphasisEffect={emphasis}
        // isMoodBoard
      />

      <CardActions
        disableSpacing
        sx={{ margin: '0px !important', padding: '0px !important' }}
      >
        <div style={{ width: '100%', margin: '0px' }}>
          <Grid
            container
            style={{ width: '100%', margin: '0px' }}
            alignItems="center"
          >
            {needPageSwitch && (
              <Grid item justifyContent="flex-start">
                <PageSwitcher
                  selectedNote={selectedNote}
                  edit={edit}
                  selectedSide={selectedSide}
                  handleSideChange={handleSideChange}
                  openQuizView={tryToJumpQuiz}
                />
              </Grid>
            )}
            <Grid item justifyContent="flex-end">
              {/*
                The original "Add a tag" copy was the input's placeholder
                AND the click target — clicking the placeholder text
                focused the input. Replacing the placeholder with an icon
                broke that affordance.
                Wrap both icon and input in a <label> so clicking
                anywhere in the row focuses the nested input element
                (native label-for-input behavior, no JS focus management).
              */}
              <Box
                component="label"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  paddingLeft: '8px',
                  cursor: 'text',
                  width: '100%',
                }}
              >
                <LocalOfferIcon
                  sx={{
                    fontSize: 14,
                    color: 'text.disabled',
                    flexShrink: 0,
                  }}
                />
                <TagsInputNoBorder
                  value={tags}
                  onChange={(tags) => updateTagsForNote(tags)}
                  inputProps={{ placeholder: '+ tag' }}
                />
              </Box>
            </Grid>
          </Grid>
        </div>
      </CardActions>
      {openCarSettingModal && (
        <CardSettingModal
          curNote={selectedNote}
          width="240"
          height="320"
          open
          callback={handleNoteSettingChanged}
        />
      )}
    </NoteCardSurface>
  );
}

export default NoteUI;

// <ExpandMore
//   expand={expanded}
//   onClick={handleExpandClick}
//   aria-expanded={expanded}
//   aria-label="show more"
// >
//   <ExpandMoreIcon />
// </ExpandMore>
// <Collapse in={expanded} timeout="auto" unmountOnExit>
//   <CardContent>
//     {selectedNote.extraHtml && (
//       <div dangerouslySetInnerHTML={{ __html: selectedNote.extraHtml }} />
//     )}
//   </CardContent>
// </Collapse>
