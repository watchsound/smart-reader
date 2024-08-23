/* eslint-disable no-use-before-define */
/* eslint-disable no-inner-declarations */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
/* eslint-disable no-underscore-dangle */
/* eslint-disable react/no-this-in-sfc */
/* eslint-disable no-console */
/* eslint-disable default-param-last */
/* eslint-disable consistent-return */
/* eslint-disable promise/catch-or-return */
/* eslint-disable func-names */
/* eslint-disable promise/no-callback-in-promise */
/* eslint-disable promise/always-return */
import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
// import { ReactReader } from 'react-reader'
import { Pane } from 'marks-pane';
import { ReactReader } from 'react-reader';
// import { NavItem, Rendition } from 'epubjs';
// import rangy from 'rangy';
import html2canvas from 'html2canvas';
// import CameraIcon from '@mui/icons-material/Camera';
import { v4 as uuid } from 'uuid';
// import Typography from '@mui/material/Typography';
import { useSelector, useDispatch } from 'react-redux';
import isEqual from 'is-equal';
import watch from 'redux-watch';
import axios from 'axios';

// import { not } from 'cheerio/lib/api/traversing';
import CreateAnnotationDialog from './CreateAnnotationDialog';

import {
  Underline,
  Dashline,
  Strikeline,
  Hasnote,
  Highlightmark,
} from '../../utils/native-subclasses/my-marks';

// import { globalContext } from '../../utils/globalContext';
import { getBookNotes, updateBook, createImage } from '../../api/booksApi';

import { useCreateNoteMutation } from '../../store/api/noteApiSlice';

import {
  notesQueried,
  searchTextInBookResultHandled,
  communityNoteSelected,
} from '../../store/reducers/readerSlice';
import AreaCapture from '../../components/AreaCapture';
import { note2rendition } from './AnnotationNoteUtil';
import store from '../../store/store';
import CreateNoteModal from '../../components/chat/CreateNoteModal';
import { NoteType } from '../../../commons/model/Note';
import { SelectionType } from './CreateAnnotationPanel';
import openImpressWindow from '../../components/impressjs';
import customStorage from '../../store/customStorage';

const cardWidth = 360;

function EPubView({ bookPath, curBook, curCfi }) {
  const [selections, setSelections] = useState([]);
  const [rendition, setRendition] = useState(null);
  const [location, setLocation] = useState(0);
  const [page, setPage] = useState({
    curPage: 0,
    totalPages: 0,
    curChapter: '',
    curChapterId: '',
  });
  const toc = useRef([]);

  const [openDialog, setOpenDialog] = useState(false);
  const [openNoteDialog, setOpenNoteDialog] = useState(false);
  const [openImageNoteDialog, setOpenImageNoteDialog] = useState(false);
  const [noteColor, setNoteColor] = useState(null);
  const [showToc, setShowToc] = useState(true);
  const [cfiRange, setCfiRange] = useState(null);
  const [book, setBook] = useState(curBook);
  const [localBookPath, setLocalBookPath] = useState(bookPath);
  const [emoji, setEmoji] = useState('');
  const [type, setType] = useState('underline');
  const [popupLoc, setPopupLoc] = useState({ top: 100, left: 100 });
  const [imageData, setImageData] = useState('');
  const [useCapture, setUseCapture] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [assetsPath, setAssetsPath] = useState('');
  // const [showImpressjs, setShowImpressjs] = useState(false);
  // const [renditionInitialized, setRenditionInitialized] = useState(false);
  const epubElement = useRef();
  const mouseDownLoc = useRef();
  const endSelection = useRef();
  // const curSearchTextInBookRef = useRef(curSearchTextInBook);
  const [cfiChange, setCfiChange] = useState('');
  const [communityNotes, setCommunityNotes] = useState([]);
  // const cfiChangeRef = useRef(cfiChange);
  const showCommunityNote = useSelector(
    (state) => state.reader.showCommunityNote,
  );
  const searchTextInBook = useSelector(
    (state) => state.reader.searchTextInBook,
  );
  const [CreateNote] = useCreateNoteMutation();
  const dispatch = useDispatch();

  useEffect(() => {
    if (!rendition || !book || book.idFromServer < 0) return;
    deleteAnnotations();
    if (!showCommunityNote) return;
    function showCommunityNotes() {
      communityNotes.forEach((note) => {
        rendition.annotations.add(
          'highlight',
          note.cfiLocation,
          { searchResult: false, annotationsId: note.id, emoji: note.emoji },
          undefined,
          'hl',
          {
            fill: 'red',
            'fill-opacity': '0.5',
            'mix-blend-mode': 'multiply',
          },
        );
      });
    }
    async function t() {
      try {
        const serverUrl = await customStorage.getServerUrl;
        const response = await axios.get(
          `${serverUrl}/api/annotations/bybookid?bookId=${book.idFromServer}`,
        );
        if (response.ok || response.status === 200) {
          setCommunityNotes(response.data);
          showCommunityNotes();
        } else {
          setCommunityNotes([]);
          console.error('Failed to fetch annotations');
        }
      } catch (error) {
        console.error('Failed to fetch annotation', error);
      }
    }

    if (communityNotes.length === 0) {
      t();
    } else {
      showCommunityNotes();
    }
  }, [showCommunityNote]);

  useEffect(() => {
    setSearchText(searchTextInBook);
    if (!searchTextInBook || searchTextInBook.length === 0) {
      dispatch(searchTextInBookResultHandled([]));
      return;
    }
    searchTextHandle(searchTextInBook, (r) => {
      if (r && r.length > 0) dispatch(searchTextInBookResultHandled(r));
    });
  }, [searchTextInBook]);

  useEffect(() => {
    if (curBook) setBook(curBook);
  }, [curBook]);

  useEffect(() => {
    async function t() {
      const aPath = await window.electron.ipcRenderer.getAssetRootPath();
      setAssetsPath(aPath);
    }
    t();
  }, []);

  useEffect(() => {
    if (!rendition) return;
    const w = watch(store.getState, 'reader.cfiChange', isEqual);
    const unsubscribe = store.subscribe(
      w((newVal, oldVal, objectPath) => {
        setCfiChange(newVal);
        scrollToCFI(newVal);
      }),
    );
    return () => unsubscribe();
  }, [rendition]);

  function capitalizeFirstLetter(string) {
    if (!string) return string; // Handle empty string case
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  function setupRendererViewCustomized(rendition) {
    rendition.View.prototype.underline = function (
      cfiRange,
      data = {},
      cb,
      className = 'epubjs-ul',
      styles = {},
    ) {
      if (!this.contents) {
        return;
      }

      let markClassName = styles.mtype ? styles.mtype : 'underline';
      markClassName = capitalizeFirstLetter(markClassName);
      if (markClassName === 'Highlight') markClassName = 'HighlightMark';
      console.log(`markClassName = ${markClassName}`);
      const attributes = {
        stroke: 'black',
        'stroke-opacity': '0.3',
        'mix-blend-mode': 'multiply',
        ...styles,
      };
      delete attributes.mtype;
      const range = this.contents.range(cfiRange);
      const emitter = () => {
        // this.emit(EVENTS.VIEWS.MARK_CLICKED, cfiRange, data);
        this.emit('markClicked', cfiRange, data);
      };

      // data.epubcfi = cfiRange;

      if (!this.pane) {
        this.pane = new Pane(this.iframe, this.element);
      }

      const m = new rendition[markClassName](
        range,
        className,
        { ...data, epubcfi: cfiRange },
        attributes,
        assetsPath,
      );
      const h = this.pane.addMark(m);

      this.underlines[cfiRange] = {
        mark: h,
        element: h.element,
        listeners: [emitter, cb],
      };

      h.element.setAttribute('ref', className);
      h.element.addEventListener('click', emitter);
      h.element.addEventListener('touchstart', emitter);

      if (cb) {
        h.element.addEventListener('click', cb);
        h.element.addEventListener('touchstart', cb);
      }
      return h;
    };
  }
  const checkRenditionView = rendition ? rendition.View : null;
  useEffect(() => {
    if (rendition && rendition.View) setupRendererViewCustomized(rendition);
  }, [checkRenditionView]);

  function setupRendererCustomized(rendition) {
    if (!rendition) return;
    // FIXME -  css injected here is to iframe.  but we use svg annotation , it is outside iframe
    // rendition.hooks.render.register(function (view) {
    //   view.contents.addStylesheet('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css')
    //      .then(function () {
    //           return view.contents.addStylesheetCss("svg text {  font-family: 'Font Awesome 5 Free'; }")
    //         // return view.contents.addStylesheetRules( [
    //         //           ['svg text', ['font-family', 'Font Awesome 5 Free']]
    //         //         ]  );
    //       })
    // }
    // )
    Object.getPrototypeOf(rendition.annotations).checkAnnotations = function (
      callback,
    ) {
      Object.keys(this._annotations).forEach((key) => {
        console.log(`${key}: ${this._annotations[key]}`);
        callback(key, this._annotations[key]);
      });
    };
    Object.getPrototypeOf(rendition.annotations).deleteAnnotations = function (
      view,
      filter,
    ) {
      Object.keys(this._annotations).forEach((key) => {
        console.log(`${key}: ${this._annotations[key]}`);
        const annot = this._annotations[key];
        if (filter(annot)) {
          annot.detach(view);
          rendition.annotations.remove(annot.cfiRange, annot.type);
          delete this._annotations[key];
        }
      });
    };
    rendition.Dashline = Dashline;
    rendition.Underline = Underline;
    rendition.Strikeline = Strikeline;
    rendition.Hasnote = Hasnote;
    rendition.Highlightmark = Highlightmark;
  }

  function setRenderSelection(cfiRange, contents) {
    if (rendition) {
      setSelections((list) =>
        list.concat({
          text: rendition.getRange(cfiRange).toString(),
          cfiRange,
        }),
      );
      setCfiRange(cfiRange);
      setImageData('');
      endSelection.current = true;
      rendition.annotations.add('highlight', cfiRange, {}, undefined, 'hl', {
        fill: 'red',
        'fill-opacity': '0.5',
        'mix-blend-mode': 'multiply',
      });

      const selection = contents.window.getSelection();
      if (selection) selection.removeAllRanges();
    }
  }
  useEffect(() => {
    if (rendition) {
      setupRendererCustomized(rendition);
      rendition.on('markClicked', (e) => {
        // return
        console.log(`mark clicked ${e}`);
        console.log(typeof e);
        rendition.annotations.checkAnnotations((id, item) => {
          if (item.cfiRange === e) {
            console.log('found');
            if (item.data && item.data.annotationsId) {
              // from server
              dispatch(communityNoteSelected(item.data.annotationsId));
            }
          }
        });
      });
      rendition.on('mousedown', (e) => {
        // return
        mouseDownLoc.current = { x: e.x, y: e.y };
      });
      rendition.on('mouseup', (e) => {
        // return
        const loc = mouseDownLoc.current;
        if (
          !loc ||
          (loc.x - e.x) * (loc.x - e.x) + (loc.y - e.y) * (loc.y - e.y) < 8
        )
          return;
        setTimeout(function () {
          if (!endSelection.current) return;
          endSelection.current = false;
          const containerRect = epubElement.current.getBoundingClientRect();
          //  alert( containerRect )
          setPopupLoc({
            left: e.x + containerRect.x,
            top: e.y + containerRect.y,
          });
          setOpenDialog(true);
        }, 500);
      });
    }
    if (rendition) rendition.on('selected', setRenderSelection);
    return () => {
      if (rendition) rendition.off('selected', setRenderSelection);
    };
  }, [rendition]);

  useEffect(() => {
    if (!curCfi) return;
    setTimeout(() => {
      scrollToCFI(curCfi);
    }, 1000);
  }, [curCfi]);

  const epubIFrame = useMemo(() => {
    return (
      <ReactReader
        url={localBookPath}
        tocChanged={(_toc) => {
          toc.current = _toc;
          console.log(_toc);
        }}
        location={location}
        locationChanged={(epubcfi) => {
          setLocation(epubcfi);
          if (rendition && toc.current) {
            const { displayed, href } = rendition.location.start;
            const chapter = toc.current.find((item) =>
              item.href.startsWith(href),
            );
            setPage({
              curPage: displayed.page,
              totalPages: displayed.total,
              curChapter: chapter ? chapter.label : 'n/a',
              curChapterId: chapter ? chapter.id : '',
            });
            handlePageChange(displayed.page);
          }
        }}
        getRendition={(_rendition) => {
          setRendition(_rendition);
        }}
        showToc={showToc}
        epubOptions={{
          allowPopups: true, // Adds `allow-popups` to sandbox-attribute
          allowScriptedContent: true, // Adds `allow-scripts` to sandbox-attribute
        }}
      />
    );
  }, [localBookPath, rendition]);

  let scrollToCFI = (cfi) => {
    if (rendition && cfi) {
      rendition.display(cfi);
    }
  };

  const onCaptureCompleteLocal = (imageData) => {
    setUseCapture(false);
    setImageData(imageData || '');
    if (imageData) setOpenImageNoteDialog(true);
  };

  const deleteAnnotations = (deleteSearchResultOnly) => {
    if (!rendition) return;
    if (rendition.views() && rendition.views()._views)
      rendition.annotations.deleteAnnotations(
        rendition.views()._views[0],
        (annotation) => {
          if (deleteSearchResultOnly) {
            return annotation.data.searchResult;
          }
          return true;
        },
      );
  };

  // search text and return a list of matches {cfi, excerpt}
  let searchTextHandle = useCallback(
    async (searchText, callback) => {
      if (!rendition) return;

      deleteAnnotations(true);
      if (searchText.length <= 1) {
        return;
      }

      const { spineItems } = rendition.book.spine;
      // const itemCounts = spineItems.length;
      const results = [];
      let preCfi = null;

      async function searchInSpine(spineIndex) {
        // const spineItem = spineItems[spineIndex];
        // const spineId = spineItem.id || spineItem.idref;
        // let section = rendition.book.spine.get(spineId);
        // if (section == null) {
        //   section = rendition.book.spine.get(spineItem.idref);
        // }
        const section = spineItems[spineIndex];
        if (section == null) {
          // itemCounts -= 1;

          return;
        }
        await section.load(rendition.book.load.bind(rendition.book));
        // .then(function () {
        // return a list of {cfi, excerpt}
        const searchResults = section.search(searchText);
        const findResults = section.find(searchText);
        [findResults, searchResults].forEach((rs) => {
          if (rs && rs.length) {
            for (const r in rs) {
              // console.log(rs[r]);
              if (preCfi !== rs[r].cfi) {
                results.push({ id: uuid(), data: rs[r] });
                preCfi = rs[r].cfi;
              }

              rendition.annotations.add(
                'highlight',
                rs[r].cfi,
                { searchResult: true, annotationsId: -1 },
                undefined,
                'hl',
                {
                  fill: 'red',
                  'fill-opacity': '0.5',
                  'mix-blend-mode': 'multiply',
                },
              );
            }
          }
        });
      }

      for (
        let spineIndex = 0;
        spineIndex < spineItems.length;
        spineIndex += 1
      ) {
        await searchInSpine(spineIndex);
      }
      if (callback) {
        callback(results);
      }
    },
    [rendition],
  );

  const handleNoteWindowClose = (note) => {
    setOpenDialog(false);
    if (!note) {
      setOpenNoteDialog(false);
      setOpenImageNoteDialog(false);
      setCfiRange(null);
      return;
    }
    const aType = 'underline';
    const className = 'ul';
    const style = { mtype: 'Hasnote', stroke: noteColor };

    rendition.annotations.add(
      aType,
      cfiRange,
      { noteId: note.id },
      undefined, // (e) =>{ console.log("highlight clicked", e.target); },
      className,
      style,
    );
    setOpenNoteDialog(false);
    setOpenImageNoteDialog(false);
    setCfiRange(null);
  };

  const handleAnnotationWindowClose = async (
    selectionType,
    type,
    color,
    emoji,
  ) => {
    console.log(`type = ${type}`);
    rendition.annotations.remove(cfiRange, 'highlight');

    if (selectionType === SelectionType.Cancel) {
      setOpenDialog(false);
      setCfiRange(null);
      return;
    }

    if (selectionType === SelectionType.Presentation) {
      setOpenDialog(false);
      const text = rendition.getRange(cfiRange).toString() || '';
      if (text.length > 50) openImpressWindow({ paragraph: text });
      return;
    }

    if (selectionType === SelectionType.Image) {
      setUseCapture(true);
      setNoteColor(color);
      setEmoji(emoji);
      setType(type);
      setOpenDialog(false);
      setOpenImageNoteDialog(false);
      setOpenNoteDialog(false);
      // setShowImpressjs(false);
      return;
    }

    if (selectionType === SelectionType.Note) {
      setNoteColor(color);
      setEmoji(emoji);
      setOpenDialog(false);
      setOpenImageNoteDialog(false);
      setOpenNoteDialog(true);
      // setShowImpressjs(false);
      return;
    }

    const aType = type === 'highlight' ? 'highlight' : 'underline';
    const className = type === 'highlight' ? 'hl' : 'ul';
    const style =
      type === 'highlight'
        ? { fill: color, 'fill-opacity': '0.5', 'mix-blend-mode': 'multiply' }
        : { mtype: type, stroke: color };
    rendition.annotations.add(
      aType,
      cfiRange,
      { emoji },
      undefined, // (e) =>{ console.log("highlight clicked", e.target); },
      className,
      style,
    );
    // text: rendition.getRange(cfiRange).toString(),
    const newNote = {
      sourceKey: book.id,
      title: '',
      cards: [
        {
          text: rendition.getRange(cfiRange).toString() || '',
          html: '',
        },
      ],
      chapter: '',
      chapterIndex: -1,
      cfi: cfiRange, // cfi
      range: '', // range
      percentage: 0, /// percentage
      sourceType: 'book', // type
      color, // color
      tags: [],
      rate: 0,
      hasQuiz: false, // bug, if create quiz failed?
      position: [],
      emoji,
      highlightOnly: true,
      highlightType: aType,
    };

    await CreateNote(newNote);

    // dispatch(annotationAdded(newAnnotation));
    setOpenDialog(false);
    //  setShowImpressjs(false);
    setCfiRange(null);
  };

  // create book cover image
  const handlePageChange = (pageNumber) => {
    if (pageNumber !== 1) return;
    if (!book || book.cover) return;
    const iframe = document.querySelector('iframe');
    if (!iframe) return;
    iframe.contentWindow.scrollTo(0, 0);
    setTimeout(() => {
      if (!iframe.contentDocument) return;
      html2canvas(iframe.contentDocument.body)
        .then((canvas) => {
          const originalDataURL = canvas.toDataURL('image/png');
          const imageObj = new Image();
          imageObj.onload = async function () {
            // Step 2: Create a new canvas with the desired dimensions
            const ratio = cardWidth / imageObj.width;
            const cardHeight = imageObj.height * ratio;
            const newCanvas = document.createElement('canvas');
            newCanvas.width = cardWidth;
            newCanvas.height = cardHeight;

            // Step 3: Draw the original image onto the new canvas with scaling
            const ctx = newCanvas.getContext('2d');
            ctx.drawImage(imageObj, 0, 0, cardWidth, cardHeight);

            // Continue with your process using the newCanvas
            const dataUrl = newCanvas.toDataURL('image/png');
            console.log(dataUrl);
            const r = await createImage(dataUrl);
            const imageId = r.id;
            updateBook({
              id: book.id,
              field: 'cover',
              value: imageId,
            });
            setBook({ ...book, cover: imageId });
            return true;
          };
          imageObj.src = originalDataURL;
        })
        .catch((e) => {
          console.log(e);
          return false;
        });
    }, 500);
  };

  // this is the entry point
  useEffect(() => {
    setSelections([]);
    setLocation(0);
    setImageData('');
    setPage({
      curPage: 0,
      totalPages: 0,
      curChapter: '',
      curChapterId: '',
    });
    setOpenDialog(false);
    setOpenNoteDialog(false);
    setOpenImageNoteDialog(false);
    setNoteColor(null);
    setShowToc(true);
    setCfiRange(null);
    setBook(curBook);
    setLocalBookPath(bookPath);
    if (rendition) {
      if (rendition.views() && rendition.views()._views)
        rendition.annotations.deleteAnnotations(
          rendition.views()._views[0],
          (annotation) => {
            return true;
          },
        );
      async function t() {
        const bookNotes = await getBookNotes(curBook.id);
        dispatch(notesQueried(bookNotes || []));
        if (bookNotes) {
          console.log(bookNotes);
          console.log(typeof bookNotes);
          bookNotes.forEach((note) => {
            const m = note2rendition(note);
            rendition.annotations.add(
              m.aType,
              m.cfiRange,
              m.detail,
              undefined, // (e) =>{ console.log("highlight clicked", e.target); },
              m.className,
              m.style,
            );
          });
        }
      }
      t();
    }
  }, [bookPath, curBook, rendition]);

  return (
    <>
      <AreaCapture
        useCapture={useCapture}
        onCaptureComplete={onCaptureCompleteLocal}
      >
        <div
          style={{ height: 'calc(100vh - 50px)', width: '100%' }}
          ref={epubElement}
        >
          {epubIFrame}
        </div>
      </AreaCapture>
      <CreateAnnotationDialog
        handleWindowClose={handleAnnotationWindowClose}
        popupLoc={popupLoc}
        open={openDialog}
        showImageOption
        showPresentOption={
          selections &&
          selections[0] &&
          (selections[0].text.toString() || '').length > 50
        }
      />
      {selections[0] && (
        <CreateNoteModal
          sourceType={NoteType.book}
          sourceKey={book.id}
          content={selections[0].text}
          imageData=""
          cfi={selections[0].cfiRange}
          url=""
          emoji
          color
          highlightType="Hasnote"
          showButton={false}
          openDialog={openNoteDialog}
          dialogHandle={handleNoteWindowClose}
        />
      )}
      {location && imageData && (
        <CreateNoteModal
          sourceType={NoteType.book}
          sourceKey={book.id}
          content=""
          imageData={imageData}
          cfi={location}
          url=""
          emoji
          color
          highlightType="Hasnote"
          showButton={false}
          openDialog={openImageNoteDialog}
          dialogHandle={handleNoteWindowClose}
        />
      )}
    </>
  );
}

export default EPubView;

// {showImpressjs && (
//       <Impressjs
//         paragraph={selections[0].text}
//         closeHandler={() => setShowImpressjs(false)}
//       />
//     )}

// <CreateNoteDialog
//       handleWindowClose={handleNoteWindowClose}
//       inputText=""
//       ftag={[]}
//       open={openNoteDialog}
//     />

//   const handleNoteWindowClose = (note, tags, cancel) => {
//   setOpenDialog(false);
//   if (cancel) {
//     setOpenNoteDialog(false);
//     setCfiRange(null);
//     return;
//   }
//   const aType = 'underline';
//   const className = 'ul';
//   const style = { mtype: 'HasNote', stroke: noteColor };
//   const key = uuid();
//   rendition.annotations.add(
//     aType,
//     cfiRange,
//     { noteId: key },
//     undefined, // (e) =>{ console.log("highlight clicked", e.target); },
//     className,
//     style,
//   );

//   const bookNote = {
//     key,
//     sourceKey: book.key,
//     title: '',
//     cards: [
//       {
//         text: note,
//         html: note,
//         image: '',
//         overlap: 0,
//       },
//     ],
//     cfi: cfiRange, // cfi
//     range: '', // range
//     percentage: 0, /// percentage
//     type: 'HasNote', // type
//     color: noteColor, // color
//     tags,
//     rate: 0,
//   };

//   saveBookNote(bookNote.sourceKey, bookNote);
//   dispatch(noteAdded(bookNote));

//   setOpenNoteDialog(false);
//   setCfiRange(null);
// };
