/* eslint-disable promise/catch-or-return */
/* eslint-disable prettier/prettier */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
/* eslint-disable promise/always-return */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import { Box } from '@mui/material';

import CreateAnnotationDialog from '../reading/CreateAnnotationDialog';
import { updateBook } from '../../api/booksApi';
import CreateNoteModal from '../../components/chat/CreateNoteModal';
import { NoteType } from '../../../commons/model/Note';
import customStorage from '../../store/customStorage';
import AreaCapture from '../../components/AreaCapture';
import { StudyMode } from '../../../commons/model/DataTypes';
import CreateVocabularyDialog from './CreateVocabularyDialog';
import openImpressWindow from '../../components/impressjs';
import HistoryTree from './HistoryTree';
import { createRewriteHtmlCodeForWordFrequencyJsonPrompt } from '../../../commons/utils/AIPrompts';
import speakText from '../../utils/tts';
import { instanceInRender as aiProviderManager } from '../../../commons/service/AIProviderManager';

import BrowserToolbar from './BrowserToolbar';
import BrowserSidebar from './BrowserSidebar';
import './browser.styles.css';

function Browser({ urlPath, curBook }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Core state
  const [currentUrl, setCurrentUrl] = useState(urlPath);
  const [filterKey, setFilterKey] = useState('');
  const [cachedUrls, setCachedUrls] = useState([]);
  const [book, setBook] = useState(curBook);
  const [articleStr, setArticleStr] = useState('');
  const [notes, setNotes] = useState([]);
  const [preload, setPreload] = useState('');

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [historyFilterKey, setHistoryFilterKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [openVocabularyDialog, setOpenVocabularyDialog] = useState(false);
  const [openCardDialog, setOpenCardDialog] = useState(false);
  const [useCapture, setUseCapture] = useState(false);

  // Content state
  const [selections, setSelections] = useState(null);
  const [noteColor, setNoteColor] = useState(null);
  const [popupLoc, setPopupLoc] = useState({ top: 100, left: 100 });
  const [cardContent, setCardContent] = useState('');
  const [imageData, setImageData] = useState('');
  const [sourceKey, setSourceKey] = useState(-1);

  // Refs
  const webviewRef = useRef();
  const historyTree = useMemo(() => new HistoryTree(), []);

  // URL caching
  function tryToCacheUrl(value) {
    if (!cachedUrls.includes(value)) {
      setCachedUrls([...cachedUrls, value]);
      customStorage.addToRecentURL(value);
    }
  }

  const handleAddHistory = (url, fromTypeInput) => {
    historyTree.addHistory(url, fromTypeInput);
    setCurrentUrl(url);
    tryToCacheUrl(url);
  };

  // Text extraction
  const extractTextContentFromWeb = () => {
    const webview = webviewRef.current;
    if (!webview) return;
    const script = `
      (function() {
        function getTextContent(node) {
          let text = '';
          if (node.nodeType === Node.TEXT_NODE) {
            text += node.nodeValue;
          } else if (node.nodeType === Node.ELEMENT_NODE && node.nodeName !== 'SCRIPT') {
            for (let child of node.childNodes) {
              text += getTextContent(child);
            }
          }
          return text;
        }
        function removeComments(node) {
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_COMMENT, null, false);
          let comment;
          while ((comment = walker.nextNode())) {
            comment.parentNode.removeChild(comment);
          }
        }
        removeComments(document.body);
        return getTextContent(document.body);
      })();
    `;
    webview.executeJavaScript(script).then((textContent) => {
      setArticleStr(textContent);
    }).catch((error) => {
      console.error('Error extracting text content:', error);
    });
  };

  // Reading level translation
  const translateToPrimarySchool = async (wordLevel) => {
    const webview = webviewRef.current;
    if (!webview) return;
    setIsLoading(true);
    try {
      const htmlContentWithTagsArray = await webview.executeJavaScript(`
(function() {
function getTextContentWithTags(element) {
    let texts = [];
    let currentText = '';
    function addText(type, text) {
        if (type === 'text') {
            if (text.length < 15) {
                if (currentText.length > 0) {
                    texts.push({ type: 'text', data: currentText });
                    currentText = '';
                }
                texts.push({ type: 'others', data: text });
            } else {
                currentText += text;
                while (currentText.length >= 3700) {
                    let splitIndex = findSplitIndex(currentText, 3500, 200);
                    texts.push({ type: 'text', data: currentText.slice(0, splitIndex) });
                    currentText = currentText.slice(splitIndex);
                }
            }
        } else {
            if (currentText.length > 0) {
                texts.push({ type: 'text', data: currentText });
                currentText = '';
            }
            texts.push({ type: type, data: text });
        }
    }
    function flushText() {
        if (currentText.length > 0) {
            texts.push({ type: 'text', data: currentText });
            currentText = '';
        }
    }
    function findSplitIndex(text, base, tolerance) {
        let start = Math.max(0, base - tolerance);
        let end = Math.min(text.length, base + tolerance);
        let sentenceBoundaryRegex = /[.!?](?=\\s|$)/g;
        let match;
        while ((match = sentenceBoundaryRegex.exec(text)) !== null) {
            if (match.index >= start && match.index <= end) {
                return match.index + 1;
            }
        }
        return base;
    }
    function traverseNodes(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const trimmedText = node.textContent.trim();
            if (trimmedText.length > 0) {
                addText('text', trimmedText);
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.tagName.toLowerCase();
            let attributes = '';
            Array.from(node.attributes).forEach(attr => {
                attributes += ' ' + attr.name + '="' + attr.value + '"';
            });
            addText('others', '<' + tag + attributes + '>');
            if (tag === 'script') {
                addText('others', node.innerHTML);
            } else {
                Array.from(node.childNodes).forEach(traverseNodes);
            }
            addText('others', '</' + tag + '>');
        }
    }
    function traverseRootNodes(node) {
        const tag = node.tagName.toLowerCase();
        let attributes = '';
        Array.from(node.attributes).forEach(attr => {
            attributes += ' ' + attr.name + '="' + attr.value + '"';
        });
        texts.push({ type: 'others', data: '<' + tag + attributes + '>' });
        Array.from(node.childNodes).forEach(traverseNodes);
        texts.push({ type: 'others', data: '</' + tag + '>' });
    }
    traverseRootNodes(element);
    flushText();
    return texts;
}
return getTextContentWithTags(document.body);
})();
      `);

      const mapped = [];
      for (let i = 0; i < htmlContentWithTagsArray.length; i++) {
        const htmlContentWithTags = htmlContentWithTagsArray[i];
        if (htmlContentWithTags.type === 'text') {
          const prompt = `${createRewriteHtmlCodeForWordFrequencyJsonPrompt(wordLevel)}\n\n\n${htmlContentWithTags.data}`;
          const htmlJson = await aiProviderManager.generateContentWithJson(prompt, true);
          if (htmlJson && htmlJson['modified-html']) {
            const translatedHTML = JSON.stringify(htmlJson['modified-html']);
            mapped.push(translatedHTML);
          } else {
            mapped.push(htmlContentWithTags.data);
          }
        } else {
          mapped.push(htmlContentWithTags.data);
        }
      }
      let r = mapped.join(' ');
      if (r.charAt(0) === '"') r = r.substring(1);
      if (r.charAt(r.length - 1) === '"') r = r.substring(0, r.length - 1);
      const s = 'document.body.innerHTML = `' + r + '`';
      await webview.executeJavaScript(s);
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Navigation handlers
  async function search(value) {
    handleAddHistory(value || filterKey, true);
  }

  const handleSimpleForward = () => {
    const url = historyTree.simpleForward();
    if (url) setCurrentUrl(url);
  };

  const handleBack = () => {
    const previousUrl = historyTree.back();
    setCurrentUrl(previousUrl);
  };

  const handleForward = (index) => {
    try {
      const nextUrl = historyTree.forward(index);
      setCurrentUrl(nextUrl);
    } catch (error) {
      console.error(error.message);
    }
  };

  const handleRefresh = () => {
    const webview = webviewRef.current;
    if (webview) {
      webview.reload();
    }
  };

  // Bookmark handler
  const createBookmarkHandler = async () => {
    const bookmark = await customStorage.createBookmark(currentUrl);
    if (bookmark) {
      setIsBookmarked(true);
    }
  };

  // Capture handler
  const onCaptureComplete = async (data) => {
    if (!data) return;
    setUseCapture(false);
    setImageData(data);
    const bookmark = await customStorage.createBookmark(currentUrl);
    if (!bookmark) return;
    setSourceKey(bookmark.id);
    setOpenCardDialog(true);
  };

  // Search in page
  const searchInWeb = (text) => {
    const webview = webviewRef.current;
    if (!webview) return;
    if (!text) {
      webview.stopFindInPage('clearSelection');
      return;
    }
    webview.findInPage(text, {
      forward: false,
      findNext: true,
    });
  };

  // Internet check
  async function checkInternet() {
    try {
      const response = await fetch('https://www.example.com/');
      return response.ok || response.status === 200;
    } catch (error) {
      return false;
    }
  }

  // Load page
  async function loadPage(url) {
    try {
      setIsLoading(true);
      if (book) {
        webviewRef.current.src = url;
        return;
      }
      const onLine = await checkInternet();
      if (onLine) {
        webviewRef.current.src = url;
      } else {
        const bookmarks = await customStorage.getBookmarksBySourceKey(url, 'url');
        if (bookmarks && bookmarks.length > 0) {
          const offlinePath = await customStorage.getPDF4URL(bookmarks[0].id);
          if (offlinePath) {
            webviewRef.current.src = `file://${offlinePath}`;
          }
        }
      }
    } catch (e) {
      console.log(e);
    }
  }

  // Scroll progress tracking
  const updateScrollProgress = () => {
    const webview = webviewRef.current;
    if (!webview) return;
    webview.executeJavaScript(`
      (function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        return scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 0;
      })();
    `).then((progress) => {
      setReadingProgress(progress);
    }).catch(() => {});
  };

  // Effects
  useEffect(() => {
    const handleUpdate = () => {
      setUseCapture(true);
    };
    window.electron.ipcRenderer.on('browser-use-area-selection', handleUpdate);
    return () => {
      window.electron.ipcRenderer.removeListener('browser-use-area-selection', handleUpdate);
    };
  }, []);

  useEffect(() => {
    async function t() {
      const currentDirectory = await window.electron.ipcRenderer.dirname();
      const appMode = await window.electron.ipcRenderer.appMode();
      const v = appMode === 'production'
        ? `file://${currentDirectory}/src/renderer/views/browser/preload.js`
        : `file://${currentDirectory}/renderer/views/browser/preload.js`;
      setPreload(v);
      const r = await customStorage.getRecentURL();
      setCachedUrls(r || []);
    }
    t();
  }, []);

  // Context menu handlers
  useEffect(() => {
    const handleContextMenu = ({ command, selectedText }) => {
      if (command === 'createCard') {
        setCardContent(selectedText);
        setOpenCardDialog(true);
      }
      if (command === 'addToWordList') {
        customStorage.addToKeyWordList(StudyMode.Language, selectedText);
        setCardContent(selectedText);
        setOpenVocabularyDialog(true);
      }
      if (command === 'presentation') {
        setCardContent(selectedText);
        openImpressWindow({ paragraph: selectedText });
      }
      if (command === 'tts-for-selection') {
        speakText(selectedText);
      }
    };
    window.electron.ipcRenderer.on('context-menu-command', handleContextMenu);
    return () => {
      window.electron.ipcRenderer.removeListener('context-menu-command', handleContextMenu);
    };
  }, []);

  useEffect(() => {
    window.electron.ipcRenderer.on('open-url', (url) => {
      document.querySelector('webview').src = url;
    });
  }, []);

  // URL path change
  useEffect(() => {
    if (!urlPath) return;
    setSelections(null);
    setOpenDialog(false);
    setNoteColor(null);
    setCurrentUrl(urlPath);
    setBook(curBook);
    loadPage(urlPath);
  }, [urlPath, curBook]);

  // Current URL change
  useEffect(() => {
    setSelections(null);
    setOpenDialog(false);
    setNoteColor(null);
    if (!currentUrl) {
      setNotes([]);
      return;
    }
    async function t() {
      const webview = webviewRef.current;
      if (webview && currentUrl) {
        await loadPage(currentUrl);
      }
      const v = await customStorage.queryNoteBySourceKeyAndSourceType(currentUrl, 'url');
      if (v) setNotes(v);
      // Check if bookmarked
      const bookmarks = await customStorage.getBookmarksBySourceKey(currentUrl, 'url');
      setIsBookmarked(bookmarks && bookmarks.length > 0);
    }
    t();
  }, [currentUrl]);

  // Webview event listeners
  useEffect(() => {
    const webview = webviewRef.current;
    if (webview) {
      const handleDomReady = () => {
        setIsLoading(false);
        setFilterKey(webview.getURL());
        extractTextContentFromWeb();
        // Setup scroll listener
        webview.executeJavaScript(`
          window.addEventListener('scroll', () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const progress = scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 0;
            window.postMessage({ type: 'scroll-progress', progress }, '*');
          });
        `);
        // Capture book cover if needed
        if (book && !book.cover) {
          window.electron.ipcRenderer.capturePage().then((imageId) => {
            if (imageId) {
              updateBook({ id: book.id, field: 'cover', value: imageId });
              setBook({ ...book, cover: imageId });
            }
          });
        }
      };

      const handleWillNavigate = (event) => {
        handleAddHistory(event.url, false);
      };

      const handleNewWindow = (e) => {
        e.preventDefault();
        const { url } = e;
        const newTabWebView = `<webview src="${url}" style="display:inline-flex; width:100%; height:100%"></webview>`;
        webview.webContents.executeJavaScript(
          `document.body.innerHTML += \`${newTabWebView}\`;`,
        );
      };

      const handleIpcMessage = (event) => {
        if (event.channel === 'scroll-progress') {
          setReadingProgress(event.args[0]);
        }
      };

      webview.addEventListener('dom-ready', handleDomReady);
      webview.addEventListener('will-navigate', handleWillNavigate);
      webview.addEventListener('new-window', handleNewWindow);
      webview.addEventListener('ipc-message', handleIpcMessage);

      return () => {
        webview.removeEventListener('dom-ready', handleDomReady);
        webview.removeEventListener('will-navigate', handleWillNavigate);
        webview.removeEventListener('new-window', handleNewWindow);
        webview.removeEventListener('ipc-message', handleIpcMessage);
      };
    }
  }, [currentUrl, book]);

  // Annotation dialog handler
  const handleAnnotationWindowClose = () => {};

  return (
    <div
      className={`browser-container ${isDark ? 'browser-container--dark' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100%',
        background: isDark ? '#1a1d21' : '#f8f8f8',
      }}
    >
      {/* Toolbar */}
      <BrowserToolbar
        currentUrl={currentUrl}
        filterKey={filterKey}
        setFilterKey={setFilterKey}
        cachedUrls={cachedUrls}
        onSearch={search}
        onBack={handleBack}
        onForward={handleForward}
        onSimpleForward={handleSimpleForward}
        onRefresh={handleRefresh}
        canGoBack={historyTree.canBack()}
        canGoForward={historyTree.canForward()}
        forwardChoices={historyTree.getForwardChoices()}
        onBookmark={createBookmarkHandler}
        onCapture={() => setUseCapture(!useCapture)}
        isCapturing={useCapture}
        isBookmarked={isBookmarked}
        onReadingLevelChange={translateToPrimarySchool}
        readingProgress={readingProgress}
        isLoading={isLoading}
      />

      {/* Main Content Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Webview Container */}
        <div
          className="browser-webview-container"
          style={{ flex: 1, position: 'relative' }}
        >
          {/* Loading Skeleton */}
          {isLoading && <div className="browser-loading-skeleton" />}

          {/* Capture Mode Overlay */}
          {useCapture && <div className="browser-capture-overlay" />}

          {/* Reading Progress Indicator */}
          <div className="browser-reading-progress">
            <div
              className="browser-reading-progress-fill"
              style={{ height: `${readingProgress}%` }}
            />
          </div>

          {/* Webview Shadow */}
          <div className="browser-webview-shadow" />

          {/* Area Capture Wrapper */}
          <AreaCapture
            useCapture={useCapture}
            onCaptureComplete={onCaptureComplete}
          >
            <webview
              id="webview"
              allow="display-capture"
              disablewebsecurity="true"
              allowpopups="true"
              nodeintegration="true"
              nodeintegrationinsubframes="true"
              preload={preload}
              ref={webviewRef}
              style={{
                display: 'flex',
                width: '100%',
                height: '100%',
              }}
            />
          </AreaCapture>
        </div>

        {/* Sidebar */}
        <BrowserSidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          notes={notes}
          onSearchInPage={searchInWeb}
          historyFilterKey={historyFilterKey}
          setHistoryFilterKey={setHistoryFilterKey}
          onHistorySelect={(url) => setCurrentUrl(url)}
          articleStr={articleStr}
          curBook={book}
          onAddNote={() => {
            setCardContent('');
            setOpenCardDialog(true);
          }}
        />
      </div>

      {/* Dialogs */}
      {webviewRef.current && (
        <CreateVocabularyDialog
          text={cardContent}
          anchorEl={webviewRef}
          handleWindowClose={() => setOpenVocabularyDialog(false)}
          open={openVocabularyDialog}
        />
      )}

      <CreateAnnotationDialog
        handleWindowClose={handleAnnotationWindowClose}
        popupLoc={popupLoc}
        open={openDialog}
        showImageOption
        showPresentOption={false}
      />

      <CreateNoteModal
        sourceType={NoteType.Url}
        sourceKey={sourceKey}
        content={cardContent}
        imageData={imageData}
        cfi=""
        url=""
        emoji=""
        color=""
        highlightType=""
        showButton={false}
        openDialog={openCardDialog}
        dialogHandle={(newNote) => {
          setOpenCardDialog(false);
          if (newNote) setNotes([...notes, newNote]);
        }}
      />
    </div>
  );
}

export default Browser;
