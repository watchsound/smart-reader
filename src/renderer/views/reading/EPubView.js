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
import { generateImpressHTML } from '../../components/impressjs';
import ImpressModal from '../../components/impressjs/ImpressModal';
import customStorage from '../../store/customStorage';
import { useEPUBAnimations } from '../../components/animation-core/adapters/useEPUBAnimations';
import brainApi, { recordEvent, EPISODE_TYPES } from '../../api/brainApi';
import { hashParagraph } from '../../../commons/brain/paragraphHash';
import {
  getAllLearningPoints,
  ensureVocabBackfilled,
} from '../../api/learningPointApi';
import { classify } from '../../utils/srsHaloClassifier';

const cardWidth = 360;

// Phase 4b: extract visible paragraph-like text from the rendered view(s).
// Called on each page change so the parent can feed the micro-card proposer.
//
// epub.js renders ONE iframe per visible page. With its default
// `spread: "auto"` + `minSpreadWidth: 800` settings (we don't override),
// a typical desktop window has TWO iframes side-by-side. We walk every
// entry of `rendition.getContents()` so the right page's paragraphs aren't
// invisible to the proposer.
//
// Returns { text, paragraphMap } where paragraphMap is a Map<paragraphHash,
// HTMLElement>; elements may live in different iframe documents. The chip
// derives the owning iframe from `el.ownerDocument.defaultView.frameElement`
// at measurement time, so a single iframe ref isn't needed here.
function extractPageText(rendition) {
  if (!rendition) return { text: '', paragraphMap: new Map() };
  try {
    const contents =
      typeof rendition.getContents === 'function'
        ? rendition.getContents()
        : [];
    if (!contents || contents.length === 0) {
      return { text: '', paragraphMap: new Map() };
    }
    const parts = [];
    const paragraphMap = new Map();
    contents.forEach((content) => {
      const doc = content?.document;
      if (!doc) return;
      const elements = doc.querySelectorAll('p, li, blockquote');
      Array.from(elements).forEach((el) => {
        const t = (el.textContent || '').trim();
        if (!t) return;
        parts.push(t);
        // Last writer wins on hash collision — chip anchoring is best-effort.
        paragraphMap.set(hashParagraph(t), el);
      });
    });
    return { text: parts.join('\n\n'), paragraphMap };
  } catch (err) {
    console.warn(
      '[EPubView] page text extraction failed:',
      err?.message || err,
    );
    return { text: '', paragraphMap: new Map() };
  }
}

function EPubView({
  bookPath,
  curBook,
  curCfi,
  onSelectionChange,
  onAnimationReady,
  onPageChange,
  onPageText,
  onParagraphAnchor,
  onTocReady,
  onMindMapResult,
}) {
  const [selections, setSelections] = useState([]);
  const [rendition, setRendition] = useState(null);
  const [location, setLocation] = useState(0);
  const [page, setPageState] = useState({
    curPage: 0,
    totalPages: 0,
    curChapter: '',
    curChapterId: '',
  });

  // Update page and notify parent
  const setPage = (pageInfo) => {
    setPageState(pageInfo);
    if (onPageChange) {
      onPageChange(pageInfo);
    }
  };
  const toc = useRef([]);

  // Animation hook - provides smartSummary, highlightVocabulary, etc.
  const animations = useEPUBAnimations(rendition);

  // Notify parent when animations are ready
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
  }, [animations.isReady, onAnimationReady]);

  // SRS Halo (Personal Lexical Halo + Forgetting Fog + Knowledge Accretion).
  // Reads from learning_point — every saved vocab word is mirrored there by
  // VocabularyManager's dual-write, and pre-dual-write rows are caught by
  // the one-shot per-session backfill (vocab-ensure-backfilled IPC).
  //
  // Classifier maps each row to one of three states:
  //   - mastered  → gold ✦ badge
  //   - foggy     → opacity decreases with overdue ratio
  //   - learning  → v1 blue dotted underline (default for in-vocab, not-due)
  //
  // Re-fetched on every chapter render so just-mastered + just-overdue
  // states reflect within one chapter turn, no book reopen needed.
  const animationsReady = animations.isReady;
  const { applySrsHalo } = animations;

  useEffect(() => {
    if (!rendition || !animationsReady || !applySrsHalo) return undefined;

    let cancelled = false;

    const applyHalo = async () => {
      try {
        const token = customStorage.getToken();
        if (!token) return;
        // First call per session triggers a one-shot backfill — idempotent
        // and cached by the main-process handler, so subsequent chapter
        // renders pay only the cache-hit price.
        await ensureVocabBackfilled(token);
        if (cancelled) return;
        const result = await getAllLearningPoints(token, {
          domainType: 'vocabulary',
          pageSize: 5000,
        });
        if (cancelled) return;
        const rows = (result?.items || [])
          .map((r) => ({
            title: r.title,
            fullyLearned: r.fully_learned ?? r.fullyLearned ?? 0,
            box: r.box ?? 1,
            nextReview: r.next_review ?? r.nextReview ?? '',
            intervalDays: r.interval_days ?? r.intervalDays ?? 1,
          }))
          .filter(
            (r) => typeof r.title === 'string' && r.title.trim().length >= 2,
          );
        if (rows.length === 0) return;
        const now = Date.now();
        const items = rows.map((r) => classify(r, now));
        // Defer a tick so the new chapter DOM is fully attached. Mirrors
        // the 100ms delay the adapter uses for its own document re-setup.
        setTimeout(() => {
          if (cancelled) return;
          applySrsHalo(items).catch((err) => {
            console.warn(
              '[EPubView] applySrsHalo failed:',
              err?.message || err,
            );
          });
        }, 150);
      } catch (err) {
        console.warn(
          '[EPubView] srs halo vocab fetch failed:',
          err?.message || err,
        );
      }
    };

    rendition.on('rendered', applyHalo);
    // Trigger once for the chapter that's already on screen when the hook
    // first becomes ready (no 'rendered' event will fire for it).
    applyHalo();

    return () => {
      cancelled = true;
      try {
        rendition.off('rendered', applyHalo);
      } catch (_e) {
        // rendition may already be torn down
      }
    };
  }, [rendition, animationsReady, applySrsHalo]);

  const [openDialog, setOpenDialog] = useState(false);
  const [showImpressModal, setShowImpressModal] = useState(false);
  const [impressContent, setImpressContent] = useState(null);
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
  // Phase 4b: pending page-text extraction timeout. Cancelled on every new
  // locationChanged so rapid page-flips don't fire a stale timeout that
  // would extract the NEW page's text but emit it labeled with the OLD
  // page's chapter context.
  const pageTextTimeoutRef = useRef(null);
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
      const selectedText = rendition.getRange(cfiRange).toString();
      setSelections((list) =>
        list.concat({
          text: selectedText,
          cfiRange,
        }),
      );
      setCfiRange(cfiRange);
      // Notify parent of selection change for skill quick actions
      if (onSelectionChange) {
        onSelectionChange(selectedText);
      }
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
          // Phase 5: surface the raw TOC up so the reading view can run the
          // pre-book diagnostic on first-open. ReactReader fires this once
          // per book load — emitting unconditionally is cheap.
          if (onTocReady) {
            try {
              onTocReady(_toc);
            } catch (_) {
              /* ignore */
            }
          }
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
            // Phase 4b: emit page text once the new view has rendered.
            // Cancel any pending extraction first — fast page-flips would
            // otherwise leak a stale timeout that extracts the NEW page's
            // text but emits it labeled with the OLD page's chapter.
            if (onPageText || onParagraphAnchor) {
              if (pageTextTimeoutRef.current) {
                clearTimeout(pageTextTimeoutRef.current);
              }
              const capturedChapterId = chapter ? chapter.id : '';
              const capturedChapterTitle = chapter ? chapter.label : '';
              pageTextTimeoutRef.current = setTimeout(() => {
                pageTextTimeoutRef.current = null;
                const { text: pageText, paragraphMap } =
                  extractPageText(rendition);
                if (onParagraphAnchor) {
                  // Refresh the anchor lookup on every page-load so a stale
                  // map from the previous page can't pin the chip to an
                  // element that's no longer in the DOM. With two-page
                  // spreads the elements span two iframes; the chip derives
                  // each element's iframe from its ownerDocument, so we
                  // don't pin one iframe ref here.
                  onParagraphAnchor({
                    getElementByHash: (h) => paragraphMap.get(h) || null,
                  });
                }
                if (onPageText && pageText) {
                  onPageText(pageText, {
                    chapterId: capturedChapterId,
                    chapterTitle: capturedChapterTitle,
                  });
                }
              }, 300);
            }
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

    // Record note created episode for brain
    recordEvent.noteCreated({
      noteId: note.id,
      noteTitle: note.title,
      bookId: book?.id,
      bookTitle: book?.title || book?.name,
      chapter: page.curChapter,
      cfi: cfiRange,
      hasImage: !!imageData,
      sourceContext: {
        view: 'reading',
        bookType: 'epub',
      },
    });

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
      if (text.length > 50) {
        // Generate presentation HTML and open in modal
        generateImpressHTML({ paragraph: text }).then((html) => {
          if (html) {
            setImpressContent(html);
            setShowImpressModal(true);
          }
        });
      }
      return;
    }

    if (selectionType === SelectionType.SmartSummary) {
      setOpenDialog(false);
      const text = rendition.getRange(cfiRange).toString() || '';
      if (text.length > 20 && animations.isReady && animations.smartSummary) {
        // Execute smart summary with flying animation
        (async () => {
          try {
            // Import skillApi dynamically to avoid circular deps
            const skillApi = await import('../../api/skillApi').then(
              (m) => m.default,
            );

            // Get vocabulary words for gold highlighting
            const vocabWords =
              (await customStorage.getVocabularyWords?.()) || [];

            // Generate summary using AI
            const result = await skillApi.executeSkill('smart_summary', {
              text,
              vocabularyWords: vocabWords,
              maxWords: 30,
            });

            if (result.success && result.result?.summary) {
              // Trigger the flying word animation
              await animations.smartSummary(
                text,
                result.result.summary,
                vocabWords,
              );
            }
          } catch (error) {
            console.error('Smart Summary error:', error);
          }
        })();
      }
      return;
    }

    if (selectionType === SelectionType.MindMap) {
      setOpenDialog(false);
      const text = rendition.getRange(cfiRange).toString() || '';

      console.log('[MindMap] Starting...', {
        textLength: text?.length,
        hasOnMindMapResult: !!onMindMapResult,
      });

      if (text.length > 20) {
        // Execute mindmap skill
        (async () => {
          try {
            const skillApi = await import('../../api/skillApi').then(
              (m) => m.default,
            );

            console.log('[MindMap] Calling mindmap skill...');

            const result = await skillApi.executeSkill('mindmap', {
              text,
              maxNodes: 8,
              format: 'structured',
            });

            console.log('[MindMap] Skill result:', result);

            if (result.success && result.result) {
              const skillData = result.result;

              // Convert skill result to ReactFlow format
              const { title, root, nodes = [], edges = [] } = skillData;
              const rfNodes = [];
              const rfEdges = [];

              // Add root node
              if (root) {
                rfNodes.push({
                  id: root.id || 'root',
                  position: { x: 0, y: 0 },
                  data: { label: root.text || title || 'Topic' },
                });
              }

              // Convert skill nodes to ReactFlow nodes
              nodes.forEach((node, index) => {
                const level = node.level || 1;
                rfNodes.push({
                  id: node.id,
                  position: { x: level * 180, y: (index + 1) * 80 },
                  data: { label: node.text || '' },
                });
              });

              // Convert skill edges to ReactFlow edges
              edges.forEach((edge, index) => {
                rfEdges.push({
                  id: `e${index}`,
                  source: edge.from,
                  target: edge.to,
                  label: edge.relation || '',
                });
              });

              const width = Math.max(
                300,
                (Math.max(...nodes.map((n) => n.level || 1), 1) + 1) * 180,
              );
              const height = Math.max(200, (nodes.length + 1) * 80);

              const reactFlowData = {
                keywordMap: {
                  width: width + 30,
                  height: height + 30,
                  nodes: rfNodes,
                  edges: rfEdges,
                },
                descriptionMap: {
                  width: width * 1.5,
                  height: height * 1.5,
                  nodes: rfNodes,
                  edges: rfEdges,
                },
              };

              console.log('[MindMap] ReactFlow data:', reactFlowData);

              // Inject mindmap result into chat panel
              if (onMindMapResult) {
                onMindMapResult({
                  skillName: 'mindmap',
                  data: reactFlowData,
                  sourceText:
                    text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                });
              }
            } else {
              console.error(
                '[MindMap] Skill failed:',
                result.error || 'No mindmap data',
              );
            }
          } catch (error) {
            console.error('[MindMap] Error:', error);
          }
        })();
      }
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
    const highlightText = rendition.getRange(cfiRange).toString() || '';
    const newNote = {
      sourceKey: book.id,
      title: '',
      cards: [
        {
          text: highlightText,
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

    // Record highlight created episode for brain
    brainApi.recordEpisode({
      eventType: EPISODE_TYPES.HIGHLIGHT_CREATED,
      payload: {
        bookId: book.id,
        bookTitle: book.title || book.name,
        highlightText: highlightText.substring(0, 200),
        highlightType: aType,
        color,
        chapter: page.curChapter,
        cfi: cfiRange,
      },
      sourceContext: {
        view: 'reading',
        bookType: 'epub',
      },
    });

    // dispatch(annotationAdded(newAnnotation));
    setOpenDialog(false);
    //  setShowImpressjs(false);
    setCfiRange(null);
  };

  // Track if we've already attempted cover capture for this book
  const coverCaptureAttempted = useRef(false);

  // create book cover image - capture from the epub rendition's iframe
  const handlePageChange = (pageNumber) => {
    // Only attempt capture once per book session, and only if book has no cover
    if (coverCaptureAttempted.current) return;
    if (!book || book.cover) return;
    if (!rendition) return;

    // Mark as attempted to prevent multiple captures
    coverCaptureAttempted.current = true;

    // Get the iframe from the rendition's views
    // epub.js stores views in rendition.views()._views array
    const views = rendition.views();
    if (!views || !views._views || views._views.length === 0) {
      coverCaptureAttempted.current = false; // Allow retry
      return;
    }

    const view = views._views[0];
    const iframe = view?.iframe || view?.element?.querySelector('iframe');
    if (!iframe) {
      coverCaptureAttempted.current = false;
      return;
    }

    // Wait for content to fully render (longer timeout for reliability)
    setTimeout(() => {
      try {
        // Try to access iframe content
        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc || !iframeDoc.body) {
          console.log(
            'EPubView: Cannot access iframe content for cover capture',
          );
          return;
        }

        // Scroll to top to capture the beginning of the content
        if (iframe.contentWindow) {
          iframe.contentWindow.scrollTo(0, 0);
        }

        // Additional delay after scroll for rendering
        setTimeout(() => {
          html2canvas(iframeDoc.body, {
            useCORS: true,
            allowTaint: true,
            logging: false,
            scale: 1, // Lower scale for performance
          })
            .then((canvas) => {
              // Validate the captured canvas has actual content
              const ctx = canvas.getContext('2d');
              const imageData = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
              );
              const pixels = imageData.data;

              // Check if image is not blank (has non-white pixels)
              let hasContent = false;
              for (let i = 0; i < pixels.length; i += 4) {
                // Check if pixel is not white/transparent
                if (
                  pixels[i] < 250 ||
                  pixels[i + 1] < 250 ||
                  pixels[i + 2] < 250
                ) {
                  hasContent = true;
                  break;
                }
              }

              if (!hasContent || canvas.width < 50 || canvas.height < 50) {
                console.log(
                  'EPubView: Captured image appears blank or too small',
                );
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
                  console.log('EPubView: Cover image captured successfully');
                }
              };
              imageObj.onerror = () => {
                console.log('EPubView: Failed to load captured image');
              };
              imageObj.src = originalDataURL;
            })
            .catch((e) => {
              console.log('EPubView: html2canvas failed:', e.message);
            });
        }, 300); // Additional delay after scroll
      } catch (e) {
        console.log('EPubView: Cover capture error:', e.message);
      }
    }, 1000); // Initial delay for content rendering
  };

  // this is the entry point
  useEffect(() => {
    // Reset cover capture flag when book changes
    coverCaptureAttempted.current = false;

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

    // Record book opened episode for brain
    if (curBook && curBook.id) {
      recordEvent.bookOpened({
        bookId: curBook.id,
        bookTitle: curBook.title || curBook.name,
        bookType: 'epub',
        sourceContext: {
          view: 'reading',
          path: bookPath,
        },
      });
    }
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
          className="epub-view-container"
          style={{
            height: 'calc(100vh - 64px)',
            width: '100%',
            position: 'relative',
            background: 'var(--bg-paper, #ffffff)',
          }}
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
      {/* Impress.js Presentation Modal */}
      <ImpressModal
        open={showImpressModal}
        onClose={() => {
          setShowImpressModal(false);
          setImpressContent(null);
        }}
        htmlContent={impressContent}
      />
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
