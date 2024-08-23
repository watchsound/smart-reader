/* eslint-disable promise/catch-or-return */
/* eslint-disable prettier/prettier */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
/* eslint-disable promise/always-return */
import React, { useState, useRef, useEffect, useMemo } from 'react';
// import OpenAI from 'openai';
import SearchIcon from '@mui/icons-material/Search';
import TextField from '@mui/material/TextField';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import IconButton from '@mui/material/IconButton';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Autocomplete from '@mui/material/Autocomplete';
import CameraIcon from '@mui/icons-material/Camera';
import { grey } from '@mui/material/colors';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LinkIcon from '@mui/icons-material/Link';
import { ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import Tab from '@mui/material/Tab';
import TabList from '@mui/lab/TabList';
import TabContext from '@mui/lab/TabContext';
import TabPanel from '@mui/lab/TabPanel';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import TranslateIcon from '@mui/icons-material/Translate';

import CreateAnnotationDialog from '../reading/CreateAnnotationDialog';

import { updateBook } from '../../api/booksApi';
import CreateNoteModal from '../../components/chat/CreateNoteModal';
import { NoteType } from '../../../commons/model/Note';
// import CreateBookmarkModal from '../../components/webpage/CreateBookmarkModal';
import customStorage from '../../store/customStorage';
import AreaCapture from '../../components/AreaCapture';
import TextSearchRow from '../../components/TextSearchRow';
import NoteUI from '../../components/note/NoteUI';
import RightCollapsibleLayout from '../../components/layout/RightCollapsibleLayout';
import { StudyMode } from '../../../commons/model/DataTypes';
import CreateVocabularyDialog from './CreateVocabularyDialog';
import openImpressWindow from '../../components/impressjs';
import HistoryTree from './HistoryTree';
import LongPressButton from '../../components/Button/LongPressButton';
import HistoriesUI from './HistoriesUI';
import { createRewriteHtmlCodeForWordFrequencyJsonPrompt } from '../../../commons/utils/AIPrompts';
import { getTextContentWithTags } from './RewriteHelper';
import speakText from '../../utils/tts';
import InContextChatPanel from '../../components/chat/InContextChatPanel';
import aiProviderManager from '../../../commons/service/AIProviderManager';

const MyTabPanel = styled(TabPanel)({
  padding: '1px 1px',
  margin: '1px 1px',
});

const ScrollPane = styled('div')(({ theme }) => ({
  overflowX: 'hidden',
  overflowY: 'auto',
  height: 'calc(100vh - 120px)',
  width: '100%',
  scrollbarWidth: 'thin',
  scrollbarColor:
    theme.palette.mode === 'light'
      ? grey[100]
      : theme.palette.background.default,
}));

function Browser({ urlPath, curBook }) {
  // urlPath = 'https://www.sina.com.cn/';
  const [selections, setSelections] = useState(null);
  const [filterKey, setFilterKey] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [openVocabularyDialog, setOpenVocabularyDialog] = useState(false);
  // const [openNoteDialog, setOpenNoteDialog] = useState(false);
  // const [openBookmarkDialog, setOpenBookmarkDialog] = useState(false);
  const [noteColor, setNoteColor] = useState(null);
  const [cachedUrls, setCachedUrls] = useState([]);
  const [book, setBook] = useState(curBook);
  const [articleStr, setArticleStr] = useState('');

  const [preload, setPreload] = useState('');
  const [popupLoc, setPopupLoc] = useState({ top: 100, left: 100 });
  const [cardContent, setCardContent] = useState('');
  const [openCardDialog, setOpenCardDialog] = useState(false);
  const [useCapture, setUseCapture] = useState(false);
  const [imageData, setImageData] = useState('');
  const [sourceKey, setSourceKey] = useState(-1);
  const [notes, setNotes] = useState([]);
  // const [apiKey, setApiKey] = useState('');
  // const [model, setModel] = useState('');
  //  const [showImpressjs, setShowImpressjs] = useState(false);
  const [tabValue, setTabValue] = React.useState('1');
  const [historyFilterKey, setHistoryFilterKey] = useState('');
  const webviewRef = useRef();
  const historyTree = useMemo(() => new HistoryTree(), []);
  const [currentUrl, setCurrentUrl] = useState(urlPath);

  const [anchorEl, setAnchorEl] = useState(null);
  const [anchorMoreEl, setAnchorMoreEl] = useState(null);
  const handleMenuMoreOpen = (event) => {
    setAnchorMoreEl(event.currentTarget);
  };
  const handleMenuMoreClose = () => {
    setAnchorMoreEl(null);
  };

  const handleMenuOpen = (event) => {
    event.preventDefault();
    setAnchorEl(event.currentTarget || event.target);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };
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

  const extractTextContentFromWeb = () => {
    const webview = webviewRef.current;
    if (!webview) return;
    const script = `
      (function() {
        // Function to recursively extract text content, ignoring script tags, comments, and attributes
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

        // Remove comments
        function removeComments(node) {
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_COMMENT, null, false);
          let comment;
          while ((comment = walker.nextNode())) {
            comment.parentNode.removeChild(comment);
          }
        }

        // Start from the document body
        removeComments(document.body);
        const textContent = getTextContent(document.body);

        return textContent;
      })();
    `;

    webview.executeJavaScript(script).then((textContent) => {
      setArticleStr(textContent);
    }).catch((error) => {
      console.error('Error extracting text content:', error);
    });
  }

  const translateToPrimarySchool = async (wordLevel) => {
    const webview = webviewRef.current;
    if (!webview) return;
    // const webContents = webview.getWebContents();
     try {
       webview
      .executeJavaScript(`
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
                while (currentText.length >= 3700) { // Process in chunks if over 700 characters
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

        // Use a regular expression to find sentence boundaries
        let sentenceBoundaryRegex = /[.!?](?=\s|$)/g;
        let match;
        while ((match = sentenceBoundaryRegex.exec(text)) !== null) {
            if (match.index >= start && match.index <= end) {
                return match.index + 1;
            }
        }

        return base; // Fallback to base if no sentence boundary is found
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
        } else if (node.nodeType === Node.COMMENT_NODE) {
            // Ignore comments
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
    flushText(); // Flush any remaining text
    return texts;
}

return getTextContentWithTags(document.body);


})();
        `)
      .then(async (htmlContentWithTagsArray) => {
        // debug
        const debugs = [];
        htmlContentWithTagsArray.forEach((m) => {
          debugs.push(m.data);
        });
        console.log(debugs.join(' '));
        try {
         const mapped = [];
          for(let i = 0; i < htmlContentWithTagsArray.length; i++) {
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
         // mapped[0] = "<body onload=\"set_style_from_cookie()\"><a name=\"top\"></a><hr size=\"1\"></hr><table width=\"100%\"><tbody><tr><td style=\"vertical-align: middle; width: 200px;\"></td><td style=\"vertical-align: middle; width: calc(100% - 400px); text-align:center;\" class=\"fakeh1\">Xianglong Ni's Webpage</td><td style=\"vertical-align: middle; width: 200px; text-align: right;\"><button type=\"button\" onclick=\"switch_style('dark');return false;\" name=\"theme\" value=\"Dark Theme\" id=\"dark\">Dark Theme</button><button type=\"button\" onclick=\"switch_style('light');return false;\" name=\"theme\" value=\"Light Theme\" id=\"light\">Light Theme</button></td></tr></tbody></table><hr size=\"1\"></hr><h1>About</h1>I'm Xianglong Ni, a sixth-year PhD student in Mathematics at UC Berkeley advised by David Eisenbud.<h2>Contact Information</h2>Office: 1093 Evans<br></br>Email: xlni (at) berkeley.edu<h1>Research</h1>My research interests are at the intersection of representation theory and commutative algebra. In particular, I am interested in using tools from the former to investigate the structure theory of perfect ideals, especially from the perspective of linkage. Here is my <a href=\"Research Statement.pdf\">research statement</a>, and below are papers or notes I've written on the subject.<table cellpadding=\"5\"><thead><tr><th>Title</th><th>Link</th><th>Comments</th></tr></thead><tbody><tr><td>Licci ideals as an obstruction to Noetherian base rings for generic free resolutions</td><td><a href=\"Preprints/non-Noeth.pdf\">PDF</a></td><td>A brief note explaining how the non-Noetherianity of Weyman's generic ring for a given format implies it for any generic ring of that same format.</td></tr><tr><td>Weyman's generic ring for free resolutions of length three</td><td><a href=\"Preprints/Ni-JMM.pdf\">slides</a></td><td>Slides for a talk I gave in the <a href=\"https://www.jointmathematicsmeetings.org/meetings/national/jmm2024/2300_program_ss51.html#title\">special session on group actions in commutative algebra</a> at JMM 2024.</td></tr><tr><td>ADE correspondence for grade three perfect ideals (2023)</td><td><a href=\"Preprints/ADE.pdf\">draft PDF</a></td><td>Joint with Lorenzo Guerrieri and Jerzy Weyman. We show how the ADE correspondence may be used to classify perfect ideals of grade three with small Betti numbers.</td></tr><tr><td>Parametrizing higher structure maps for resolutions of length three (2023)</td><td><a href=\"Preprints/parametrization.pdf\">PDF</a></td><td>An analysis of the relations which hold in Weyman's generic ring.</td></tr><tr><td>Free resolutions constructed from bigradings on Lie algebras (2023)</td><td><a href=\"https://arxiv.org/abs/2304.01381\">arXiv</a></td><td>Joint with Jerzy Weyman. Resolves the coordinate rings for certain Schubert varieties restricted to an open cell.</td></tr><tr><td>Higher structure maps for free resolutions of length 3 and linkage (2022)</td><td><a href=\"https://arxiv.org/abs/2208.05934\">arXiv</a></td><td>Joint with Lorenzo Guerrieri and Jerzy Weyman. An explicit study of how (the first few) higher structure maps coming from Weyman's generic ring behave under linkage.</td></tr></tbody></table>I've also written some <a href=\"https://github.com/xlni?tab=repositories\">Macaulay2 code</a> to help experiment with this project.<h1>Teaching</h1>In my time at Berkeley, I have taught a total of 9 times during the fall/spring, and 3 times over the summer. Here is my <a href=\"Teaching Statement.pdf\">teaching statement</a>.<h2>Current (Spring 2024)</h2>I am not teaching this semester.<h2>Past</h2>Math 53 (Fall 2023 as GSI). No link because we used bCourses.<br></br>Math 110 (Summer 2023 as course instructor). No link because we used bCourses.<br></br><a href=\"Teaching/SP23 Math 110.html\">Math 110 (Spring 2023 as GSI)</a><br></br><a href=\"Teaching/FA22 Math 53.html\">Math 53 (Fall 2022 as GSI)</a><br></br><a href=\"Teaching/FA21 Math 53.html\">Math 53 (Fall 2021 as GSI)</a><br></br><a href=\"Teaching/FA20 Math 53.html\">Math 53 (Fall 2020 as GSI)</a><br></br>Math 110 (Summer 2020 as course instructor). No link because we used bCourses.<br></br><a href=\"Teaching/SP20 Math 53.html\">Math 53 (Spring 2020 as GSI)</a><br></br>Math 53 (Fall 2019 as GSI). No link because we used bCourses.<br></br><a href=\"Teaching/SM19 Math 110.html\">Math 110 (Summer 2019 as course instructor)</a><br></br><a href=\"Teaching/SP19 Math 53.html\">Math 53 (Spring 2019 as GSI)</a><br></br><a href=\"Teaching/FA18 Math 1A.html\">Math 1A (Fall 2018 as GSI)</a><h1>Qualifying Exam</h1>I passed my qualifying exam on April 21, 2020. <a href=\"Ni_QE.pdf\">Here</a> is my syllabus and transcript.</body>";
          // This regex looks for double quotes that are not preceded by a backslash
          let r = mapped.join(' ') ;
          if (r.charAt(0) === '"')  r = r.substring(1);
          if (r.charAt(r.length-1) === '"') r = r.substring(0, r.length-1)
         // r = r.replace(/(?<!\\)"/g, '\\"');
          const s = 'document.body.innerHTML = `' + r + '`';
          console.log(s);
          webview.executeJavaScript(s).catch((error) => {
            console.error(' error:', error);
          });;
        } catch (error) {
          console.error('Translation error:', error);
        }
      }).catch((error) => {
         console.error(' error:', error);
      });
    } catch (e) {
      console.error(' error:', e);
    }

  };

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

  // const dispatch = useDispatch();

  const handleAnnotationWindowClose = (selectionType, type, color, emoji) => {};

  const createBookmarkHandler = () => {
    customStorage.createBookmark(currentUrl);
  };

  const onCaptureComplete = async (data) => {
    if (!data) return;
    setUseCapture(false);
    setImageData(data);
    const bookmark = await customStorage.createBookmark(currentUrl);
    if (!bookmark) return;
    setSourceKey(bookmark.id);
    setOpenCardDialog(true);
  };
  // const openai = useMemo(() => {
  //   return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  // }, [apiKey]);

  // useEffect(() => {
  //   async function t() {
  //     const id = await customStorage.getOpenAIKey();
  //     setApiKey(id);
  //     const m = await customStorage.getChatGPTModel();
  //     setModel(m);
  //   }
  //   t();
  // }, []);

  useEffect(() => {
    // Function to handle the update-data event
    const handleUpdate = ({ command, content }) => {
      // console.log('Received data:', update.data);
      setUseCapture(true);
    };

    // Add event listener for update-data
    window.electron.ipcRenderer.on('browser-use-area-selection', handleUpdate);

    // Cleanup function to remove the event listener
    return () => {
      window.electron.ipcRenderer.removeListener(
        'browser-use-area-selection',
        handleUpdate,
      );
    };
  }, []); // Empty dependency array means this effect runs only once after the initial render

  useEffect(() => {
    async function t() {
      const currentDirectory = await window.electron.ipcRenderer.dirname();
      const appMode = await window.electron.ipcRenderer.appMode();
      const v = appMode === 'production' ?
        `file://${currentDirectory}/src/renderer/views/browser/preload.js`
        :  `file://${currentDirectory}/renderer/views/browser/preload.js`;
      console.log(` preload of webview at ${v}`);
      setPreload(v);
      const r = await customStorage.getRecentURL();
      setCachedUrls(r || []);
    }
    t();
  }, []);

  window.electron.ipcRenderer.on(
    'context-menu-command',
    ({ command, selectedText }) => {
      console.log(`command:${command} ${selectedText}`);
      if (command === 'createCard') {
        setCardContent(selectedText);
        setOpenCardDialog(true);
      }
      if (command === 'addToWordList') {
        customStorage.addToKeyWordList(StudyMode.Language, selectedText);
        // customStorage.addToVocabulary(selectedText);
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
    },
  );

  window.electron.ipcRenderer.on('open-url', (url) => {
    document.querySelector('webview').src = url; // your webview element
  });

  async function checkInternet() {
    try {
      const response = await fetch('https://www.example.com/'); // Use a reliable endpoint
      return response.ok || response.status === 200; // true if the status code is 200-299
    } catch (error) {
      return false; // false if the network is unreachable
    }
  }

  async function loadPage(url) {
    try {
      if (book) {
        // book note, not bookmkark.
        webviewRef.current.src = url;
        return;
      }
      const onLine = await checkInternet();
      if (onLine) webviewRef.current.src = url;
      else {
        const bookmarks = await customStorage.getBookmarksBySourceKey(
          url,
          'url',
        );
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

  // this is the entry point
  useEffect(() => {
    if (!urlPath) return;
    setSelections(null);
    setOpenDialog(false);
    // setOpenNoteDialog(false);
    setNoteColor(null);
    setCurrentUrl(urlPath);
    setBook(curBook);
    loadPage(urlPath);
  }, [urlPath, curBook]);

  useEffect(() => {
    setSelections(null);
    setOpenDialog(false);
    // setOpenNoteDialog(false);
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
      const v = await customStorage.queryNoteBySourceKeyAndSourceType(
        currentUrl,
        'url',
      );
      if (v) setNotes(v);

    }
    t();
  }, [currentUrl]);

  async function onUrlChange(event, value) {
    if (!value) return;
    if (!value.startsWith('http')) value = `http://${value}`;
    search(value);
  }
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

  // const myWebView = useMemo(() => {
  //   return (
  //     <webview
  //       id="webview"
  //       allow="display-capture"
  //       disablewebsecurity="true"
  //       allowpopups="true"
  //       nodeintegration="true"
  //       nodeintegrationinsubframes="true"
  //       preload={preload}
  //       ref={webviewRef}
  //       style={{
  //         display: 'flex',
  //         width: '100%',
  //         height: 'calc(100vh - 80px)',
  //       }}
  //     />
  //   );
  // }, []);

  useEffect(() => {
    const webview = webviewRef.current;
    if (webview) {
      webview.addEventListener('dom-ready', () => {
        if (!book || book.cover) return;
        async function t() {
          const imageId = await window.electron.ipcRenderer.capturePage();
          if (imageId) {
            const aBook = { ...book, cover: imageId };
            updateBook({
              id: book.id,
              field: 'cover',
              value: imageId,
            });
            setBook(aBook);
          }
        }
        t();
      });
      webview.addEventListener('dom-ready', () => {
        console.log(`Webview loaded  ${webview.getURL()}`);
        setFilterKey(webview.getURL());
         extractTextContentFromWeb();
      });
      // webview.addEventListener(
      //   'click',
      //   (event) => {
      //     console.log('click fired ');
      //       const target = event.target.closest('a[target="_blank"]');
      //     if (target) {
      //       event.preventDefault();
      //     }
      //   },
      //   true,
      // );
      webview.addEventListener('will-navigate', (event) => {
        console.log('Navigated to: ', event.url);
        handleAddHistory(event.url, false);
        // window.electron.sendToMain('navigation', event.url);
      });
      webview.addEventListener('new-window', (e) => {
        const { url } = e;
        e.preventDefault();
        console.log(`Open this URL in a new tab: ${url}`);
        const newTabWebView = `<webview src="${url}" style="display:inline-flex; width:100%; height:100%"></webview>`;
        webview.webContents.executeJavaScript(
          `document.body.innerHTML += \`${newTabWebView}\`;`,
        );
      });
      console.log(`browser urlPath = ${urlPath}`);
    }
  }, [currentUrl]);

  const rightPanel = (
    <Box sx={{ width: '320px' }}>
      <TabContext value={tabValue}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <TabList onChange={handleTabChange}>
            <Tab label="Notes" value="1" sx={{ fontSize: '11px' }} />
            <Tab label="History" value="2" sx={{ fontSize: '11px' }} />
            <Tab label="AI Bot" value="3" sx={{ fontSize: '11px' }} />
          </TabList>
        </Box>
        <MyTabPanel value="1">
          <TextSearchRow
            placeHolder="Search"
            label="content"
            sx={{ width: '300px', borderStyle: 'none' }}
            searchAction={(text) => searchInWeb(text)}
          />
          <ScrollPane>
            {notes.map((note) => (
              <NoteUI
                key={note.id}
                selectedNoteKey={note.id}
                selectHandler={() => {}}
                showQuizHandler={() => {}}
                customAction={() => {}}
                customActionName=""
                cardWidth="290"
                cardHeight="280"
                compactView
                useMiniHeight
              />
            ))}
          </ScrollPane>
        </MyTabPanel>
        <MyTabPanel value="2">
          <TextSearchRow
            placeHolder="Search"
            label="content"
            sx={{ width: '300px', borderStyle: 'none' }}
            searchAction={(text) => setHistoryFilterKey(text)}
          />
          <HistoriesUI
            filterKey={historyFilterKey}
            historyCallback={(url) => setCurrentUrl(url)}
          />
        </MyTabPanel>
        <MyTabPanel value="3">
          <InContextChatPanel articleStr={articleStr} />
        </MyTabPanel>
      </TabContext>
    </Box>
  );

  const mainPanel = (
    <>
      <Box sx={{ flexGrow: 1 }} visibility={!urlPath}>
        <Grid
          container
          spacing={2}
          sx={{ width: '100%', alignItems: 'center' }}
        >
          <Grid item>
            <IconButton
              size="small"
              onClick={() => {
                handleBack();
              }}
              disabled={!historyTree.canBack()}
              aria-label="search"
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>

            <LongPressButton
              handleNormalPress={handleSimpleForward}
              handleLongPress={handleMenuOpen}
              disabled={!historyTree.canForward()}
              IconComponent={ArrowForwardIcon}
            />
            {historyTree.canForward() && (
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                {historyTree.getForwardChoices().map((url, index) => (
                  <MenuItem
                    key={index}
                    onClick={() => {
                      handleMenuClose();
                      handleForward(index);
                    }}
                  >
                    <ListItemIcon>
                      <LinkIcon />
                    </ListItemIcon>
                    <ListItemText> {url} </ListItemText>
                  </MenuItem>
                ))}
              </Menu>
            )}
          </Grid>
          <Grid item xs style={{ flexGrow: 1 }}>
            <Autocomplete
              disablePortal
              id="combo-box-url"
              freeSolo
              options={cachedUrls}
              onChange={(event, value) => onUrlChange(event, value)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  variant="outlined"
                  size="small"
                  label="Url"
                  placeholder="http://"
                  value={filterKey}
                  sx={{ height: '35px', marginBottom: '5px' }}
                  onChange={(e) => setFilterKey(e.target.value)}
                  margin="dense"
                  fullWidth
                />
              )}
            />
          </Grid>
          <Grid item>
            <IconButton
              size="small"
              onClick={() => {
                search();
              }}
              aria-label="search"
            >
              <SearchIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => {
                if (navigator.onLine) createBookmarkHandler();
              }}
              aria-label="bookmark"
            >
              <BookmarkAddIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => {
                setUseCapture(!useCapture);
              }}
              aria-label="capture"
            >
              <CameraIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={handleMenuMoreOpen}
              aria-label="more"
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
            <Menu
              anchorEl={anchorMoreEl}
              open={Boolean(anchorMoreEl)}
              onClose={handleMenuMoreClose}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <MenuItem onClick={() => translateToPrimarySchool(1500)}>
                <ListItemIcon>
                  <TranslateIcon />
                </ListItemIcon>
                <ListItemText>For 4th grader</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => translateToPrimarySchool(2500)}>
                <ListItemIcon>
                  <TranslateIcon />
                </ListItemIcon>
                <ListItemText>For 5th grader</ListItemText>
              </MenuItem>
             <MenuItem onClick={() => translateToPrimarySchool(3500)}>
                <ListItemIcon>
                  <TranslateIcon />
                </ListItemIcon>
                <ListItemText>For 6th grader</ListItemText>
              </MenuItem> <MenuItem onClick={() => translateToPrimarySchool(4500)}>
                <ListItemIcon>
                  <TranslateIcon />
                </ListItemIcon>
                <ListItemText>For 7th grader</ListItemText>
              </MenuItem>
             <MenuItem onClick={() => translateToPrimarySchool(5500)}>
                <ListItemIcon>
                  <TranslateIcon />
                </ListItemIcon>
                <ListItemText>For 8th grader</ListItemText>
              </MenuItem>
            <MenuItem onClick={() => translateToPrimarySchool(6500)}>
                <ListItemIcon>
                  <TranslateIcon />
                </ListItemIcon>
                <ListItemText>For 9th grader</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => translateToPrimarySchool(7500)}>
                <ListItemIcon>
                  <TranslateIcon />
                </ListItemIcon>
                <ListItemText>For 10th grader</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => translateToPrimarySchool(8500)}>
                <ListItemIcon>
                  <TranslateIcon />
                </ListItemIcon>
                <ListItemText>For 11th grader</ListItemText>
              </MenuItem>
              <MenuItem onClick={() => translateToPrimarySchool(9500)}>
                <ListItemIcon>
                  <TranslateIcon />
                </ListItemIcon>
                <ListItemText>For 12th grader</ListItemText>
              </MenuItem>
            </Menu>

          </Grid>
        </Grid>
      </Box>
      <Grid container spacing={2} sx={{ height: 'calc(100vh-38px)' }}>
        <Grid item xs>
          <AreaCapture
            useCapture={useCapture}
            onCaptureComplete={onCaptureComplete}
          >
            <div style={{ width: '100%', height: '100%' }}>
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
                height: 'calc(100vh - 80px)',
              }}
            />
            </div>
          </AreaCapture>
        </Grid>
      </Grid>
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
    </>
  );

  return (
    <RightCollapsibleLayout
      rightPanel={rightPanel}
      mainPanel={mainPanel}
      rightPanelWidth="320"
    />
  );
}

export default Browser;

// {showImpressjs && cardContent.length > 50 && (
//   <Impressjs
//     paragraph={cardContent}
//     closeHandler={() => setShowImpressjs(false)}
//   />
// )}
