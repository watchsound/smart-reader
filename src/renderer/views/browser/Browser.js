/* eslint-disable promise/catch-or-return */
/* eslint-disable prettier/prettier */
/* eslint-disable no-undef */
/* eslint-disable no-use-before-define */
/* eslint-disable promise/always-return */
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Popover, Paper, Typography, IconButton, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

import CreateAnnotationDialog from '../reading/CreateAnnotationDialog';
import { updateBook } from '../../api/booksApi';
import CreateNoteModal from '../../components/chat/CreateNoteModal';
import { NoteType, CardType } from '../../../commons/model/Note';
import parseMindmapToReactFlow from '../../../commons/utils/content/mindmapUtil';
import customStorage from '../../store/customStorage';
import AreaCapture from '../../components/AreaCapture';
import { StudyMode } from '../../../commons/model/DataTypes';
import CreateVocabularyDialog from './CreateVocabularyDialog';
// import openImpressWindow from '../../components/impressjs';
import HistoryTree from './HistoryTree';
import { createRewriteHtmlCodeForWordFrequencyJsonPrompt, createSmartSummaryPrompt, createMindmapExtractionPrompt, createEntityResolutionPrompt } from '../../../commons/utils/AIPrompts';
import speakText from '../../utils/tts';
import { instanceInRender as aiProviderManager } from '../../../commons/service/AIProviderManager';

import generateImpressHTML from '../../components/impressjs';
import ImpressModal from '../../components/impressjs/ImpressModal';

import BrowserToolbar from './BrowserToolbar';
import BrowserSidebar from './BrowserSidebar';
import BrowserContextMenu from './BrowserContextMenu';
import { useStudyEnhancer } from './study-enhancer';
import { useSkills } from '../../hooks/useSkills';
import FiveWAnalysisPanel from '../../components/knowledge/FiveWAnalysisPanel';
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
  const [sidebarActiveTab, setSidebarActiveTab] = useState('notes');
  const [historyFilterKey, setHistoryFilterKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [openVocabularyDialog, setOpenVocabularyDialog] = useState(false);
  const [openCardDialog, setOpenCardDialog] = useState(false);
  const [useCapture, setUseCapture] = useState(false);

  const [showImpressModal, setShowImpressModal] = useState(false);
  const [impressContent, setImpressContent] = useState(null);

  // Skill result popover state
  const [skillResultAnchor, setSkillResultAnchor] = useState(null);
  const [skillResultContent, setSkillResultContent] = useState(null);
  const [skillResultTitle, setSkillResultTitle] = useState('');
  const [skillResultLoading, setSkillResultLoading] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    position: { x: 0, y: 0 },
    menuType: 'regular',
    selectedText: '',
    imageUrl: '',
    sourceElementId: null,
  });

  // Content state
  const [selections, setSelections] = useState(null);
  const [noteColor, setNoteColor] = useState(null);
  const [popupLoc, setPopupLoc] = useState({ top: 100, left: 100 });
  const [cardContent, setCardContent] = useState('');
  const [imageData, setImageData] = useState('');
  const [sourceKey, setSourceKey] = useState(-1);

  // Refs
  const webviewRef = useRef();
  const chatPanelRef = useRef(null); // Reference to InContextChatPanel methods
  const historyTree = useMemo(() => new HistoryTree(), []);

  // StudyEnhancer hook for text animations
  const {
    inject: injectStudyEnhancer,
    smartSummary,
    constellationMindmap,
    entityResolution,
    removeAllEffects,
    isReady: isStudyEnhancerReady,
    injectParagraphIcons,
    removeParagraphIcons,
    toggleParagraphIcons,
    paragraphIconsActive,
    on: onStudyEnhancerEvent
  } = useStudyEnhancer(webviewRef);

  // Skills hook for AI skill execution and tracking
  const { executeSkill, isLoading: isSkillLoading } = useSkills({ loadOnMount: false });

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

      // Process all text chunks in parallel using Promise.all to avoid sequential await in loop
      const mapped = await Promise.all(
        htmlContentWithTagsArray.map(async (htmlContentWithTags) => {
          if (htmlContentWithTags.type === 'text') {
            const prompt = `${createRewriteHtmlCodeForWordFrequencyJsonPrompt(wordLevel)}\n\n\n${htmlContentWithTags.data}`;
            const htmlJson = await aiProviderManager.generateContentWithJson(prompt, true);
            if (htmlJson && htmlJson['modified-html']) {
              return JSON.stringify(htmlJson['modified-html']);
            }
            return htmlContentWithTags.data;
          }
          return htmlContentWithTags.data;
        })
      );
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

  // Load page - optimized to not block on internet check
  async function loadPage(url) {
    try {
      setIsLoading(true);

      // For book content, load directly
      if (book) {
        webviewRef.current.src = url;
        return;
      }

      // Use navigator.onLine for quick check (non-blocking)
      // This is much faster than fetching example.com
      if (navigator.onLine) {
        webviewRef.current.src = url;
      } else {
        // Only check for offline cache when navigator says we're offline
        const bookmarks = await customStorage.getBookmarksBySourceKey(url, 'url');
        if (bookmarks && bookmarks.length > 0) {
          const offlinePath = await customStorage.getPDF4URL(bookmarks[0].id);
          if (offlinePath) {
            webviewRef.current.src = `file://${offlinePath}`;
            return;
          }
        }
        // If no offline version, still try to load (might work on local network)
        webviewRef.current.src = url;
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
    return window.electron.ipcRenderer.on('browser-use-area-selection', handleUpdate);
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

  // Smart Summary handler - generates vocabulary-aware summary with animation
  // Note: We do NOT use setIsLoading here because the loading overlay blocks the webview
  // and prevents the user from seeing the animation. The AI generation happens in background.
  const handleSmartSummary = async (selectedText, sourceElementId = null) => {
    if (!selectedText || selectedText.length < 20) {
      console.warn('Text too short for summary');
      return;
    }

    try {
      // 1. Get user's learning vocabulary
      const vocabularyWords = await customStorage.getKeyWordList(StudyMode.Language) || [];

      // Track skill usage (fire-and-forget, non-blocking)
      executeSkill('smart_summary', {
        text: selectedText,
        vocabularyWords,
        maxWords: 30,
      }).catch(e => console.log('Skill tracking failed:', e));

      // 2. Generate summary using AI with vocabulary constraint
      const prompt = createSmartSummaryPrompt(selectedText, vocabularyWords);
      const result = await aiProviderManager.generateContentWithJson(prompt, true);

      if (!result || !result.summary) {
        console.warn('Failed to generate summary');
        return;
      }

      // 3. Inject StudyEnhancer if not ready
      if (!isStudyEnhancerReady) {
        await injectStudyEnhancer();
      }

      // 4. Find the element containing the selected text and apply effect
      const webview = webviewRef.current;
      if (webview) {
        // Use provided sourceElementId (from paragraph icon) or find from selection
        let targetSelector = '#se-smart-summary-source';

        if (sourceElementId) {
          // Use the paragraph element directly
          targetSelector = `[data-se-paragraph-id="${sourceElementId}"]`;
        } else {
          // Create a temporary container for the selected text
          await webview.executeJavaScript(`
            (function() {
              const selection = window.getSelection();
              if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const container = range.commonAncestorContainer;
                const element = container.nodeType === 3 ? container.parentElement : container;
                if (element) {
                  element.id = 'se-smart-summary-source';
                }
              }
            })();
          `);
        }

        // 5. Apply smart summary effect
        await smartSummary(
          targetSelector,
          result.summary,
          result.vocabularyUsed || vocabularyWords,
          {
            flyDuration: 1200,
            staggerDelay: 100,
            glowDuration: 600
          }
        );
      }
    } catch (error) {
      console.error('Smart Summary error:', error);
    }
  };

  // Mind Map handler - extracts entities and relationships and displays as animated mindmap
  // Note: Like Smart Summary, we do NOT use setIsLoading here to allow animation visibility
  const handleMindmap = async (selectedText, sourceElementId = null) => {
    if (!selectedText || selectedText.length < 30) {
      console.warn('Text too short for mindmap');
      return;
    }

    try {
      // 1. Generate mindmap data using AI
      const prompt = createMindmapExtractionPrompt(selectedText);
      const result = await aiProviderManager.generateContentWithJson(prompt, true);

      if (!result || !result.root || !result.nodes) {
        console.warn('Failed to generate mindmap data');
        return;
      }

      // 2. Inject StudyEnhancer if not ready
      if (!isStudyEnhancerReady) {
        await injectStudyEnhancer();
      }

      // 3. Find the element containing the selected text
      const webview = webviewRef.current;
      if (webview) {
        // Use provided sourceElementId (from paragraph icon) or find from selection
        let targetSelector = '#se-mindmap-source';

        if (sourceElementId) {
          // Use the paragraph element directly
          targetSelector = `[data-se-paragraph-id="${sourceElementId}"]`;
        } else {
          // Create a temporary container for the selected text
          await webview.executeJavaScript(`
            (function() {
              const selection = window.getSelection();
              if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const container = range.commonAncestorContainer;
                const element = container.nodeType === 3 ? container.parentElement : container;
                if (element) {
                  element.id = 'se-mindmap-source';
                }
              }
            })();
          `);
        }

        // 4. Apply constellation mindmap effect
        await constellationMindmap(
          targetSelector,
          result,
          {
            // Animation timing options
          }
        );
      }
    } catch (error) {
      console.error('Mind Map error:', error);
    }
  };

  // Entity Resolution handler - identifies entity references and links them visually
  // Note: Like other effects, we do NOT use setIsLoading here to allow animation visibility
  const handleEntityResolution = async (selectedText, sourceElementId = null) => {
    if (!selectedText || selectedText.length < 50) {
      console.warn('Text too short for entity resolution');
      return;
    }

    try {
      // 1. Generate entity resolution data using AI
      const prompt = createEntityResolutionPrompt(selectedText);
      const result = await aiProviderManager.generateContentWithJson(prompt, true);

      if (!result || !result.entities || result.entities.length === 0) {
        console.warn('No entities found for resolution');
        return;
      }

      // 2. Inject StudyEnhancer if not ready
      if (!isStudyEnhancerReady) {
        await injectStudyEnhancer();
      }

      // 3. Find the element containing the selected text
      const webview = webviewRef.current;
      if (webview) {
        // Use provided sourceElementId (from paragraph icon) or find from selection
        let targetSelector = '#se-entity-source';

        if (sourceElementId) {
          // Use the paragraph element directly
          targetSelector = `[data-se-paragraph-id="${sourceElementId}"]`;
        } else {
          // Create a temporary container for the selected text
          await webview.executeJavaScript(`
            (function() {
              const selection = window.getSelection();
              if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const container = range.commonAncestorContainer;
                const element = container.nodeType === 3 ? container.parentElement : container;
                if (element) {
                  element.id = 'se-entity-source';
                }
              }
            })();
          `);
        }

        // 4. Apply entity resolution effect
        await entityResolution(
          targetSelector,
          result,
          {
            // Animation timing options
          }
        );
      }
    } catch (error) {
      console.error('Entity Resolution error:', error);
    }
  };

  // Context menu command handler
  const handleContextMenuCommand = (command, selectedText, imageUrl, sourceElementId) => {
    if (command === 'copy') {
      navigator.clipboard.writeText(selectedText);
    }
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
      generateImpressHTML({ paragraph: selectedText }).then((html) => {
        if (html) {
          setImpressContent(html);
          setShowImpressModal(true);
        }
      });
    }
    if (command === 'smartSummary') {
      handleSmartSummary(selectedText, sourceElementId);
    }
    if (command === 'mindmap') {
      handleMindmap(selectedText, sourceElementId);
    }
    if (command === 'entityLinks') {
      handleEntityResolution(selectedText, sourceElementId);
    }
    if (command === 'tts-for-selection') {
      speakText(selectedText);
    }
    if (command === 'screenshot') {
      setUseCapture(true);
    }
    if (command === 'bookmark') {
      // Trigger bookmark action
      handleBookmark();
    }
    // New skill-based commands
    if (command === 'quizGenerate') {
      handleQuizGenerate(selectedText);
    }
    if (command === 'simplifyText') {
      handleSimplifyText(selectedText);
    }
    if (command === 'analyzeStructure') {
      handleAnalyzeStructure(selectedText);
    }
  };

  // Quiz Generation handler - uses skill system
  // Results are displayed in the AI Bot chat panel for persistent history
  const handleQuizGenerate = async (selectedText) => {
    if (!selectedText || selectedText.length < 50) {
      console.warn('Text too short for quiz generation');
      return;
    }

    // Open sidebar and switch to AI tab
    setSidebarOpen(true);
    setSidebarActiveTab('ai');

    try {
      const result = await executeSkill('quiz_generate', {
        text: selectedText,
        questionCount: 4,
        difficulty: 'mixed',
      });
      console.log('Quiz Generation result:', result);

      if (result && result.success && result.result) {
        const quizData = result.result.quiz || [];
        const difficulty = result.result.difficulty || 'mixed';

        // Wait a bit for the chat panel to mount after tab switch
        const addResultToChat = () => {
          if (chatPanelRef.current && chatPanelRef.current.addSkillResult) {
            chatPanelRef.current.addSkillResult({
              skillName: 'quiz_generate',
              title: 'Quiz',
              data: {
                quiz: quizData,
                difficulty,
                questionCount: quizData.length,
              },
              sourceText: selectedText,
            });
            return true;
          }
          return false;
        };

        // Try immediately, then retry with delays
        if (!addResultToChat()) {
          setTimeout(() => {
            if (!addResultToChat()) {
              console.warn('Could not add quiz to chat panel');
            }
          }, 300);
        }
      } else if (result && result.error) {
        console.error('Quiz Generation error:', result.error);
      }
    } catch (error) {
      console.error('Quiz Generation error:', error);
    }
  };

  // Text Simplification handler - uses skill system
  // Results are displayed in the AI Bot chat panel for persistent history
  const handleSimplifyText = async (selectedText) => {
    if (!selectedText || selectedText.length < 20) {
      console.warn('Text too short for simplification');
      return;
    }

    // Open sidebar and switch to AI tab
    setSidebarOpen(true);
    setSidebarActiveTab('ai');

    try {
      // Get user's preferred reading level (Elementary, Middle, College)
      // Map to skill levels: elementary, middle, high, college
      const userLevel = await customStorage.getReaderLevel();
      const levelMap = {
        Elementary: 'elementary',
        Middle: 'middle',
        College: 'college',
      };
      const targetLevel = levelMap[userLevel] || 'middle';

      const result = await executeSkill('text_simplify', {
        text: selectedText,
        targetLevel,
      });
      console.log('Text Simplification result:', result);

      if (result && result.success && result.result) {
        const { simplifiedText, simplificationRatio } = result.result;

        // Wait a bit for the chat panel to mount after tab switch
        const addResultToChat = () => {
          if (chatPanelRef.current && chatPanelRef.current.addSkillResult) {
            chatPanelRef.current.addSkillResult({
              skillName: 'text_simplify',
              title: 'Simplified Text',
              data: {
                originalText: selectedText,
                simplifiedText,
                targetLevel,
                simplificationRatio,
              },
              sourceText: selectedText,
            });
            return true;
          }
          return false;
        };

        // Try immediately, then retry with delays
        if (!addResultToChat()) {
          setTimeout(() => {
            if (!addResultToChat()) {
              console.warn('Could not add simplified text to chat panel');
            }
          }, 300);
        }
      } else if (result && result.error) {
        console.error('Text Simplification error:', result.error);
      }
    } catch (error) {
      console.error('Text Simplification error:', error);
    }
  };

  // Structure Analysis (5W) handler - uses skill system
  // Results are displayed in the AI Bot chat panel for persistent history
  const handleAnalyzeStructure = async (selectedText) => {
    if (!selectedText || selectedText.length < 30) {
      console.warn('Text too short for structure analysis');
      return;
    }

    // Open sidebar and switch to AI tab
    setSidebarOpen(true);
    setSidebarActiveTab('ai');

    try {
      const result = await executeSkill('analyze_structure', {
        text: selectedText,
      });
      console.log('5W Analysis result:', result);

      if (result && result.success && result.result) {
        // Extract the data array from the skill result
        const analysisData = result.result.data || [];

        // Wait a bit for the chat panel to mount after tab switch
        const addResultToChat = () => {
          if (chatPanelRef.current && chatPanelRef.current.addSkillResult) {
            chatPanelRef.current.addSkillResult({
              skillName: 'analyze_structure',
              title: '5W Analysis',
              data: analysisData,
              sourceText: selectedText,
            });
            return true;
          }
          return false;
        };

        // Try immediately, then retry with delays
        if (!addResultToChat()) {
          // Wait for panel to mount
          setTimeout(() => {
            if (!addResultToChat()) {
              // Last resort: show in popup
              setSkillResultTitle('5W Analysis');
              setSkillResultContent({
                type: 'fiveW',
                data: analysisData,
                sentenceCount: analysisData.length,
              });
              setSkillResultAnchor(webviewRef.current);
            }
          }, 300);
        }
      } else if (result && result.error) {
        console.error('5W Analysis error:', result.error);
      }
    } catch (error) {
      console.error('Structure Analysis error:', error);
    }
  };

  // Close context menu
  const closeContextMenu = () => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  // Listen for context menu events and study-enhancer events from webview
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleWebviewMessage = async (event) => {
      const { channel, args } = event;
      console.log('Browser: Received IPC message, channel:', channel);
      if (channel === 'show-context-menu') {
        const { menuType, selectedText, imageUrl, x, y, paragraphId } = args[0];
        // Adjust position relative to webview container
        const webviewRect = webview.getBoundingClientRect();
        setContextMenu({
          visible: true,
          position: { x: webviewRect.left + x, y: webviewRect.top + y },
          menuType,
          selectedText: selectedText || '',
          imageUrl: imageUrl || '',
          sourceElementId: paragraphId || null,
        });
      }
      // Handle study-enhancer events (like createNote from Smart Summary)
      if (channel === 'study-enhancer-event') {
        const data = args[0];
        if (data.type === 'createNote' && data.content) {
          try {
            // Create a bookmark first to get a sourceKey
            const bookmark = await customStorage.createBookmark(currentUrl);
            const sKey = bookmark ? bookmark.id : -1;
            // Create the note directly without opening dialog
            await customStorage.createNote({
              sourceType: NoteType.Url,
              sourceKey: sKey,
              content: data.content,
              imageData: '',
              cfi: '',
              url: currentUrl,
              emoji: '📝',
              color: '#9c27b0', // Purple for AI-generated summaries
              highlightType: 'summary'
            });
            // Refresh notes list
            const updatedNotes = await customStorage.queryNoteBySourceKeyAndSourceType(currentUrl, 'url');
            if (updatedNotes) setNotes(updatedNotes);
          } catch (error) {
            console.error('Failed to create note from summary:', error);
          }
        }
        // Handle paragraph action icon clicks
        if (data.type === 'paragraphAction') {
          console.log('Browser: Handling paragraphAction event', data);
          const webviewRect = webview.getBoundingClientRect();
          setContextMenu({
            visible: true,
            position: {
              x: webviewRect.left + data.position.x,
              y: webviewRect.top + data.position.y
            },
            menuType: 'paragraph',
            selectedText: data.text || '',
            imageUrl: '',
            sourceElementId: data.paragraphId,
          });
        }
        // Handle mindmap note creation
        if (data.type === 'createMindmapNote' && data.mindmapMarkdown) {
          try {
            // Create a bookmark first to get a sourceKey
            const bookmark = await customStorage.createBookmark(currentUrl);
            const sKey = bookmark ? bookmark.id : -1;
            // Parse markdown to ReactFlow format
            const mindmapObj = parseMindmapToReactFlow(data.mindmapMarkdown);
            // Create note with mindmap card
            await customStorage.createNote({
              sourceType: NoteType.Url,
              sourceKey: sKey,
              content: data.title || 'Mind Map',
              cards: [
                {
                  id: 0,
                  text: data.mindmapMarkdown,
                  html: '',
                  image: '',
                  overlap: 0,
                  data: mindmapObj,
                  type: CardType.MindMap
                }
              ],
              imageData: '',
              cfi: '',
              url: currentUrl,
              emoji: '🗺️',
              color: '#00bcd4', // Cyan for mindmaps
              highlightType: 'mindmap'
            });
            // Refresh notes list
            const updatedNotes = await customStorage.queryNoteBySourceKeyAndSourceType(currentUrl, 'url');
            if (updatedNotes) setNotes(updatedNotes);
          } catch (error) {
            console.error('Failed to create mindmap note:', error);
          }
        }
      }
    };

    webview.addEventListener('ipc-message', handleWebviewMessage);
    return () => {
      webview.removeEventListener('ipc-message', handleWebviewMessage);
    };
  }, [preload, currentUrl]); // Re-attach when preload or currentUrl changes

  // Legacy context menu handlers (for backward compatibility)
  useEffect(() => {
    const handleContextMenu = ({ command, selectedText }) => {
      handleContextMenuCommand(command, selectedText, '');
    };
    return window.electron.ipcRenderer.on('context-menu-command', handleContextMenu);
  }, []);

  useEffect(() => {
    const handleOpenUrl = (url) => {
      document.querySelector('webview').src = url;
    };
    return window.electron.ipcRenderer.on('open-url', handleOpenUrl);
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
        // Remove paragraph icons when navigating to new page
        if (paragraphIconsActive) {
          removeParagraphIcons();
        }
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
  }, [currentUrl, book, paragraphIconsActive, removeParagraphIcons]);

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
        onToggleParagraphIcons={toggleParagraphIcons}
        paragraphIconsActive={paragraphIconsActive}
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
          onChatPanelRef={(ref) => {
            chatPanelRef.current = ref;
          }}
          activeTab={sidebarActiveTab}
          onActiveTabChange={setSidebarActiveTab}
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
      <ImpressModal
        open={showImpressModal}
        onClose={() => {
          setShowImpressModal(false);
          setImpressContent(null);
        }}
        htmlContent={impressContent}
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

      {/* Custom Context Menu */}
      <BrowserContextMenu
        visible={contextMenu.visible}
        position={contextMenu.position}
        menuType={contextMenu.menuType}
        selectedText={contextMenu.selectedText}
        imageUrl={contextMenu.imageUrl}
        sourceElementId={contextMenu.sourceElementId}
        onClose={closeContextMenu}
        onCommand={handleContextMenuCommand}
      />

      {/* Skill Result Popover - 5W Analysis */}
      <Popover
        open={Boolean(skillResultAnchor)}
        anchorEl={skillResultAnchor}
        onClose={() => setSkillResultAnchor(null)}
        anchorOrigin={{
          vertical: 'center',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'center',
          horizontal: 'center',
        }}
        slotProps={{
          paper: {
            sx: {
              maxWidth: 520,
              maxHeight: '80vh',
              overflow: 'auto',
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            },
          },
        }}
      >
        <Paper
          sx={{
            p: 2.5,
            background: theme.palette.mode === 'dark'
              ? 'linear-gradient(145deg, #1e1e2e 0%, #2d2d3d 100%)'
              : 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 100%)',
          }}
        >
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: 16,
                }}
              >
                5W
              </Box>
              <Typography variant="h6" fontWeight="bold">
                {skillResultTitle}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => setSkillResultAnchor(null)}
              sx={{
                bgcolor: 'action.hover',
                '&:hover': { bgcolor: 'action.selected' },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* Content */}
          {skillResultLoading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
              <CircularProgress size={32} sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Analyzing text structure...
              </Typography>
            </Box>
          ) : skillResultContent?.type === 'fiveW' ? (
            <FiveWAnalysisPanel
              data={skillResultContent.data}
              sentenceCount={skillResultContent.sentenceCount}
              compact
            />
          ) : skillResultContent?.type === 'error' ? (
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: 'error.main',
                color: 'error.contrastText',
              }}
            >
              <Typography variant="body2">
                {skillResultContent.message}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No analysis results available.
            </Typography>
          )}
        </Paper>
      </Popover>
    </div>
  );
}

export default Browser;
