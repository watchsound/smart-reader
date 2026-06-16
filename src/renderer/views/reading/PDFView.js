/* eslint-disable promise/always-return */
/* eslint-disable no-undef */
/* eslint-disable func-names */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/prop-types */
/* eslint-disable radix */
/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable prettier/prettier */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import JSON5 from 'json5';
import html2canvas from 'html2canvas';
import { useTheme } from '@mui/material/styles';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';
import { Alert, Snackbar } from '@mui/material';


import {
  //  GhostHighlight,
  // Highlight,
  PdfHighlighter,
  // PdfHighlighterUtils,
  PdfLoader,
  // Tip,
  // ViewportHighlight,
} from "react-pdf-highlighter-extended-x2";
import CommentForm from "./CommentForm";
// import ContextMenu, { ContextMenuProps } from "./ContextMenu";
// import ExpandableTip from "./ExpandableTip";
import HighlightContainer from "./HighlightContainer";
import Toolbar from './PDFToolbar';
// import { CommentedHighlight } from "./types";

import {
  getBookNotes,
  updateBook,
  createImage,
} from '../../api/booksApi';

import {
  notesQueried,
  communityNoteSelected,
  searchTextInBookResultHandled,
} from '../../store/reducers/readerSlice';

import { noteJson2pdfJson } from '../../../commons/utils/noteUtil';

// import { Spinner } from './Spinner';
import CreatePDFAnnotationDialog from './CreatePDFAnnotationDialog';
import './PDFView.css';
import searchPdfText from './PDFSearchUtil';
import customStorage from '../../store/customStorage';
import ImpressModal from '../../components/impressjs/ImpressModal';
import { usePDFAnimations } from '../../components/animation-core/adapters/usePDFAnimations';
import brainApi, { recordEvent, EPISODE_TYPES } from '../../api/brainApi';

// Width for book cover thumbnail
const cardWidth = 360;

const parseIdFromHash = () => {
  return parseInt(document.location.hash.slice("#highlight-".length));
};

const resetHash = () => {
  document.location.hash = '';
};

function ContextMenu({
  xPos,
  yPos,
  editLabel,
  editComment,
  deleteLabel,
  deleteHighlight,
}) {
  return (
    <div className="context-menu" style={{ top: yPos + 2, left: xPos + 2 }}>
      {editLabel && (
        <button type='button' onClick={editComment}>{editLabel}</button>
      )}
      {deleteLabel && (
        <button type='button' onClick={deleteHighlight}>{deleteLabel}</button>
      )}
    </div>
  );
}


function PDFView({ bookPath, curBook, curNote, onSelectionChange, onAnimationReady, onPageChange, onMindMapResult }) {
  const [url, setUrl] = useState('');
  const [highlights, setHighlights] = useState([]);
  // const currentPdfIndexRef = useRef(0);
  const [contextMenu, setContextMenu] = useState(null);
  const [pdfScaleValue, setPdfScaleValue] = useState( undefined );
  const [communityNotes, setCommunityNotes] = useState([]);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [book, setBook] = useState(curBook);
  const [alert, setAlert] = useState(false);
  const [alertContent, setAlertContent] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [showImpressModal, setShowImpressModal] = useState(false);
  const [impressContent, setImpressContent] = useState(null);

  // Track the last selection to avoid duplicate notifications
  const lastSelectionRef = useRef('');

  const theme = useTheme();
  // const cfiChangeRef = useRef(cfiChange);
  const showCommunityNote = useSelector(
    (state) => state.reader.showCommunityNote,
  );
  const pdfHighlightChanges = useSelector(
    (state) => state.reader.pdfHighlightChanges,
  );
  const searchTextInBook = useSelector(
    (state) => state.reader.searchTextInBook,
  );

  // Refs for PdfHighlighter utilities
  const highlighterUtilsRef = useRef();

  // Ref for PDF container - used by animation system
  const pdfContainerRef = useRef(null);

  // Track if cover capture has been attempted for this book
  const coverCaptureAttempted = useRef(false);

  // Animation hook - provides smartSummary, highlightVocabulary, etc.
  const animations = usePDFAnimations(pdfContainerRef);

  // Notify parent when animation API is ready
  useEffect(() => {
    if (onAnimationReady && animations.isReady) {
      onAnimationReady({
        smartSummary: animations.smartSummary,
        highlightVocabulary: animations.highlightVocabulary,
        glowWords: animations.glowWords,
        removeSummary: animations.removeSummary,
        removeAllEffects: animations.removeAllEffects,
      });
    }
  }, [animations.isReady, onAnimationReady, animations.smartSummary, animations.highlightVocabulary, animations.glowWords, animations.removeSummary, animations.removeAllEffects]);

  const dispatch = useDispatch();

  const getHighlightById = (id) => {
    return highlights.find((highlight) => highlight.id === id);
  };
  useEffect(() => {
    if (pdfHighlightChanges && highlighterUtilsRef.current) {
      highlighterUtilsRef.current.scrollToHighlight(pdfHighlightChanges);
    }
  }, [pdfHighlightChanges]);

  useEffect(() => {
    setSearchText(searchTextInBook);
    if (!searchTextInBook || searchTextInBook.length === 0) {
      const filtered = highlights.filter( (highlight) => typeof highlight.isFromTextSearch === 'undefined' )
      setHighlights(filtered);
      dispatch(searchTextInBookResultHandled([]));
      return;
    }
    if (!pdfDocument) return;
    async function t() {
      const f = await searchPdfText(pdfDocument, searchTextInBook);
      if (f) setHighlights([...highlights, ...f])
      if (f) dispatch(searchTextInBookResultHandled(f));
    }
    t();

  }, [searchTextInBook]);

  useEffect(() => {
    if (!book || typeof book.idFromServer ==='undefined' ) return;
    if (!showCommunityNote) {
      const filtered = highlights.filter( (highlight) => typeof highlight.idFromServer === 'undefined' )
      setHighlights(filtered);
      return;
    };
    async function t() {
      try {
        const serverUrl = await  customStorage.getServerUrl();
        const response = await axios.get(
          `${serverUrl}/api/annotations/bybookid?bookId=${book.idFromServer}`,
        );
        if (response.ok || response.status === 200) {
          const {data} = response;
          const mapped = [];
          data.forEach( (m) => {
            const pdfJson = {
              content: {
                text: '',
              },
              position: JSON5.parse(m.cfiLocation),
              comment: {
                text: '',
              },
              id: m.id,
              idFromServer: m.id,
            };
            mapped.push(pdfJson);
          });
          setCommunityNotes(mapped);
          setHighlights([...highlights, ...mapped]);
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
       setHighlights([...highlights, ...communityNotes]);
    }
  }, [showCommunityNote]);


  // Click listeners for context menu
  useEffect(() => {
    const handleClick = () => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };

    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, [contextMenu]);

  const deleteHighlight = (highlight) => {
    console.log("Deleting highlight", highlight);
    setHighlights(highlights.filter((h) => h.id !== highlight.id));
  };

  const editHighlight = (
    idToUpdate ,
    edit ,
  ) => {
    console.log(`Editing highlight ${idToUpdate} with `, edit);
    setHighlights(
      highlights.map((highlight) =>
        highlight.id === idToUpdate ? { ...highlight, ...edit } : highlight,
      ),
    );
  };

  const resetHighlights = () => {
    setHighlights([]);
  };



  // Open comment tip and update highlight with new user input
  const editComment = (highlight ) => {
    if (!highlighterUtilsRef.current) return;

    const editCommentTip  = {
      position: highlight.position,
      content: (
        <CommentForm
          title={highlight.title}
          summary={highlight.summary}
          highlightType={highlight.highlightType}
          color={highlight.color}
          emoji={highlight.emoji}
          onSubmit={(title, summary, highlightType, color, emoji) => {
            editHighlight(highlight.id, { title, summary, highlightType, color, emoji });
            if (highlighterUtilsRef.current) highlighterUtilsRef.current.setTip(null);
            if (highlighterUtilsRef.current) highlighterUtilsRef.current.toggleEditInProgress(false);
          }}
         />
      ),
    };

    highlighterUtilsRef.current.setTip(editCommentTip);
    highlighterUtilsRef.current.toggleEditInProgress(true);
  };

  // Scroll to highlight based on hash in the URL
  const scrollToHighlightFromHash = () => {
    const highlight = getHighlightById(parseIdFromHash());

    if (highlight && highlighterUtilsRef.current) {
      highlighterUtilsRef.current.scrollToHighlight(highlight);
    }
  };

  const updateHash = (highlight) => {
    document.location.hash = `highlight-${highlight.id}`;
  };

  const handleContextMenu = (
    event ,
    highlight ,
  ) => {
    event.preventDefault();
    if (typeof highlight.idFromServer === 'undefined') {
      setContextMenu({
        xPos: event.clientX,
        yPos: event.clientY,
        editLabel: 'Edit Comment',
        editComment: () => editComment(highlight),
        deleteLabel: 'Delete Highlight',
        deleteHighlight: () => deleteHighlight(highlight),
      });
    } else {
      setContextMenu({
        xPos: event.clientX,
        yPos: event.clientY,
        editLabel: 'Show Community Notes',
        editComment: () => dispatch(communityNoteSelected({id: highlight.idFromServer})),
        deleteLabel: '',
        deleteHighlight: () => {},
      });
    }
  };

  useEffect(() => {
    window.addEventListener('hashchange', scrollToHighlightFromHash, false);
    return () =>
      window.removeEventListener(
        'hashchange',
        scrollToHighlightFromHash,
        false,
      );
  }, []);

  useEffect(() => {
    if( !bookPath ||!curBook) return;
    // Reset cover capture flag when book changes
    coverCaptureAttempted.current = false;
    setUrl(bookPath);
    if (curBook) setBook(curBook);

    // Record book opened episode for brain
    recordEvent.bookOpened({
      bookId: curBook.id,
      bookTitle: curBook.title || curBook.name,
      bookType: 'pdf',
      sourceContext: {
        view: 'reading',
        path: bookPath,
      },
    });

    async function t() {
      const bookNotes = await getBookNotes(curBook.id);
      dispatch(notesQueried(bookNotes || []));
      if (bookNotes) {
        const hs = [];
        bookNotes.forEach((note) => {
          hs.push( noteJson2pdfJson(note, theme) );
        });
        setHighlights(hs);
      }
    };
    try {
      t();
    } catch (e) {
      console.log(e);
    }
  }, [bookPath, curBook]);

  const addHighlightByNote = (note) => {
    if (!note) return;
    console.log('Saving highlight', note);
    setHighlights([ noteJson2pdfJson(note, theme) , ...highlights]);

    // Record highlight/note created episode for brain
    const isHighlightOnly = note.highlightOnly === true;
    brainApi.recordEpisode({
      eventType: isHighlightOnly ? EPISODE_TYPES.HIGHLIGHT_CREATED : EPISODE_TYPES.NOTE_CREATED,
      payload: {
        noteId: note.id,
        bookId: book?.id,
        bookTitle: book?.title || book?.name,
        highlightText: note.cards?.[0]?.text?.substring(0, 200) || '',
        highlightType: note.highlightType,
        color: note.color,
        page: currentPage,
        totalPages,
      },
      sourceContext: {
        view: 'reading',
        bookType: 'pdf',
      },
    });
  };
  const handlePdfError = (error) => {
     console.log(error);
     setAlertContent(error.message);
     setAlert(true);
  };

  // create book cover image
  const tryToCreateCoverImage = () => {
    // Only attempt once per book session
    if (coverCaptureAttempted.current) return;
    if (!book || book.cover) return;

    coverCaptureAttempted.current = true;

    // Use the ref if available, otherwise query for the container
    const pdfContainer = pdfContainerRef.current || document.querySelector('.PdfHighlighter');
    if (!pdfContainer) {
      coverCaptureAttempted.current = false; // Allow retry
      return;
    }

    // Scroll to top to capture the first page
    if (pdfContainer.scrollTo) {
      pdfContainer.scrollTo(0, 0);
    } else {
      pdfContainer.scrollTop = 0;
      pdfContainer.scrollLeft = 0;
    }

    // Wait for content to render after scroll
    setTimeout(() => {
      if (!pdfContainer) return;

      html2canvas(pdfContainer, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: 1,
      })
        .then((canvas) => {
          // Validate the captured canvas has actual content
          const ctx = canvas.getContext('2d');
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const pixels = imageData.data;

          // Check if image is not blank (has non-white/non-gray pixels)
          let hasContent = false;
          for (let i = 0; i < pixels.length; i += 4) {
            // Check if pixel is not white/light gray
            if (pixels[i] < 240 || pixels[i + 1] < 240 || pixels[i + 2] < 240) {
              hasContent = true;
              break;
            }
          }

          if (!hasContent || canvas.width < 50 || canvas.height < 50) {
            console.log('PDFView: Captured image appears blank or too small');
            return;
          }

          const originalDataURL = canvas.toDataURL('image/png');
          const imageObj = new Image();
          imageObj.onload = async function () {
            // Create a new canvas with the desired card dimensions
            const ratio = cardWidth / imageObj.width;
            const cardHeight = imageObj.height * ratio;
            const newCanvas = document.createElement('canvas');
            newCanvas.width = cardWidth;
            newCanvas.height = cardHeight;

            const newCtx = newCanvas.getContext('2d');
            newCtx.drawImage(imageObj, 0, 0, cardWidth, cardHeight);

            const dataUrl = newCanvas.toDataURL('image/png');
            const r = await createImage(dataUrl);
            const imageId = r.id;

            if (imageId && imageId !== -1) {
              updateBook({
                id: book.id,
                field: 'cover',
                value: imageId,
              });
              setBook({ ...book, cover: imageId });
              console.log('PDFView: Cover image captured successfully');
            }
          };
          imageObj.onerror = () => {
            console.log('PDFView: Failed to load captured image');
          };
          imageObj.src = originalDataURL;
        })
        .catch((e) => {
          console.log('PDFView: html2canvas failed:', e.message);
        });
    }, 800); // Delay for PDF rendering
  };

  useEffect(()=> {
    if (!pdfDocument) return;
    setTimeout(() => tryToCreateCoverImage(), 1000);
    // Set total pages and notify parent
    setTotalPages(pdfDocument.numPages);
    if (onPageChange) {
      onPageChange({
        curPage: 1,
        totalPages: pdfDocument.numPages,
        curChapter: book?.title || '',
        curChapterId: '',
      });
    }
  }, [pdfDocument]);

  // Handler for opening presentation modal
  const handleOpenPresentation = (htmlContent) => {
    if (htmlContent) {
      setImpressContent(htmlContent);
      setShowImpressModal(true);
    }
  };

  // Immediate selection handler - called as soon as text selection completes
  // This fires before the annotation dialog, providing instant feedback
  const handleSelection = useCallback((selection) => {
    if (!selection?.content?.text) return;

    const selectedText = selection.content.text.trim();
    // Avoid duplicate notifications for the same selection
    if (selectedText && selectedText !== lastSelectionRef.current && selectedText.length > 0) {
      lastSelectionRef.current = selectedText;
      if (onSelectionChange) {
        onSelectionChange(selectedText);
      }
    }
  }, [onSelectionChange]);

  // const updateHighlight = (highlightId, position, content) => {
  //   console.log('Updating highlight', highlightId, position, content);
  //   setHighlights(
  //     highlights.map((h) => {
  //       if (h.id === highlightId) {
  //         return {
  //           ...h,
  //           position: { ...h.position, ...position },
  //           content: { ...h.content, ...content },
  //         };
  //       }
  //       return h;
  //     }),
  //   );
  // };

  return (
    <div
      ref={pdfContainerRef}
      className="PDFView pdf-view-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 64px)',
        overflow: 'hidden',
        position: 'relative',
        flexGrow: 1,
        background: theme.palette.mode === 'dark' ? '#1a1d21' : '#525659',
        borderRadius: '0 0 8px 8px',
      }}
    >
      <Toolbar setPdfScaleValue={(value) => setPdfScaleValue(value)} />
       <PdfLoader document={url} onError={handlePdfError}>
          {(pdf) => {
            // Set PDF document immediately - no delay needed
            // The previous 500ms delay caused selection timing issues
            if (!pdfDocument) {
              // Use microtask to avoid setState during render
              queueMicrotask(() => setPdfDocument(pdf));
            }
            return (
              <PdfHighlighter
                enableAreaSelection={(event) => event.altKey}
                pdfDocument={pdf}
                onScrollAway={resetHash}
                utilsRef={(_pdfHighlighterUtils) => {
                  highlighterUtilsRef.current = _pdfHighlighterUtils;
                }}
                pdfScaleValue={pdfScaleValue}
                // Immediate selection callback - fires as soon as text is selected
                // This provides instant feedback without waiting for annotation confirmation
                onSelection={handleSelection}
                selectionTip={
                  <CreatePDFAnnotationDialog
                    bookId={book.id}
                    animationApi={animations}
                    onConfirm={ note => {
                      addHighlightByNote(note);
                      // Clear the last selection ref so the same text can be re-selected
                      lastSelectionRef.current = '';
                    }}
                    onOpenPresentation={handleOpenPresentation}
                    onMindMapResult={onMindMapResult}
                  />
                }
                highlights={highlights}
                style={{
                  height: "calc(100% - 41px)",
                }}
              >
                <HighlightContainer
                  editHighlight={editHighlight}
                  onContextMenu={handleContextMenu}
                />
              </PdfHighlighter>
            )
         }}
        </PdfLoader>
        {contextMenu &&  <ContextMenu {...contextMenu} />}

      <Snackbar
          open={alert}
          autoHideDuration={6000}
          onClose={() => setAlert(false)}
        >
          <Alert severity="error">{alertContent}</Alert>
        </Snackbar>

      {/* Impress.js Presentation Modal */}
      <ImpressModal
        open={showImpressModal}
        onClose={() => {
          setShowImpressModal(false);
          setImpressContent(null);
        }}
        htmlContent={impressContent}
      />
    </div>
  );
}

export default PDFView;
