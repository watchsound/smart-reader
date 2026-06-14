/* eslint-disable no-restricted-syntax */
/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import {
  app,
  BrowserWindow,
  Menu,
  MenuItem,
  ipcMain,
  nativeImage,
  powerSaveBlocker,
  nativeTheme,
  clipboard,
  webContents,
  shell,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import path from 'path';
import Store from 'electron-store';
import fs from 'fs';
import { v4 as uuid } from 'uuid';

import JSON5 from 'json5';

import natural from 'natural';

import { Ollama } from 'ollama';

import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import StorageUtil from './utils/storageUtil';

import ttsManager from './utils/TTSManager';

import BookUtil from './utils/bookUtil';

// import KeywordsLinkPlugin from './utils/KeywordsLinkPlugin';
import {
  StudyMode,
  ReaderLevel,
  ChatGPTModel,
  GeminiModel,
  AIProvider,
  LeitnerSpeed,
  ClaudeModel,
  OllamaModel,
  BaiduModel,
  KimiModel,
  DoubaoModel,
  QwenModel,
} from '../commons/model/DataTypes';

import { getUserIdFromToken } from './db/dbManager';
import { login, register } from './db/PersonManager';
import {
  createBook,
  getBookById,
  getBookByIdFromServer,
  getBooks,
  getBooksByQuery,
  getBooksByBookshelfId,
  getBooksByCategory,
  updateBook,
  deleteAllBook,
  deleteBookById,
  changeBookshelf,
} from './db/BookManager';
import {
  createBookshelf,
  renameBookshelf,
  deleteAllBookshelf,
  deleteBookshelfById,
  getAllBookshelf,
  getBookshelfById,
} from './db/BookshelfManager';

import {
  getChatById,
  createChat,
  getChatsByQuery,
  getLearnAboutByQuery,
  getPinnedChats,
  getPinnedLearnAbout,
  updateChat,
  deleteAllChat,
  deleteChatById,
} from './db/ChatManager';
import {
  createMessage,
  getMessageById,
  getMessageByQuery,
  getMessagesByChatId,
  updateMessage,
  deleteAllMessage,
  deleteMessageById,
  deleteMessageByChatId,
} from './db/MessageManager';
import {
  createPrompt,
  getPromptById,
  getPromptsByQuery,
  getPromptsBySource,
  updatePrompt,
  deleteAllPrompt,
  deletePromptById,
} from './db/PromptManager';
import {
  createQuizProblem,
  getQuizProblemById,
  updateQuizProblem,
  deleteAllQuizProblem,
  deleteQuizProblemById,
  getQuizProblemByQuery,
  getQuizProblemBySourceKeyAndSourceType,
} from './db/QuizProblemJsonManager';
import {
  createNote,
  getNoteById,
  getNotesByIds,
  getNotesByQuery,
  getNotesByDueReview,
  updateNote,
  deleteNoteBySourceKeyAndSourceType,
  updateNoteCard,
  replaceNote,
  deleteNoteById,
  addNoteToLeitnerStudy,
  queryNoteBySourceKeyAndSourceType,
  deleteAllNote,
} from './db/NoteJsonManager';
import { createImage, getImage } from './db/ImageManager';

import {
  createMoodBoard,
  getMoodBoardById,
  getMoodBoardsByQuery,
  updateMoodBoard,
  deleteMoodBoardById,
  deleteAllMoodBoards,
} from './db/MoodBoardJsonManager';
import {
  createBookmarkGroup,
  getBookmarkGroupById,
  getBookmarkGroupByName,
  printBookmarkGroupStructure,
  jsonBookmarkGroupStructure,
  getTopBookmarkGroup,
  renameBookmarkGroup,
  deleteAllBookmarkGroups,
} from './db/BookmarkGroupManager';
import {
  updateBookmark,
  deleteAllBookmark,
  deleteBookmarkById,
  getBookmarkById,
  getBookmarksBySourceKey,
  getBookmarkByQuery,
  getBookmarksByGroupId,
  getBookmarksRecursiveByGroupId,
} from './db/BookmarkManager';
import {
  getVocabularyById,
  getVocabularyByName,
  createVocabulary,
  getVocabulariesBySetId,
  getVocabulariesByQuery,
  getVocabulariesByDueReview,
  updateVocabulary,
  deleteVocabularyById,
  deleteAllVocabulary,
  addVocabularyToSet,
} from './db/VocabularyManager';
import {
  getVocabularySetById,
  createVocabularySet,
  getVocabularySetByQuery,
  updateVocabularySet,
  updateVocabularySetByTime,
  deleteVocabularySetById,
  deleteAllVocabularySet,
} from './db/VocabularySetManager';
import {
  getHistoryGroupById,
  getHistoryGroupByName,
  createHistoryGroup,
  getHistoryGroupByQuery,
  deleteAllHistoryGroups,
} from './db/HistoryGroupManager';
import {
  getHistoryById,
  createHistory,
  getHistoryByQuery,
  getHistoriesByGroupId,
  getHistoryByGroupIdAndSourceKey,
  deleteAllHistories,
  updateHistory,
} from './db/HistoryManager';

import {
  getLeitnerItemById,
  createLeitnerItem,
  updateLeitnerItem,
  deleteLeitnerItemById,
} from './db/LeitnerItemManager';

import createBookmarkUtils, {
  createUrlDescription,
} from './utils/createBookmarkUtils';
import initialDatabase from './db/DatabaseInitializer';
import { createVocabularyPrompt } from '../commons/utils/AIPrompts';

import { instanceInMain as aiProviderManager } from '../commons/service/AIProviderManager';
import checkLibreOfficeInstalled from './utils/checkLibreOfficeInstalled';

import getBaiduAccessToken from './utils/baiduUtil';
import markdownManager from './utils/MarkdownManager';
import chromaManager from './utils/ChromaManager';
import registerGraphHandlers from './ipc/graphHandlers';
import { registerSkillHandlers, updateSkillServices } from './ipc/skillHandlers';
import { registerLearningHandlers } from './ipc/learningHandlers';
import { registerNotificationHandlers } from './ipc/notificationHandlers';
import { registerSpacedRepetitionHandlers } from './ipc/spacedRepetitionHandlers';
import { registerLearningPlanHandlers } from './ipc/learningPlanHandlers';
import { registerStudyEnhancementHandlers } from './ipc/studyEnhancementHandlers';
import { registerStudyAnalyticsHandlers } from './ipc/studyAnalyticsHandlers';
import { registerBrainHandlers } from './ipc/brainHandlers';
// Brain-driven shell (Plan 1): renderer trigger-bus IPC + main-process trigger emitter.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { registerTriggerBusHandlers } = require('./ipc/triggerBusHandlers');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TriggerEmitter = require('./brain/TriggerEmitter');
import { registerUnifiedLearningHandlers } from './ipc/unifiedLearningHandlers';
import { registerLearningPointHandlers } from './ipc/learningPointHandlers';
import { registerMicroCardHandlers } from './ipc/microCardHandlers';
import { registerEnrichmentHandlers } from './ipc/enrichmentHandlers';
import { registerBookDiagnosticHandlers } from './ipc/bookDiagnosticHandlers';
import { registerComprehensionHandlers } from './ipc/comprehensionHandlers';
import { registerRereadQueueHandlers } from './ipc/rereadQueueHandlers';
import { registerMoodBoardOrganizerHandlers } from './ipc/moodBoardOrganizerHandlers';
import { registerProductionPromptHandlers } from './ipc/productionPromptHandlers';
import { registerLearningPathPlannerHandlers } from './ipc/learningPathPlannerHandlers';
import graphInterface from './utils/GraphInterface';
import { initializeLearningBrain, shutdownLearningBrain } from './brain';

import { fetchPageHeadless } from './utils/webParserUtil';

const options = {
  width: 1050,
  height: 660,
  webPreferences: {
    webSecurity: false,
    nodeIntegration: true,
    contextIsolation: false,
    nativeWindowOpen: true,
    nodeIntegrationInSubFrames: true,
    allowRunningInsecureContent: true,
    enableRemoteModule: true,
    webviewTag: true,
    // devTools: false,
  },
};

let readerWindow: BrowserWindow;
const store = new Store();
markdownManager.setupMarkdown(store);

const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'assets')
  : path.join(__dirname, '../../assets');

const chatIcon = nativeImage.createFromPath(
  path.join(RESOURCES_PATH, 'images', 'chat-16.png'),
);
const noteIcon = nativeImage.createFromPath(
  path.join(RESOURCES_PATH, 'images', 'note-16.png'),
);
const reactIcon = nativeImage.createFromPath(
  path.join(RESOURCES_PATH, 'images', 'react.png'),
);
const copyIcon = nativeImage.createFromPath(
  path.join(RESOURCES_PATH, 'images', 'copy.png'),
);
const speakerIcon = nativeImage.createFromPath(
  path.join(RESOURCES_PATH, 'images', 'speaker.png'),
);
// https://medium.com/@zahidbashirkhan/solved-maxlistenersexceededwarning-understanding-and-resolving-the-eventemitter-memory-leak-93df6ff4b5d4
process.setMaxListeners(120);

const isDevelopment = process.env.NODE_ENV !== 'production';
const UseDevTools = false;
let executablePath: string;
if (isDevelopment) {
  try {
    executablePath = path.join('node_modules', 'electron', 'dist', 'electron');
    if (process.platform === 'win32') {
      executablePath += '.exe';
    }
  } catch (error) {
    console.error('Error fetching Electron path:', error);
  }
} else {
  // Construct path to executable in a packaged app
  // This path will need adjustment based on your packaging configuration
  executablePath = path.join(process.resourcesPath, 'electron');
  if (process.platform === 'darwin') {
    executablePath = path.join(executablePath, 'Contents', 'MacOS', 'Electron');
  }
}

let filePath: string | null = null;
if (process.platform !== 'darwin' && process.argv.length >= 2) {
  // filePath = process.argv[1];
  console.log(`filePath0 = ${process.argv[0]}`);
  console.log(`filePath0 = ${process.argv[1]}`);
  console.log(`filePath0 = ${process.argv[2]}`);
}
console.log(`filePath0 = ${filePath}`);

const configDir = app.getPath('userData');

interface SharedStates {
  // userDataUploadsPath: string;
  dirname: string;
  storageLocation: string;
  serverUrl: string;
  executablePath: string;
  store: Store;
}

// Extend global namespace for shared state
declare global {
  // eslint-disable-next-line no-var
  var shared: SharedStates;
}

let libreOfficeInstalled = false;

async function setupThirdPartySetting(userId: number): Promise<void> {
  console.log('enter setupThirdPartySetting');
  libreOfficeInstalled = await checkLibreOfficeInstalled();
  console.log(` libreOfficeInstalled = ${libreOfficeInstalled}`);

  const provider0 = store.get(`ai_provider_${userId}`) as string;
  const apiKeyChatgpt = store.get(`openai_key_${userId}`) as string;
  const apiKeyGemini = store.get(`gemini_key_${userId}`) as string;
  const apiKeyKimi = store.get(`kimi_key_${userId}`) as string;
  const apiKeyClaude = store.get(`claude_key_${userId}`) as string;
  // const baiduAccessToken = await getBaiduAccessToken(userId);
  const apiKeyBaidu = store.get(`baidu_key_${userId}`) as string;

  const { key, provider } = aiProviderManager.preSetup(
    provider0,
    apiKeyChatgpt,
    apiKeyGemini,
    apiKeyKimi,
    apiKeyClaude,
    apiKeyBaidu,
  );

  let model = '';
  if (provider === AIProvider.ChatGPT) {
    model = store.get(`openai_model_${userId}`) as string;
  } else if (provider === AIProvider.Gemini) {
    model = store.get(`gemini_model_${userId}`) as string;
  } else if (provider === AIProvider.Baidu) {
    model = store.get(`baidu_secret_${userId}`) as string;
  }

  aiProviderManager.setup(false, userId, provider, key, model);
  await chromaManager.setupChroma(store);
  chromaManager.setupVectorDB(store, userId);
}

async function setupPathInfo() {
  const sLoc = await StorageUtil.getReaderConfig(store, 'storageLocation');
  global.shared = {
    // userDataUploadsPath: path.join(configDir, 'uploads'),
    store,
    dirname: !app.isPackaged // process.env.NODE_ENV === 'development'
      ? path.dirname(__dirname)
      : process.resourcesPath,
    storageLocation: sLoc || path.join(configDir, 'uploads', 'data'),
    serverUrl:
      process.env.NODE_ENV === 'development'
        ? 'http://localhost:9080'
        : (store.get('server_url') as string),
    executablePath,
  } as SharedStates;
  console.log(
    `global.shared.storageLocation = ${global.shared.storageLocation}`,
  );
  store.set('storageLocation', global.shared.storageLocation);
}
setupPathInfo();

const singleInstance = app.requestSingleInstanceLock();

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWin: BrowserWindow | null = null;

/** open book */
async function openBook(config: {
  url: string;
  isMergeWord?: string;
  isFullscreen?: string;
  isPreventSleep?: string;
}): Promise<void> {
  const { url, isMergeWord, isFullscreen, isPreventSleep } = config;
  options.webPreferences.nodeIntegrationInSubFrames = true;
  StorageUtil.setReaderConfigs(store, {
    url,
    isMergeWord: isMergeWord || 'no',
    isFullscreen: isFullscreen || 'no',
    isPreventSleep: isPreventSleep || 'no',
  });
  let id: number | undefined;
  if (isPreventSleep === 'yes') {
    id = powerSaveBlocker.start('prevent-display-sleep');
    console.log(powerSaveBlocker.isStarted(id));
  }

  if (isFullscreen === 'yes') {
    readerWindow = new BrowserWindow(options);
    readerWindow.loadURL(url);
    readerWindow.maximize();
  } else {
    const windowWidth =
      (await StorageUtil.getReaderConfig(store, 'windowWidth')) || 1050;
    const windowHeight =
      (await StorageUtil.getReaderConfig(store, 'windowHeight')) || 660;
    const windowX = (await StorageUtil.getReaderConfig(store, 'windowX')) || 0;
    const windowY = (await StorageUtil.getReaderConfig(store, 'windowY')) || 0;
    readerWindow = new BrowserWindow({
      ...options,
      width: parseInt(windowWidth),
      height: parseInt(windowHeight),
      x: parseInt(windowX),
      y: parseInt(windowY),
      frame: isMergeWord !== 'yes',
      hasShadow: isMergeWord !== 'yes',
      transparent: isMergeWord === 'yes',
    });
    readerWindow.loadURL(url);
  }
  readerWindow.on('close', (event) => {
    if (!readerWindow.isDestroyed()) {
      const bounds = readerWindow.getBounds();
      StorageUtil.setReaderConfigs(store, {
        windowWidth: bounds.width,
        windowHeight: bounds.height,
        windowX: bounds.x,
        windowY: bounds.y,
      });
    }
    if (isPreventSleep && !readerWindow.isDestroyed()) {
      id && powerSaveBlocker.stop(id);
    }
    // readerWindow && readerWindow.destroy();
    // readerWindow = null;
  });
}

// Single Instance Lock
if (!singleInstance) {
  app.quit();
  if (filePath) {
    fs.writeFileSync(
      path.join(global.shared.storageLocation, 'log.json'),
      JSON.stringify({ filePath }),
      'utf-8',
    );
  }
} else {
  app.on('second-instance', (event, argv, workingDir) => {
    if (mainWin) {
      if (!mainWin.isVisible()) mainWin.show();
      mainWin.focus();
    }
  });
}

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  ipcMain.on('getAssetRootPath', (_) => {
    _.returnValue = RESOURCES_PATH;
  });

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWin = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      webSecurity: false,
      // from koodo-reader
      nodeIntegration: true,
      webviewTag: true,
      // devTools: false,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWin.loadURL(resolveHtmlPath('index.html'));

  mainWin.on('ready-to-show', () => {
    if (!mainWin) {
      throw new Error('"mainWin" is not defined');
    }
    if (UseDevTools) mainWin.webContents.openDevTools();

    if (process.env.START_MINIMIZED) {
      mainWin.minimize();
    } else {
      mainWin.show();
    }
  });

  mainWin.on('closed', () => {
    mainWin = null;
  });

  const menuBuilder = new MenuBuilder(mainWin);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  // mainWin.webContents.setWindowOpenHandler((edata) => {
  //   shell.openExternal(edata.url);
  //   return { action: 'deny' };
  // });
  // Open urls in the user's browser
  // https://stackoverflow.com/questions/74945364/when-a-open-in-new-tab-link-is-clicked-in-a-webview-element-it-opens-a-popup#:~:text=To%20stop%20the%20action%20of%20a%20new%20tab%2Fwindow%20opening,('electron')%20webview.
  mainWin.webContents.on('did-attach-webview', (_, contents) => {
    contents.setWindowOpenHandler((details) => {
      mainWin?.webContents.send('open-url', details.url);
      return { action: 'deny' };
    });
  });

  /**   store related  */
  ipcMain.on('setStoreValue', (_, key, value) => {
    // console.log(`setStoreValue ${key} = ${value}`);
    store.set(key, value);
    _.returnValue = true;
  });

  ipcMain.on(
    'upSertCollectionInStore',
    async (_, name, keyName, keyValue, obj, token) => {
      console.log(
        `upSertCollectionInStore ${name} ${keyName} = ${keyValue} : ${obj}`,
      );
      const c = store.get(name) as Array<Record<string, unknown>> | undefined;
      if (!c) {
        if (name === 'note') {
          // Add to ChromaDB vector store (existing behavior)
          try {
            await chromaManager.addNodeToVecterDB(store, obj, token);
          } catch (e) {}
          // Also add to graph database (new - parallel storage)
          try {
            if (graphInterface.isReady()) {
              await graphInterface.createNote(obj, token);
            }
          } catch (e) {
            console.error('Failed to add note to graph:', e);
          }
        }

        store.set(name, [obj]);
        console.log(' return 1');
        _.returnValue = obj;
      } else {
        const found = c.find((item: Record<string, unknown>) => item[keyName] === keyValue);
        if (!found) {
          if (name === 'note') {
            // Add to ChromaDB vector store (existing behavior)
            try {
              await chromaManager.addNodeToVecterDB(store, obj, token);
            } catch (e) {}
            // Also add to graph database (new - parallel storage)
            try {
              if (graphInterface.isReady()) {
                await graphInterface.createNote(obj, token);
              }
            } catch (e) {
              console.error('Failed to add note to graph:', e);
            }
          }
          c.unshift(obj);
          store.set(name, c);
          console.log(' return 2');
          _.returnValue = obj;
        } else {
          Object.assign(found, obj);
          store.set(name, c);
          console.log(' return 3');
          _.returnValue = found;
        }
      }
    },
  );

  ipcMain.on('deleteCollectionInStore', (_, name, keyName, keyValue) => {
    console.log(`deleteCollectionInStore ${name} ${keyName} = ${keyValue} `);
    const c = store.get(name) as Array<Record<string, unknown>> | undefined;
    if (!c) {
      _.returnValue = false;
      return;
    }
    const index = c.findIndex((item: Record<string, unknown>) => item[keyName] === keyValue);
    if (index > -1) {
      c.splice(index, 1);
      store.set(name, c);
      _.returnValue = true;
    } else {
      _.returnValue = false;
    }
  });

  ipcMain.on('getByIdsInCollection', (_, name, keyName, keyList) => {
    const c = store.get(name) as Array<Record<string, unknown>> | undefined;
    if (!c) return null;
    const found = c.find((item: Record<string, unknown>) => keyList.includes(item[keyName]));
    _.returnValue = found;
  });

  ipcMain.on('getOneInCollection', (_, name, keyName, keyValue) => {
    const c = store.get(name) as Array<Record<string, unknown>> | undefined;
    if (!c) return null;
    const found = c.find((item: Record<string, unknown>) => item[keyName] === keyValue);
    _.returnValue = found;
  });
  ipcMain.on('addToVocabulary', async (_, text, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0 || !text || text.length < 3) {
      _.returnValue = false;
      return;
    }
    const exists = await getVocabularyByName(text.trim());
    if (exists) {
      _.returnValue = exists;
      return;
    }
    try {
      const level = store.get('reader_level');
      // const model = store.get('chatgpt-model') || ChatGPTModel.GPT3_5;
      const json = await aiProviderManager.generateContentWithJson(
        createVocabularyPrompt(text.trim(), level),
        true,
      );
      const newOne = await createVocabulary(
        {
          word: text.trim(),
          definition: json ? json.definition : '',
          relatedWords: json ? json.root : '',
          example: json ? json.example : '',
          setId: -1,
          score: 0,
        },
        token,
      );
      _.returnValue = newOne;
    } catch (e: unknown) {
      const err = e as { message?: string };
      console.log(err.message ? err.message : e);
      _.returnValue = false;
    }
  });
  ipcMain.on('sentenceTokenizer', (_, paragraph) => {
    try {
      const tokenizer = new natural.SentenceTokenizer();
      const sentences = tokenizer.tokenize(paragraph);
      _.returnValue = sentences || [];
    } catch (e) {
      _.returnValue = [];
    }
  });
  ipcMain.on('getRecentURL', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = [];
      return;
    }
    const c = store.get(`recent_url_${userId}`) as string[] | undefined;
    if (c && c.length > 10) {
      c.splice(0, c.length - 10);
    }
    _.returnValue = c || [];
  });
  ipcMain.on('addToRecentURL', (_, url, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = [];
      return;
    }
    const c = (store.get(`recent_url_${userId}`) || []) as string[];
    if (!c.includes(url)) {
      c.push(url);
    }
    if (c.length > 10) {
      c.splice(0, c.length - 10);
    }
    store.set(`recent_url_${userId}`, c);
    _.returnValue = c;
  });
  ipcMain.on('getKeyWordList', (_, { mode, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = [];
      return;
    }
    const c = store.get(`keywords_${mode}_${userId}`) as string[] | undefined;
    if (c && c.length > 50) {
      c.splice(0, c.length - 50);
    }
    _.returnValue = c || [];
  });
  ipcMain.on('addToKeyWordList', (_, mode, keyword, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0 || !keyword) {
      _.returnValue = [];
      return;
    }
    try {
      const c = (store.get(`keywords_${mode}_${userId}`) || []) as string[];
      const ks = keyword.split('|');
      const stemmer = natural.PorterStemmer;
      ks.forEach((word: string) => {
        const v = stemmer.stem(word);
        if (!c.includes(v)) {
          c.push(v);
        }
      });
      if (c.length > 50) {
        c.splice(0, c.length - 50);
      }
      store.set(`keywords_${mode}_${userId}`, c);
      _.returnValue = c;
    } catch (e: unknown) {
      const err = e as { message?: string };
      console.log(err.message ? err.message : e);
      _.returnValue = false;
    }
  });
  ipcMain.on('setKeyWordList', (_, mode, keywords, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
      return;
    }
    if (!keywords) {
      _.returnValue = false;
      return;
    }
    if (keywords.length > 100) {
      keywords.splice(0, keywords.length - 100);
    }
    store.set(`keywords_${mode}_${userId}`, keywords);
    _.returnValue = true;
  });
  ipcMain.on('removeFromKeyWordList', (_, mode, keyword, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0 || !keyword) {
      _.returnValue = false;
      return;
    }
    try {
      const c = (store.get(`keywords_${mode}_${userId}`) || []) as string[];
      const ks = keyword.split('|');
      ks.forEach((element: string) => {
        const index = c.indexOf(element);
        if (index > -1) {
          c.splice(index, 1);
        }
      });
      store.set(`keywords_${mode}_${userId}`, c);
      _.returnValue = c;
    } catch (e: unknown) {
      const err = e as { message?: string };
      console.log(err.message ? err.message : e);
      _.returnValue = false;
    }
  });

  ipcMain.on('queryCollection', (_, name, query, fieldOne, fieldTwo) => {
    const c = store.get(name) as Array<Record<string, unknown>> | undefined;
    if (!c) {
      _.returnValue = [];
      return;
    }
    if (!query) {
      _.returnValue = c;
      return;
    }

    try {
      const r = c.filter((item: Record<string, unknown>) => {
        if (fieldOne && item[fieldOne] && (item[fieldOne] as string).indexOf(query) >= 0)
          return true;
        if (fieldTwo && item[fieldTwo] && (item[fieldTwo] as string).indexOf(query) >= 0)
          return true;
        return false;
      });
      _.returnValue = r;
    } catch (e: unknown) {
      const err = e as { message?: string };
      console.log(err.message ? err.message : e);
      _.returnValue = [];
    }
  });

  ipcMain.on('deleteStoreValue', (_, key) => {
    store.delete(key);
    _.returnValue = true;
  });
  ipcMain.on('getStoreValue', (_, key) => {
    const value = store.get(key);
    // console.log(`getStore ${key} = ${value}`);
    _.returnValue = value || '';
  });
  ipcMain.on('selected-text', (event, selectedText) => {
    console.log('Selected text:', selectedText);
    store.set('selected-text', selectedText);
  });
  ipcMain.on('get-selected-text', (_) => {
    const value = store.get('selected-text');
    _.returnValue = value || '';
  });
  ipcMain.on('getGeminiModel', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = -1;
    } else {
      const mode = store.get(`gemini-model_${userId}`);
      _.returnValue = mode || GeminiModel.GEMINI_2_FLASH;
    }
  });

  ipcMain.on('setGeminiModel', (_, { mode, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`gemini-model_${userId}`, mode);
      _.returnValue = true;
    }
  });
  ipcMain.on('getOllamaModel', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = -1;
    } else {
      const mode = store.get(`ollama-model_${userId}`);
      _.returnValue = mode || OllamaModel.LLAMA_3_2_3B;
    }
  });

  ipcMain.on('setOllamaModel', (_, { mode, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`ollama-model_${userId}`, mode);
      _.returnValue = true;
    }
  });
  ipcMain.on('getClaudeModel', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = -1;
    } else {
      const mode = store.get(`claude-model_${userId}`);
      _.returnValue = mode || ClaudeModel.CLAUDE_HAIKU_4_5;
    }
  });

  ipcMain.on('setClaudeModel', (_, { mode, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`claude-model_${userId}`, mode);
      _.returnValue = true;
    }
  });
  ipcMain.on('getChatGPTModel', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = -1;
    } else {
      const mode = store.get(`chatgpt-model_${userId}`);
      _.returnValue = mode || ChatGPTModel.GPT4_1_MINI;
    }
  });

  ipcMain.on('setChatGPTModel', (_, { mode, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`chatgpt-model_${userId}`, mode);
      _.returnValue = true;
    }
  });

  // Advanced model handlers
  ipcMain.on('getChatGPTAdvancedModel', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = -1;
    } else {
      const mode = store.get(`chatgpt-advanced-model_${userId}`);
      _.returnValue = mode || ChatGPTModel.GPT4_1;
    }
  });

  ipcMain.on('setChatGPTAdvancedModel', (_, { mode, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`chatgpt-advanced-model_${userId}`, mode);
      _.returnValue = true;
    }
  });

  ipcMain.on('getGeminiAdvancedModel', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = -1;
    } else {
      const mode = store.get(`gemini-advanced-model_${userId}`);
      _.returnValue = mode || GeminiModel.GEMINI_2_5_PRO;
    }
  });

  ipcMain.on('setGeminiAdvancedModel', (_, { mode, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`gemini-advanced-model_${userId}`, mode);
      _.returnValue = true;
    }
  });

  ipcMain.on('getClaudeAdvancedModel', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = -1;
    } else {
      const mode = store.get(`claude-advanced-model_${userId}`);
      _.returnValue = mode || ClaudeModel.CLAUDE_OPUS_4_5;
    }
  });

  ipcMain.on('setClaudeAdvancedModel', (_, { mode, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`claude-advanced-model_${userId}`, mode);
      _.returnValue = true;
    }
  });

  ipcMain.on('getOllamaAdvancedModel', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = -1;
    } else {
      const mode = store.get(`ollama-advanced-model_${userId}`);
      _.returnValue = mode || OllamaModel.LLAMA_3_3_70B;
    }
  });

  ipcMain.on('setOllamaAdvancedModel', (_, { mode, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`ollama-advanced-model_${userId}`, mode);
      _.returnValue = true;
    }
  });

  // Baidu model handlers
  ipcMain.on('getBaiduModel', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = -1;
    } else {
      const mode = store.get(`baidu-model_${userId}`);
      _.returnValue = mode || BaiduModel.ERNIE_4_5_TURBO;
    }
  });

  ipcMain.on('setBaiduModel', (_, { mode, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`baidu-model_${userId}`, mode);
      _.returnValue = true;
    }
  });

  ipcMain.on('getBaiduAdvancedModel', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = -1;
    } else {
      const mode = store.get(`baidu-advanced-model_${userId}`);
      _.returnValue = mode || BaiduModel.ERNIE_5;
    }
  });

  ipcMain.on('setBaiduAdvancedModel', (_, { mode, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`baidu-advanced-model_${userId}`, mode);
      _.returnValue = true;
    }
  });

  // Kimi model handlers
  ipcMain.on('getKimiModel', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = -1;
    } else {
      const mode = store.get(`kimi-model_${userId}`);
      _.returnValue = mode || KimiModel.KIMI_K2_LITE;
    }
  });

  ipcMain.on('setKimiModel', (_, { mode, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`kimi-model_${userId}`, mode);
      _.returnValue = true;
    }
  });

  ipcMain.on('getKimiAdvancedModel', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = -1;
    } else {
      const mode = store.get(`kimi-advanced-model_${userId}`);
      _.returnValue = mode || KimiModel.KIMI_K2_5;
    }
  });

  ipcMain.on('setKimiAdvancedModel', (_, { mode, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`kimi-advanced-model_${userId}`, mode);
      _.returnValue = true;
    }
  });

  ipcMain.on('getDoubaoModel', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = -1;
    } else {
      const mode = store.get(`doubao-model_${userId}`);
      _.returnValue = mode || DoubaoModel.DOUBAO_PRO_32K;
    }
  });

  ipcMain.on('setDoubaoModel', (_, { mode, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`doubao-model_${userId}`, mode);
      _.returnValue = true;
    }
  });

  ipcMain.on('getDoubaoAdvancedModel', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = -1;
    } else {
      const mode = store.get(`doubao-advanced-model_${userId}`);
      _.returnValue = mode || DoubaoModel.DOUBAO_SEED_1_6;
    }
  });

  ipcMain.on('setDoubaoAdvancedModel', (_, { mode, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`doubao-advanced-model_${userId}`, mode);
      _.returnValue = true;
    }
  });

  ipcMain.on('getQwenModel', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = -1;
    } else {
      const mode = store.get(`qwen-model_${userId}`);
      _.returnValue = mode || QwenModel.QWEN_PLUS;
    }
  });

  ipcMain.on('setQwenModel', (_, { mode, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`qwen-model_${userId}`, mode);
      _.returnValue = true;
    }
  });

  ipcMain.on('getQwenAdvancedModel', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = -1;
    } else {
      const mode = store.get(`qwen-advanced-model_${userId}`);
      _.returnValue = mode || QwenModel.QWEN3_MAX;
    }
  });

  ipcMain.on('setQwenAdvancedModel', (_, { mode, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`qwen-advanced-model_${userId}`, mode);
      _.returnValue = true;
    }
  });

  ipcMain.on('getLeitnerSpeed', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = -1;
    } else {
      const speed = store.get(`leitner_speed_${userId}`);
      _.returnValue = speed || LeitnerSpeed.Normal;
    }
  });

  ipcMain.on('setLeitnerSpeed', (_, { speed, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`leitner_speed_${userId}`, speed);
      _.returnValue = true;
    }
  });

  ipcMain.on('getNoteBgImage', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = -1;
    } else {
      const mode = store.get(`note-bg-image_${userId}`);
      _.returnValue = mode || 0;
    }
  });

  ipcMain.on('setNoteBgImage', (_, { imageNum, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`note-bg-image_${userId}`, imageNum);
      _.returnValue = true;
    }
  });
  ipcMain.on('getFontFamily', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = -1;
    } else {
      const mode = store.get(`font-family_${userId}`);
      _.returnValue = mode || 'Arial';
    }
  });

  ipcMain.on('setFontFamily', (_, { fontFamily, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`font-family_${userId}`, fontFamily);
      _.returnValue = true;
    }
  });
  ipcMain.on('getNoteColorSetting', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = -1;
    } else {
      const mode = store.get(`note-color-setting_${userId}`);
      _.returnValue = mode || ['#000000', '#FFFFFF', '#000000'];
    }
  });

  ipcMain.on('setNoteColorSetting', (_, { colors, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`note-color-setting_${userId}`, colors);
      _.returnValue = true;
    }
  });
  ipcMain.on('getReaderLevel', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      const mode = store.get(`reader_level_${userId}`);
      _.returnValue = mode || StudyMode.General;
    }
  });

  ipcMain.on('setReaderLevel', (_, { mode, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`reader_level_${userId}`, mode);
      _.returnValue = true;
    }
  });
  ipcMain.on('getStudyMode', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      const mode = store.get(`study_mode_${userId}`);
      _.returnValue = mode || StudyMode.General;
    }
  });

  ipcMain.on('setStudyMode', (_, { mode, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`study_mode_${userId}`, mode);
      _.returnValue = true;
    }
  });
  ipcMain.on('setUseChroma', (_, { key, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`useChroma_${userId}`, key || false);
      _.returnValue = true;
    }
  });
  ipcMain.on('getUseChroma', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      // default value is true?
      let key = store.get(`useChroma_${userId}`, undefined);
      if (key === undefined) key = true;
      _.returnValue = key;
    }
  });
  ipcMain.on('getOpenAiImage', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      const key = store.get(`openai_image_${userId}`);
      _.returnValue = key || false;
    }
  });
  ipcMain.on('setOpenAiImage', (_, { key, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`openai_image_${userId}`, key || false);
      _.returnValue = true;
    }
  });
  ipcMain.on('getAIProvider', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      let provider = store.get(`ai_provider_${userId}`);
      if (!provider) {
        let key = store.get(`openai_key_${userId}`);
        if (key) provider = AIProvider.ChatGPT;
        else {
          key = store.get(`gemini_key_${userId}`);
          if (key) provider = AIProvider.Gemini;
        }
      }
      _.returnValue = provider || false;
    }
  });

  ipcMain.on('setAIProvider', (_, { provider, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`ai_provider_${userId}`, provider || false);
      _.returnValue = true;
    }
  });
  ipcMain.on('getOpenAIKey', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      const key = store.get(`openai_key_${userId}`);
      _.returnValue = key || false;
    }
  });

  ipcMain.on('setOpenAIKey', (_, { key, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`openai_key_${userId}`, key || false);
      _.returnValue = true;
    }
  });
  ipcMain.on('getGeminiKey', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      const key = store.get(`gemini_key_${userId}`);
      _.returnValue = key || false;
    }
  });

  ipcMain.on('setGeminiKey', (_, { key, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`gemini_key_${userId}`, key || false);
      _.returnValue = true;
    }
  });
  ipcMain.on('getClaudeKey', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      const key = store.get(`claude_key_${userId}`);
      _.returnValue = key || false;
    }
  });

  ipcMain.on('setClaudeKey', (_, { key, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`claude_key_${userId}`, key || false);
      _.returnValue = true;
    }
  });
  ipcMain.on('getBaiduKey', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      const key = store.get(`baidu_key_${userId}`);
      _.returnValue = key || false;
    }
  });

  ipcMain.on('setBaiduKey', (_, { key, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`baidu_key_${userId}`, key || false);
      _.returnValue = true;
    }
  });
  ipcMain.on('getBaiduSecret', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      const key = store.get(`baidu_secret_${userId}`);
      _.returnValue = key || false;
    }
  });

  ipcMain.on('setBaiduSecret', (_, { key, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`baidu_secret_${userId}`, key || false);
      _.returnValue = true;
    }
  });
  ipcMain.on('getKimiKey', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      const key = store.get(`kimi_key_${userId}`);
      _.returnValue = key || false;
    }
  });

  ipcMain.on('setKimiKey', (_, { key, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`kimi_key_${userId}`, key || false);
      _.returnValue = true;
    }
  });

  ipcMain.on('getDoubaoKey', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      const key = store.get(`doubao_key_${userId}`);
      _.returnValue = key || false;
    }
  });

  ipcMain.on('setDoubaoKey', (_, { key, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`doubao_key_${userId}`, key || false);
      _.returnValue = true;
    }
  });

  ipcMain.on('getQwenKey', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      const key = store.get(`qwen_key_${userId}`);
      _.returnValue = key || false;
    }
  });

  ipcMain.on('setQwenKey', (_, { key, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`qwen_key_${userId}`, key || false);
      _.returnValue = true;
    }
  });

  ipcMain.on('getBaiduAccessToken', async (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      const key = await getBaiduAccessToken(store, userId);
      _.returnValue = key || false;
    }
  });

  /** database related */
  /** user manage */
  ipcMain.on('register', async (_, user, email, password) => {
    try {
      const v = register(user, email, password);

      _.returnValue = v;
    } catch (e) {
      console.log(e.message ? e.message : e);
      _.returnValue = false;
    }
  });
  ipcMain.on('login', async (_, email, password) => {
    try {
      const { id, username } = login(email, password);
      if (username) {
        const userInfo = {
          id,
          username,
          email,
          token: uuid(),
        };
        store.set('session_info', userInfo);
        console.log(JSON.stringify(userInfo));
        initialDatabase(userInfo.token);
        setupThirdPartySetting(id);
        _.returnValue = userInfo;
      } else {
        _.returnValue = { id, username, email, token: '' };
      }
    } catch (e) {
      console.log(e.message ? e.message : e);
      _.returnValue = { email, token: '' };
    }
  });
  ipcMain.on('logout', async (_, token) => {
    try {
      const info = store.get('session_info');
      console.log(`logout ${JSON.stringify(info)}`);
      console.log(`token ${token}`);
      if (info && info.token === token) {
        store.set('session_info', '');
        console.log(`logout ${true}`);
        _.returnValue = true;
      } else {
        console.log(`logout ${false}`);
        _.returnValue = false;
      }
    } catch (e) {
      console.log(e.message ? e.message : e);
      _.returnValue = false;
    }
  });
  // Validate session - check if renderer's token matches main process session
  ipcMain.on('validateSession', async (_, token) => {
    try {
      const info = store.get('session_info');
      if (info && info.token && info.token === token) {
        // Token matches, session is valid
        _.returnValue = info;
      } else {
        // Token doesn't match or no session
        _.returnValue = null;
      }
    } catch (e) {
      console.log(e.message ? e.message : e);
      _.returnValue = null;
    }
  });
  ipcMain.on('emojiData', async (_, { token }) => {
    const module = await import('./utils/emoji-data');
    _.returnValue = module;
  });

  ipcMain.on('getPDF4URL', async (_, { id }) => {
    try {
      const dataPath = await global.shared.store.get('storageLocation');
      if (fs.existsSync(path.join(dataPath, 'pdf4url'))) {
        const r = path.join(dataPath, 'pdf4url', id.toString());
        console.log(` getpdf4url = ${r} `);
        _.returnValue = r;
      } else {
        _.returnValue = '';
      }
    } catch (e) {
      console.log(e.message ? e.message : e);
      _.returnValue = '';
    }
  });

  ipcMain.on('deleteBookById', async (_, { id, token }) => {
    _.returnValue = deleteBookById(id, token);
  });
  ipcMain.on('deleteBookmarkById', async (_, { id, token }) => {
    _.returnValue = deleteBookmarkById(id, token);
  });
  ipcMain.on('deleteMoodBoardById', async (_, { id, token }) => {
    _.returnValue = deleteMoodBoardById(id, token);
  });
  ipcMain.on('deleteAllMoodBoards', async (_, { token }) => {
    _.returnValue = deleteAllMoodBoards(token);
  });
  ipcMain.on('deleteChatById', async (_, { id, token }) => {
    let r = deleteMessageByChatId(id, token);
    if (r) r = deleteChatById(id, token);
    _.returnValue = r;
  });
  ipcMain.on('addNoteToLeitnerStudy', async (_, { id, token }) => {
    _.returnValue = addNoteToLeitnerStudy(id, token);
  });
  ipcMain.on('deleteNoteById', async (_, { id, token }) => {
    _.returnValue = deleteNoteById(id, token);
  });
  ipcMain.on('deleteMessageById', async (_, { id, token }) => {
    _.returnValue = deleteMessageById(id, token);
  });
  ipcMain.on('deletePromptById', async (_, { id, token }) => {
    _.returnValue = deletePromptById(id, token);
  });
  ipcMain.on('deleteQuizProblem', async (_, { id, token }) => {
    _.returnValue = deleteQuizProblemById(id, token);
  });

  ipcMain.on('deleteAllBook', async (_, { token }) => {
    _.returnValue = deleteAllBook(token);
  });
  ipcMain.on('deleteAllBookmark', async (_, { token }) => {
    _.returnValue = deleteAllBookmark(token);
  });
  ipcMain.on('deleteAllChat', async (_, { token }) => {
    _.returnValue = deleteAllChat(token);
  });
  ipcMain.on('deleteAllNote', async (_, { token }) => {
    _.returnValue = deleteAllNote(token);
  });
  ipcMain.on('deleteAllMessage', async (_, { token }) => {
    _.returnValue = deleteAllMessage(token);
  });
  ipcMain.on('deleteAllPrompt', async (_, { token }) => {
    _.returnValue = deleteAllPrompt(token);
  });
  ipcMain.on('deleteAllQuizProblem', async (_, { token }) => {
    _.returnValue = deleteAllQuizProblem(token);
  });
  ipcMain.on('createBook', async (_, { book, token }) => {
    _.returnValue = createBook(book, token);
  });
  ipcMain.on('getBooks', async (_, { token }) => {
    _.returnValue = getBooks(token);
  });
  ipcMain.on('getBookById', async (_, { bookId, token }) => {
    _.returnValue = getBookById(bookId, token);
  });
  ipcMain.on('getBookByIdFromServer', async (_, { idFromServer, token }) => {
    _.returnValue = getBookByIdFromServer(idFromServer, token);
  });
  ipcMain.on('getBooksByCategory', async (_, { category, token }) => {
    _.returnValue = getBooksByCategory(category, token);
  });
  ipcMain.on('updateBook', async (_, { noteId, field, value, token }) => {
    _.returnValue = updateBook(noteId, field, value, token);
  });
  ipcMain.on('getBooksByBookshelfId', async (_, { bookshelfId, token }) => {
    _.returnValue = getBooksByBookshelfId(bookshelfId, token);
  });
  ipcMain.on('getHistoryGroupById', async (_, { id, token }) => {
    _.returnValue = getHistoryGroupById(id, token);
  });
  ipcMain.on('getHistoryGroupByName', async (_, { name, token }) => {
    _.returnValue = getHistoryGroupByName(name, token);
  });
  ipcMain.on('createHistoryGroup', async (_, { name, token }) => {
    _.returnValue = createHistoryGroup(name, token);
  });
  ipcMain.on(
    'getHistoryGroupByQuery',
    async (_, { query, page, limit, token }) => {
      _.returnValue = getHistoryGroupByQuery(query, page, limit, token);
    },
  );
  ipcMain.on('deleteAllHistoryGroups', async (_, { token }) => {
    _.returnValue = deleteAllHistoryGroups(token);
  });

  ipcMain.on('getHistoryById', async (_, { id, token }) => {
    _.returnValue = getHistoryById(id, token);
  });
  ipcMain.on('createHistory', async (_, { history, token }) => {
    if (history.sourceType === 'url') {
      // const model = store.get('chatgpt-model') || ChatGPTModel.GPT3_5;
      const meta = await createUrlDescription(history.sourceKey);
      history.description = meta.description;
      console.log(` in createHistory, favicon = ${meta.favicon}`);
      if (meta.favicon) {
        const image = await createImage(meta.favicon);
        history.favicon = image.id;
      }
    }
    _.returnValue = createHistory(history, token);
  });
  ipcMain.on(
    'getHistoryByQuery',
    async (_, { sourceType, query, page, limit, token }) => {
      _.returnValue = getHistoryByQuery(sourceType, query, page, limit, token);
    },
  );
  ipcMain.on('getHistoriesByGroupId', async (_, { groupId, token }) => {
    _.returnValue = getHistoriesByGroupId(groupId, token);
  });
  ipcMain.on(
    'getHistoryByGroupIdAndSourceKey',
    async (_, { groupId, sourceKey, token }) => {
      _.returnValue = getHistoryByGroupIdAndSourceKey(
        groupId,
        sourceKey,
        token,
      );
    },
  );
  ipcMain.on('deleteAllHistories', async (_, { token }) => {
    _.returnValue = deleteAllHistories(token);
  });
  ipcMain.on('updateHistory', async (_, { id, description, token }) => {
    _.returnValue = updateHistory(id, description, token);
  });
  ipcMain.on('addContentToInMemoryVectorDB', async (_, { content }) => {
    await chromaManager.addContentToInMemoryVectorDB(content);
    _.returnValue = true;
  });
  ipcMain.on('queryInMemoryVectorDB', async (_, { content }) => {
    try {
      const r = await chromaManager.inMemoryVectorDB.query({
        nResults: 10,
        queryTexts: [content],
      });

      _.returnValue = r && r.documents ? r.documents : [];
    } catch (e) {
      _.returnValue = [];
    }
  });
  ipcMain.on(
    'createBookmarkGroup',
    async (_, { parentGroupId, name, token }) => {
      _.returnValue = createBookmarkGroup(parentGroupId, name, token);
    },
  );
  ipcMain.on('jsonBookmarkGroupStructure', async (_, { token }) => {
    _.returnValue = jsonBookmarkGroupStructure(token);
  });
  ipcMain.on('printBookmarkGroupStructure', async (_, { gapChar, token }) => {
    _.returnValue = printBookmarkGroupStructure(gapChar, token);
  });
  ipcMain.on('getBookmarkGroupByName', async (_, { name, token }) => {
    _.returnValue = getBookmarkGroupByName(name, token);
  });
  ipcMain.on('getBookmarkGroupById', async (_, { id, token }) => {
    _.returnValue = getBookmarkGroupById(id, token);
  });
  ipcMain.on('getTopBookmarkGroup', async (_, { token }) => {
    _.returnValue = getTopBookmarkGroup(token);
  });
  ipcMain.on('renameBookmarkGroup', async (_, { id, name, token }) => {
    _.returnValue = renameBookmarkGroup(id, name, token);
  });
  ipcMain.on('deleteAllBookmarkGroups', async (_, { token }) => {
    _.returnValue = deleteAllBookmarkGroups(token);
  });
  ipcMain.on('createBookshelf', async (_, { name, token }) => {
    _.returnValue = createBookshelf(name, token);
  });
  ipcMain.on('renameBookshelf', async (_, { id, name, token }) => {
    _.returnValue = renameBookshelf(id, name, token);
  });
  ipcMain.on('deleteAllBookshelf', async (_, { token }) => {
    _.returnValue = deleteAllBookshelf(token);
  });
  ipcMain.on('deleteBookshelfById', async (_, { bookshelfId, token }) => {
    _.returnValue = deleteBookshelfById(bookshelfId, token);
  });
  ipcMain.on('getAllBookshelf', async (_, { token }) => {
    _.returnValue = getAllBookshelf(token);
  });
  ipcMain.on('getBookshelfById', async (_, { bookshelfId, token }) => {
    _.returnValue = getBookshelfById(bookshelfId, token);
  });

  ipcMain.on('changeBookshelf', async (_, { bookId, newId, token }) => {
    _.returnValue = changeBookshelf(bookId, newId, token);
  });
  ipcMain.on('getBooksByQuery', async (_, { query, token }) => {
    try {
      const books = getBooksByQuery(query, token);
      // Search ChromaDB for semantic matches (existing behavior)
      if (query.indexOf(' ') > 0 && chromaManager.collection) {
        const r = await chromaManager.getBooksByQuery(store, query, token);
        r.forEach((m) => books.push(m));
      }
      // Also search graph database if available (new - parallel search)
      if (graphInterface.isReady()) {
        const graphBooks = await graphInterface.getBooksByUser(token);
        // Filter by query and merge results, avoiding duplicates by ID
        const existingIds = new Set(
          books.map((b: { id: string | number }) => String(b.id)),
        );
        const queryLower = query.toLowerCase();
        graphBooks.forEach(
          (gb: { id: string | number; title?: string; author?: string }) => {
            if (!existingIds.has(String(gb.id))) {
              // Basic text matching for graph results
              const titleMatch =
                gb.title && gb.title.toLowerCase().includes(queryLower);
              const authorMatch =
                gb.author && gb.author.toLowerCase().includes(queryLower);
              if (titleMatch || authorMatch) {
                books.push(gb);
              }
            }
          },
        );
      }
      _.returnValue = books;
    } catch (e) {
      console.log(e.message ? e.message : e);
      _.returnValue = [];
    }
  });
  ipcMain.on(
    'getBookContentByQuery',
    async (_, { bookKey, bookType, query, token }) => {
      console.log(
        ` bookKey = ${bookKey} bookType = ${bookType} query= ${query} token = ${token}`,
      );
      _.returnValue = await chromaManager.getBookContentByQuery(
        store,
        bookKey,
        bookType,
        query,
        token,
      );
    },
  );
  ipcMain.on('getBookmarksByGroupId', async (_, { groupId, token }) => {
    _.returnValue = getBookmarksByGroupId(groupId, token);
  });
  ipcMain.on(
    'getBookmarksRecursiveByGroupId',
    async (_, { groupId, token }) => {
      _.returnValue = getBookmarksRecursiveByGroupId(groupId, token);
    },
  );
  ipcMain.on('createBookmark', async (_, { url, token }) => {
    const b = await createBookmarkUtils(url, token);
    if (b) {
      try {
        if (typeof b.id !== 'undefined') {
          // Add to ChromaDB vector store (existing behavior)
          await chromaManager.AddBookmarkToVectorDB(store, b, token);
          // Also add to graph database (new - parallel storage)
          if (graphInterface.isReady()) {
            await graphInterface.createBookmark(b, token);
          }
        }
      } catch (e) {
        console.log(e);
      }
      console.log(` main createbookmark = ${JSON.stringify(b)}`);
    }
    _.returnValue = b ?? null;
  });
  ipcMain.on('getBookmarkById', async (_, { id, token }) => {
    _.returnValue = getBookmarkById(id, token);
  });
  ipcMain.on('getBookmarkByQuery', async (_, { query, token }) => {
    _.returnValue = getBookmarkByQuery(query, token);
  });
  ipcMain.on(
    'getBookmarksBySourceKey',
    async (_, { sourceKey, sourceType, token }) => {
      _.returnValue = getBookmarksBySourceKey(sourceKey, sourceType, token);
    },
  );
  ipcMain.on('updateBookmark', async (_, { noteId, field, value, token }) => {
    _.returnValue = updateBookmark(noteId, field, value, token);
  });

  ipcMain.on('createChat', async (_, { chat, token }) => {
    const c = createChat(chat, token);
    // Also add to graph database (new - parallel storage)
    try {
      if (graphInterface.isReady() && c && typeof c.id !== 'undefined') {
        await graphInterface.createChat(chat, token);
      }
    } catch (graphError) {
      console.error('Failed to add chat to graph:', graphError);
    }
    _.returnValue = c;
  });
  ipcMain.on('getChatById', async (_, { id, token }) => {
    _.returnValue = getChatById(id, token);
  });
  ipcMain.on('getPinnedChats', async (_, { token }) => {
    _.returnValue = getPinnedChats(token);
  });
  ipcMain.on('getPinnedLearnAbout', async (_, { token }) => {
    _.returnValue = getPinnedLearnAbout(token);
  });

  ipcMain.on(
    'getLearnAboutByQuery',
    async (_, { query, page, limit, token }) => {
      _.returnValue = getLearnAboutByQuery(query, page, limit, token);
    },
  );

  ipcMain.on('getChatsByQuery', async (_, { query, page, limit, token }) => {
    _.returnValue = getChatsByQuery(query, page, limit, token);
  });
  ipcMain.on('updateChat', async (_, { id, field, value, token }) => {
    _.returnValue = updateChat(id, field, value, token);
  });
  ipcMain.on('createMoodBoard', async (_, { moodBoard, token }) => {
    _.returnValue = createMoodBoard(moodBoard, token);
  });
  ipcMain.on('updateMoodBoard', async (_, { id, field, value, token }) => {
    _.returnValue = updateMoodBoard(id, field, value, token);
  });
  ipcMain.on('getMoodBoardById', async (_, { id, token }) => {
    _.returnValue = getMoodBoardById(id, token);
  });
  ipcMain.on(
    'getMoodBoardsByQuery',
    async (_, { query, page, limit, token }) => {
      _.returnValue = getMoodBoardsByQuery(query, page, limit, token);
    },
  );

  ipcMain.on('createImage', async (_, { image }) => {
    _.returnValue = createImage(image);
  });
  ipcMain.on('getImage', async (_, { id }) => {
    _.returnValue = getImage(id);
  });
  ipcMain.on('createMessage', async (_, { message, token }) => {
    // console.log(`main message = ${JSON.stringify(message)}`);
    const m = createMessage(message, token);
    // Also add to graph database (new - parallel storage)
    try {
      if (
        graphInterface.isReady() &&
        m &&
        typeof m.id !== 'undefined' &&
        message.chatId
      ) {
        await graphInterface.addMessage(message, message.chatId, token);
      }
    } catch (graphError) {
      console.error('Failed to add message to graph:', graphError);
    }
    _.returnValue = m;
  });
  ipcMain.on('getMessageById', async (_, { id, token }) => {
    _.returnValue = getMessageById(id, token);
  });
  ipcMain.on('getMessageByQuery', async (_, { query, token }) => {
    try {
      const messages = getMessageByQuery(query, token);
      // Search ChromaDB for semantic matches (existing behavior)
      if (query.indexOf(' ') > 0 && chromaManager.collection) {
        const r = await chromaManager.getMessageByQuery(store, query, token);
        r.forEach((m) => messages.push(m));
      }
      // Also search graph database if available (new - parallel search)
      if (graphInterface.isReady()) {
        const graphMessages = await graphInterface.searchMessages(query, token);
        // Merge results avoiding duplicates by ID
        const existingIds = new Set(
          messages.map((m: { id: string | number }) => String(m.id)),
        );
        graphMessages.forEach((gm: { id: string | number }) => {
          if (!existingIds.has(String(gm.id))) {
            messages.push(gm);
          }
        });
      }
      _.returnValue = messages;
    } catch (e) {
      console.log(e.message ? e.message : e);
      _.returnValue = false;
    }
  });
  ipcMain.on('getMessagesByChatId', async (_, { id, token }) => {
    _.returnValue = getMessagesByChatId(id, token);
  });
  ipcMain.on('updateMessage', async (_, { id, field, value, token }) => {
    _.returnValue = updateMessage(id, field, value, token);
  });
  ipcMain.on('createNote', async (_, { note, token }) => {
    const n = createNote(note, token);
    try {
      if (typeof n.id !== 'undefined') {
        // Add to ChromaDB vector store (existing behavior)
        await chromaManager.addNodeToVecterDB(store, note, token);
        // Also add to graph database (new - parallel storage)
        if (graphInterface.isReady()) {
          await graphInterface.createNote(note, token);
        }
      }
    } catch (e) {
      console.error('Failed to add note to vector/graph store:', e);
    }
    _.returnValue = n;
  });
  ipcMain.on('getNotesByIds', async (_, { ids, token }) => {
    _.returnValue = getNotesByIds(ids, token);
  });
  ipcMain.on('getNoteById', async (_, { id, token }) => {
    _.returnValue = getNoteById(id, token);
  });
  ipcMain.on(
    'queryNoteBySourceKeyAndSourceType',
    async (_, { sourceKey, sourceType, token }) => {
      _.returnValue = queryNoteBySourceKeyAndSourceType(
        sourceKey,
        sourceType,
        token,
      );
    },
  );
  ipcMain.on(
    'getNotesByDueReview',
    async (_, { dueTime, page, limit, token }) => {
      _.returnValue = getNotesByDueReview(dueTime, page, limit, token);
    },
  );
  ipcMain.on(
    'getNotesByQuery',
    async (_, { query, tag, star, page, limit, token }) => {
      const notes = getNotesByQuery(query, tag, star, page, limit, token);
      try {
        // Search ChromaDB for semantic matches (existing behavior)
        if (query.indexOf(' ') > 0 && chromaManager.collection) {
          const r = await chromaManager.getNotesByQuery(
            store,
            query,
            tag,
            star,
            page,
            limit,
            token,
          );
          r.forEach((m) => notes.data.push(m));
        }
        // Also search graph database if available (new - parallel search)
        if (graphInterface.isReady()) {
          const graphNotes = await graphInterface.searchNotes(query, token);
          // Merge results, avoiding duplicates by ID
          const existingIds = new Set(
            notes.data.map((n: { id: string | number }) => String(n.id)),
          );
          graphNotes.forEach((gn: { id: string | number }) => {
            if (!existingIds.has(String(gn.id))) {
              notes.data.push(gn);
            }
          });
        }
      } catch (e) {
        console.log(e.message ? e.message : e);
      }

      _.returnValue = notes;
    },
  );
  ipcMain.on('updateNote', async (_, { noteId, field, value, token }) => {
    const result = updateNote(noteId, field, value, token);
    // Sync to graph database if enabled
    if (result && graphInterface.isReady()) {
      try {
        const note = getNoteById(noteId, token);
        if (note) {
          await graphInterface.syncNote(note, token);
        }
      } catch (e) {
        console.error('Failed to sync note update to graph:', e);
      }
    }
    _.returnValue = result;
  });

  ipcMain.on('clearNotesBy', async (_, { sourceKey, sourceType, token }) => {
    _.returnValue = deleteNoteBySourceKeyAndSourceType(
      sourceKey,
      sourceType,
      token,
    );
  });
  ipcMain.on('replaceNote', async (_, { noteId, note, token }) => {
    const result = replaceNote(noteId, note, token);
    // Sync to graph database if enabled
    if (result && graphInterface.isReady()) {
      try {
        await graphInterface.syncNote(result, token);
      } catch (e) {
        console.error('Failed to sync note replacement to graph:', e);
      }
    }
    _.returnValue = result;
  });
  ipcMain.on(
    'updateNoteCard',
    async (_, { noteId, cardIndex, field, value, token }) => {
      const result = updateNoteCard(noteId, cardIndex, field, value, token);
      // Sync to graph database if enabled
      if (result && graphInterface.isReady()) {
        try {
          const note = getNoteById(noteId, token);
          if (note) {
            await graphInterface.syncNote(note, token);
          }
        } catch (e) {
          console.error('Failed to sync note card update to graph:', e);
        }
      }
      _.returnValue = result;
    },
  );

  ipcMain.on('createPrompt', async (_, { prompt, token }) => {
    _.returnValue = createPrompt(prompt, token);
  });
  ipcMain.on('getPromptById', async (_, { id, token }) => {
    _.returnValue = getPromptById(id, token);
  });
  ipcMain.on('getPromptsByQuery', async (_, { query, page, limit, token }) => {
    _.returnValue = getPromptsByQuery(query, page, limit, token);
  });
  ipcMain.on('getPromptsBySource', async (_, { source, token }) => {
    _.returnValue = getPromptsBySource(source, token);
  });
  ipcMain.on('updatePrompt', async (_, { id, field, value, token }) => {
    _.returnValue = updatePrompt(id, field, value, token);
  });
  ipcMain.on('createQuizProblem', async (_, { quizProblem, token }) => {
    _.returnValue = createQuizProblem(quizProblem, token);
  });
  ipcMain.on('getQuizProblemById', async (_, { id, token }) => {
    _.returnValue = getQuizProblemById(id, token);
  });
  ipcMain.on(
    'getQuizProblemByQuery',
    async (_, { query, page, limit, token }) => {
      _.returnValue = getQuizProblemByQuery(query, page, limit, token);
    },
  );
  ipcMain.on(
    'getQuizProblemBySourceKeyAndSourceType',
    async (_, { sourceKey, sourceType, token }) => {
      _.returnValue = getQuizProblemBySourceKeyAndSourceType(
        sourceKey,
        sourceType,
        token,
      );
    },
  );
  ipcMain.on('updateQuizProblem', async (_, { id, field, value, token }) => {
    _.returnValue = updateQuizProblem(id, field, value, token);
  });

  ipcMain.on('getLeitnerItemById', async (_, { id }) => {
    _.returnValue = getLeitnerItemById(id);
  });
  ipcMain.on('createLeitnerItem', async (_, { leitnerItem }) => {
    _.returnValue = createLeitnerItem(leitnerItem);
  });
  ipcMain.on('updateLeitnerItem', async (_, { id, field, value }) => {
    _.returnValue = updateLeitnerItem(id, field, value);
  });
  ipcMain.on('deleteLeitnerItemById', async (_, { id }) => {
    _.returnValue = deleteLeitnerItemById(id);
  });

  /// //////// vocabulary and vocabulary_set ////////////////
  ipcMain.on('getVocabularyById', async (_, { id, token }) => {
    _.returnValue = getVocabularyById(id, token);
  });
  ipcMain.on('getVocabularyByName', async (_, { name, token }) => {
    _.returnValue = getVocabularyByName(name, token);
  });
  ipcMain.on('createVocabulary', async (_, { vocabulary, token }) => {
    _.returnValue = createVocabulary(vocabulary, token);
  });
  ipcMain.on('getVocabulariesBySetId', async (_, { setId, token }) => {
    _.returnValue = getVocabulariesBySetId(setId, token);
  });
  ipcMain.on(
    'getVocabulariesByDueReview',
    async (_, { dueTime, page, limit, token }) => {
      _.returnValue = getVocabulariesByDueReview(dueTime, page, limit, token);
    },
  );
  ipcMain.on(
    'getVocabulariesByQuery',
    async (_, { query, page, limit, token }) => {
      _.returnValue = getVocabulariesByQuery(query, page, limit, token);
    },
  );
  ipcMain.on('updateVocabulary', async (_, { id, field, value, token }) => {
    _.returnValue = updateVocabulary(id, field, value, token);
  });
  ipcMain.on('deleteVocabularyById', async (_, { id, token }) => {
    _.returnValue = deleteVocabularyById(id, token);
  });
  ipcMain.on('deleteAllVocabulary', async (_, { token }) => {
    _.returnValue = deleteAllVocabulary(token);
  });
  ipcMain.on('addVocabularyToSet', async (_, { id, setId, token }) => {
    _.returnValue = addVocabularyToSet(id, setId, token);
  });
  /// ///  vocabulary set
  ipcMain.on('getVocabularySetById', async (_, { id, token }) => {
    _.returnValue = getVocabularySetById(id, token);
  });
  ipcMain.on('createVocabularySet', async (_, { vocabularySet, token }) => {
    _.returnValue = createVocabularySet(vocabularySet, token);
  });
  ipcMain.on(
    'getVocabularySetByQuery',
    async (_, { query, page, limit, token }) => {
      _.returnValue = getVocabularySetByQuery(query, page, limit, token);
    },
  );
  ipcMain.on('updateVocabularySetByTime', async (_, { id, token }) => {
    _.returnValue = updateVocabularySetByTime(id, token);
  });
  ipcMain.on('updateVocabularySet', async (_, { id, field, value, token }) => {
    _.returnValue = updateVocabularySet(id, field, value, token);
  });
  ipcMain.on('deleteVocabularySetById', async (_, { id, token }) => {
    _.returnValue = deleteVocabularySetById(id, token);
  });
  ipcMain.on('deleteAllVocabularySet', async (_, { token }) => {
    _.returnValue = deleteAllVocabularySet(token);
  });

  ipcMain.handle('ollama:stream', async (event, { history, message }) => {
    const ollama = new Ollama({ host: 'http://127.0.0.1:11434' });
    const messages = history || [];

    if (message) messages.push(message);
    console.log(`ollama:stream ${JSON.stringify(messages)}`);

    const model = aiProviderManager.getCurrentModel() || OllamaModel.LLAMA_3_8b;
    const response = await ollama.chat({
      model,
      messages,
      stream: true,
    });
    for await (const part of response) {
      console.log(part.message.content);
      event.sender.send('ollama:stream:data', part.message.content);
    }
    // Indicate the stream is finished
    event.sender.send('ollama:stream:done');
  });
  /** delegate to ollama */
  ipcMain.on('generateContent', async (_, { prompt }) => {
    const r = await aiProviderManager.generateContent(prompt);
    _.returnValue = r;
  });
  ipcMain.on('sendChatMessage', async (_, { history, message }) => {
    const r = await aiProviderManager.sendChatMessage(history, message);
    console.log(`sendChatMessage ${JSON.stringify(r)}`);
    _.returnValue = r;
  });

  ipcMain.on('fetchPageHeadless', async (_, { url }) => {
    const r = await fetchPageHeadless(url);
    _.returnValue = r;
  });
  /**  related to vector database  */
  // response = { ids:[] documents:[]}
  ipcMain.on('semanticQuery', async (_, query, nResults, condition) => {
    if (!chromaManager.collection) {
      _.returnValue = [];
      return;
    }
    try {
      if (condition) {
        const r = await chromaManager.collection.query({
          nResults: nResults || 10,
          where: condition,
          queryTexts: [query],
        });
        _.returnValue = r;
      } else {
        const r = await chromaManager.collection.query({
          nResults: nResults || 10,
          queryTexts: [query],
        });
        _.returnValue = r;
      }
    } catch (e) {
      console.log(e.message ? e.message : e);
      _.returnValue = { ids: [], documents: [] };
    }
  });
  ipcMain.handle('add-data-to-vectordb', (_, data) => {
    if (!chromaManager.collection) {
      return { ids: [], documents: [] };
    }
    try {
      const { id, source, doc } = data;
      return chromaManager.collection.add({
        ids: [id.toString()],
        metadatas: [{ source: String(source) }],
        documents: [doc],
      });
    } catch (e) {
      console.log(e.message ? e.message : e);
      return { ids: [], documents: [] };
    }
  });
  ipcMain.handle('query-vectordb', (_, data) => {
    if (!chromaManager.collection) {
      return { ids: [], documents: [] };
    }
    try {
      const { query, nResults, condition } = data;
      if (condition)
        return chromaManager.collection.query({
          nResults,
          where: condition, // where
          queryTexts: [query], // query_text
        });
      return chromaManager.collection.query({
        nResults,
        queryTexts: [query], // query_text
      });
    } catch (e) {
      console.log(e.message ? e.message : e);
      return { ids: [], documents: [] };
    }
  });

  /** helper function */
  /** file system related */

  ipcMain.handle('parse-markdown', (event, data) => {
    const d = data ? markdownManager.markdown2html(data) : '';
    console.log(d);
    return d;
    // .then((result) => { return result; })
  });
  ipcMain.handle('storageLocation', () => {
    return global.shared.storageLocation;
    // .then((result) => { return result; })
  });

  ipcMain.handle('is-book-exist', (event, data) => {
    //
    const { id, path } = data;
    return BookUtil.isBookExist(id, path);
  });
  ipcMain.handle('system-color', (event, arg) => {
    return nativeTheme.shouldUseDarkColors || false;
  });
  ipcMain.handle('dirname', () => {
    return global.shared.dirname;
  });
  ipcMain.handle('app-mode', () => {
    return app.isPackaged ? 'production' : 'development';
  });

  ipcMain.on('getServerUrl', (_) => {
    const url = store.get('server_url');
    _.returnValue = url || '';
  });

  ipcMain.on('setServerUrl', (_, url) => {
    store.set('server_url', url);
    _.returnValue = true;
  });

  ipcMain.on('getChromaUrl', (_) => {
    const url = store.get('chroma_url');
    _.returnValue = url || 'http://127.0.0.1:8000';
  });

  ipcMain.on('setChromaUrl', (_, url) => {
    store.set('chroma_url', url);
    _.returnValue = true;
  });

  ipcMain.on('getOllamaUrl', (_) => {
    const url = store.get('ollama_url');
    _.returnValue = url || 'http://127.0.0.1:11434';
  });

  ipcMain.on('setOllamaUrl', (_, url) => {
    store.set('ollama_url', url);
    _.returnValue = true;
  });

  ipcMain.on('storage-location', (event, arg) => {
    event.returnValue = global.shared.storageLocation;
  });

  ipcMain.handle('get-file-data', (event, arg) => {
    try {
      const { storageLocation } = global.shared;
      console.log(storageLocation);
      // console.log(`filePath1 = ${filePath}`);
      if (fs.existsSync(path.join(storageLocation, 'log.json'))) {
        const pdata = JSON5.parse(
          fs.readFileSync(path.join(storageLocation, 'log.json'), 'utf-8') ||
            '{}',
        );
        if (pdata && pdata.filePath) {
          filePath = pdata.filePath;
          fs.writeFileSync(path.join(storageLocation, 'log.json'), '', 'utf-8');
        }
      }
      console.log(`filePath2 = ${filePath}`);
      const returnValue = filePath;
      filePath = null;
      return returnValue;
    } catch (e) {
      console.log(e.message ? e.message : e);
      return false;
    }
  });

  //

  ipcMain.handle('setup-file-dir', (event, data) => {
    const dirPath = global.shared.storageLocation; // ipcRenderer.sendSync('user-data', 'ping');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      // fs.mkdirSync(path.join(dirPath, 'data'));
      fs.mkdirSync(path.join(dirPath, 'book'));
      console.log('文件夹创建成功');
    } else {
      console.log('文件夹已存在');
    }
    return new Promise((resolve, reject) => {
      async function storageLoc() {
        // Check for data update
        const { storageLocation } = global.shared;
        // v || window.electron.ipcRenderer.sendSync('storage-location', 'ping');
        const sourcePath = path.join(
          storageLocation,
          'config',
          'readerConfig.json',
        );
        // Detect data modification
        fs.readFile(sourcePath, 'utf8', async (err, data) => {
          if (err) {
            console.log(err);
            resolve(false);
            return;
          }
          const readerConfig = JSON5.parse(data);
          const st1 = store.get('lastSyncTime') as string;
          if (st1 && parseInt(readerConfig.lastSyncTime) > parseInt(st1)) {
            resolve(true); // setIsdataChange(  true  );
          } else {
            resolve(false);
          }
        });
      }
      storageLoc();
    });
  });

  /**  export & import  */

  ipcMain.handle('fetch-book', (event, data) => {
    try {
      const { id, isArrayBuffer, bookPath } = data;
      return BookUtil.fetchBook(id, isArrayBuffer, bookPath);
    } catch (e) {
      console.log(e.message ? e.message : e);
      return false;
    }
  });

  ipcMain.handle('import-keywords-from-file', async (event, data) => {
    try {
      console.log('in ipcMain -- import-keywords');
      const { studyMode } = data;
      const ws = await BookUtil.importJsonTextFile(mainWin, false);
      if (ws) {
        console.log(typeof ws);
        const stemmer = natural.PorterStemmer;
        const wordList = ws
          .split('\n')
          .filter((n) => n && n.length > 0)
          .map((n) => stemmer.stem(n.trim()));
        store.set(`keywords_${studyMode}`, wordList);
      }
      return true;
    } catch (e) {
      console.log(e.message ? e.message : e);
      return false;
    }
  });
  ipcMain.handle('import-word-frequency-from-file', async (event, data) => {
    try {
      console.log('in ipcMain -- import-word-frequency');
      const json = await BookUtil.importJsonTextFile(mainWin, true);
      if (json) {
        console.log('in ipcMain -- ');
        console.log(JSON.stringify(json));
        store.set('word_colors', json);
      }
      return true;
    } catch (e) {
      console.log(e.message ? e.message : e);
      return false;
    }
  });
  ipcMain.handle('import-book-from-file', async (event, { token }) => {
    try {
      console.log('in ipcMain -- import-file');
      const b = await BookUtil.importBookFromFile(
        mainWin,
        libreOfficeInstalled,
      );
      const book = await createBook(b, token);
      // Add to ChromaDB vector store (existing behavior)
      await chromaManager.addBookToVecterDB(
        store,
        mainWin,
        event.sender,
        book,
        token,
      );
      // Also add to graph database (new - parallel storage)
      try {
        if (graphInterface.isReady()) {
          await graphInterface.createBook(book, token);
        }
      } catch (graphError) {
        console.error('Failed to add book to graph:', graphError);
      }
      return book;
    } catch (e) {
      console.log(e.message ? e.message : e);
      return false;
    }
  });
  ipcMain.handle('import-image-from-file', async (event, { token }) => {
    try {
      console.log('in ipcMain -- import-image');
      const b = await BookUtil.importImageBase64FromFile(mainWin);
      if (!b) return b;
      return b.startsWith('data:') ? b : `data:image/jpeg;base64,${b}`;
    } catch (e) {
      console.log(e.message ? e.message : e);
      return false;
    }
  });
  ipcMain.handle(
    'import-book-from-server',
    async (event, { bookFromServer, token }) => {
      try {
        console.log('in ipcMain -- import-file-from-server');
        const b = await BookUtil.importBookFromServer(bookFromServer);
        console.log(JSON.stringify(b));
        const book = await createBook(b, token);
        console.log(JSON.stringify(book));
        // Add to ChromaDB vector store (existing behavior)
        await chromaManager.addBookToVecterDB(
          store,
          mainWin,
          event.sender,
          book,
          token,
        );
        // Also add to graph database (new - parallel storage)
        try {
          if (graphInterface.isReady()) {
            await graphInterface.createBook(book, token);
          }
        } catch (graphError) {
          console.error('Failed to add book to graph:', graphError);
        }
        return book;
      } catch (e) {
        console.log(e.message ? e.message : e);
        return false;
      }
    },
  );

  ipcMain.handle('capture-webview', (event, data) => {
    try {
      const { webviewWebContentsId } = data;
      const webviewWebContents = webContents.fromId(webviewWebContentsId);
      async function t() {
        if (!webviewWebContents) {
          console.log('not found webview webcontent');
          return null;
        }
        const image = await webviewWebContents.capturePage();
        console.log('image loaded');
        console.log(image.toDataURL());
        const r = await createImage(image.toDataURL());
        // store.set(`_img_${imageId}`, image.toDataURL());
        return r === null ? -1 : r.id;
      }
      return t();
    } catch (e) {
      console.log(e.message ? e.message : e);
      return false;
    }
  });

  /**
   * return image id.
   */
  ipcMain.handle('capture-page', (event, arg) => {
    async function t() {
      const win = BrowserWindow.getFocusedWindow();
      if (!win) return null;
      const image = await win.webContents.capturePage();

      const r = await createImage(image.toDataURL());
      // store.set(`_img_${imageId}`, image.toDataURL());
      return r === null ? -1 : r.id;
    }
    try {
      return t();
    } catch (e) {
      console.log(e.message ? e.message : e);
      return false;
    }
  });

  /**
   * return image data
   */
  ipcMain.handle('capture-area', (event, { x, y, width, height }) => {
    console.log(`${x} ${y} ${width} ${height}`);
    async function t() {
      const win = BrowserWindow.getFocusedWindow();
      if (!win) return null;
      const image = await win.webContents.capturePage({ x, y, width, height });
      const r = image.toDataURL();
      console.log(r);
      return r;
    }
    try {
      return t();
    } catch (e) {
      console.log(e.message ? e.message : e);
      return false;
    }
  });
  ipcMain.on('show-context-menu-from-word', (event, { selectedText, x, y }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const menu = new Menu();
    menu.append(
      new MenuItem({
        label: 'Save for Study',
        icon: noteIcon,
        click: () => {
          // Send a message back to the renderer process
          win?.webContents.send('context-menu-command', {
            command: 'addToWordList',
            selectedText,
          });
        },
      }),
    );
    menu.popup({ window: win, x, y });
  });
  ipcMain.on(
    'show-context-menu-from-selection',
    (event, { selectedText, x, y }) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      console.log(` show-context-menu-from-selection `);
      const menu = new Menu();
      menu.append(
        new MenuItem({
          label: 'Copy',
          icon: copyIcon,
          click: () => {
            clipboard.writeText(selectedText);
          },
        }),
      );
      menu.append(
        new MenuItem({
          label: 'Read Aloud',
          icon: speakerIcon,
          click: async () => {
            const f = await ttsManager.speakTextBySayImp(selectedText);
            if (f) return;
            // Send a message back to the renderer process
            win?.webContents.send('context-menu-command', {
              command: 'tts-for-selection',
              selectedText,
            });
          },
        }),
      );

      menu.append(
        new MenuItem({
          icon: noteIcon,
          label: 'Create Card',
          click: () => {
            // Send a message back to the renderer process
            win?.webContents.send('context-menu-command', {
              command: 'createCard',
              selectedText,
            });
          },
        }),
      );
      menu.append(
        new MenuItem({
          icon: chatIcon,
          label: 'Slide Show',
          click: () => {
            // Send a message back to the renderer process
            win?.webContents.send('context-menu-command', {
              command: 'presentation',
              selectedText,
            });
          },
        }),
      );
      menu.popup({ window: win, x, y });
    },
  );

  ipcMain.on('show-context-menu-regular', (event, { content, x, y }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const menu = new Menu();
    menu.append(
      new MenuItem({
        icon: reactIcon,
        label: 'Screenshot',
        click: () => {
          // Send a message back to the renderer process
          win?.webContents.send('browser-use-area-selection', {
            command: 'Screenshot',
            content,
          });
        },
      }),
    );
    menu.popup({ window: win, x, y });
  });

  ipcMain.on('show-image-context-menu', (event, { imageUrl, x, y }) => {
    const menu = new Menu();
    menu.append(
      new MenuItem({
        icon: reactIcon,
        label: 'Custom Action for Image',
        click: () => {
          console.log('Image action clicked', imageUrl);
          // Perform any action here, such as opening the image in a default browser, saving it, etc.
        },
      }),
    );

    const win = BrowserWindow.fromWebContents(event.sender);
    menu.popup({ window: win, x, y });
  });

  ipcMain.handle('open-book', (event, config) => {
    try {
      openBook(config);
      return 'success';
    } catch (e) {
      console.log(e.message ? e.message : e);
      return false;
    }
  });

  ipcMain.on('speak-text-by-say', async (_, { text }) => {
    console.log('enter speak-text-by-say');

    try {
      const r = await ttsManager.speakTextBySayImp(text);
      _.returnValue = r;
    } catch (error) {
      console.error(error);
      _.returnValue = false;
    }
  });

  ipcMain.on('ipc-example', async (event, arg) => {
    const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
    console.log(msgTemplate(arg));
    console.log(`storageLocation = ${global.shared.storageLocation}`);
    event.reply('ipc-example', msgTemplate('pong'));
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up Learning Brain on quit
app.on('will-quit', async () => {
  try {
    await shutdownLearningBrain();
    console.log('[main] Learning Brain shutdown complete');
  } catch (err) {
    console.error('[main] Learning Brain shutdown error:', err);
  }
});

app
  .whenReady()
  .then(async () => {
    createWindow();

    // Initialize GraphInterface (Kùzu embedded by default, no external server required)
    try {
      // Default to Kùzu - embedded database, MIT license, no external server needed
      const graphConfig = store.get('graph', { enabled: true, adapterType: 'kuzu' });
      if (graphConfig.enabled) {
        const adapterType = graphConfig.adapterType || 'kuzu';
        await graphInterface.initialize(adapterType, store);
        const status = graphInterface.getStatus();
        console.log(`[main] GraphInterface initialized with ${adapterType}:`, {
          connected: status.connected,
          dbPath: status.dbPath,
          capabilities: Object.keys(status.capabilities).filter(k => status.capabilities[k]),
        });
      } else {
        console.log('[main] GraphInterface disabled in settings');
      }
    } catch (error) {
      console.error('[main] GraphInterface initialization failed:', error);
      // Continue app startup - graph features will be unavailable but app works
      console.log('[main] App will continue without graph database features');
    }

    // Register graph database IPC handlers (works with both Kùzu and Neo4j)
    registerGraphHandlers(store);

    // Phase 3d + 4a: micro-card proposer and batch enrichment IPC handlers
    registerMicroCardHandlers();
    registerEnrichmentHandlers();
    // Phase 5: pre-book diagnostic IPC handlers
    registerBookDiagnosticHandlers();
    // Phase 6: chapter-end comprehension grading IPC handlers
    registerComprehensionHandlers();
    // Phase 7: cross-book curriculum planner IPC handlers
    registerLearningPathPlannerHandlers();
    // Phase 8: spaced re-reading queue IPC handlers
    registerRereadQueueHandlers(store);
    // Phase 8: MoodBoard organize-suggestion IPC handlers (renderer side
    // of the brain heartbeat's `suggestOrganizeSessions` task).
    registerMoodBoardOrganizerHandlers(store);
    // Phase 8: production-prompt IPC handlers (renderer side of the brain
    // heartbeat's `schedulePromptForProduction` task).
    registerProductionPromptHandlers(store);

    // Register skill-based AI IPC handlers
    registerSkillHandlers(store, {
      graphApi: graphInterface,
      aiProvider: aiProviderManager,
    });

    // Register AI Learning Companion IPC handlers
    registerLearningHandlers(store, {
      aiProvider: aiProviderManager,
    });

    // Register notification system IPC handlers
    registerNotificationHandlers(store);

    // Register adaptive spaced repetition IPC handlers
    registerSpacedRepetitionHandlers();

    // Register learning plan wizard IPC handlers
    registerLearningPlanHandlers(store, {
      dbManager: {
        learningPlanManager: require('./db/LearningPlanManager').default,
        bookManager: require('./db/BookManager').default,
        vocabularyManager: require('./db/VocabularyManager').default,
      },
      aiProvider: aiProviderManager,
      graphInterface: graphInterface,
    });

    // Register study session enhancement IPC handlers (hints, sounds, caching)
    registerStudyEnhancementHandlers(store, {
      aiProvider: aiProviderManager,
    });

    // Register study analytics IPC handlers (performance tracking, insights)
    registerStudyAnalyticsHandlers(store, {
      aiProvider: aiProviderManager,
    });

    // Register unified learning IPC handlers (single API for vocabulary, notes, plans)
    registerUnifiedLearningHandlers();

    // Register learning point IPC handlers (unified learning_point table)
    registerLearningPointHandlers();

    // Brain-driven shell (Plan 1): TriggerEmitter ships Triggers to the
    // renderer via mainWin.webContents. Lazy getter so it tolerates the
    // (rare) case where the brain initializes before the window is ready.
    const triggerEmitter = new TriggerEmitter({
      getWebContents: () => mainWin?.webContents ?? null,
    });

    // Initialize Learning Brain and register IPC handlers
    initializeLearningBrain({
      store,
      aiProvider: aiProviderManager,
      neo4jAdapter: graphInterface,
      // Existing skills will be loaded if available
      adaptiveLearningSkill: null, // Will be injected by skill system
      learningGraphSkill: null,
      learnerProfileManager: require('./db/LearnerProfileManager'),
      learningPlanManager: require('./db/LearningPlanManager').default,
      sessionAnalyticsManager: require('./db/SessionAnalyticsManager').default,
      triggerEmitter,
    })
      .then((brain) => {
        if (brain) {
          registerBrainHandlers({ brain, store });
          registerTriggerBusHandlers({ brain });
          console.log('[main] Learning Brain initialized successfully');
        } else {
          // Brain disabled or failed - still register handlers for status queries
          registerBrainHandlers({ brain: null, store });
          registerTriggerBusHandlers({ brain: null });
          console.log('[main] Learning Brain disabled or unavailable');
        }
      })
      .catch((err) => {
        console.error('[main] Learning Brain initialization failed:', err);
        registerBrainHandlers({ brain: null, store });
        registerTriggerBusHandlers({ brain: null });
      });

    // copy resource / script ..
    const dataPath = store.get('storageLocation') as string;
    const outPath = path.join(dataPath, `script`);
    try {
      if (!fs.existsSync(outPath)) {
        fs.mkdirSync(outPath);
        const p = path.dirname(__dirname);
        console.log(`dirname = ${p}`);
        const p2 = path.join(p, 'script');
        fs.readdirSync(p2).map((fileName) => {
          const pin = path.join(p2, fileName);
          const pout = path.join(outPath, fileName);
          fs.copyFile(pin, pout, (err) => {
            if (err) console.log('Error Found:', err);
          });
        });
      }
    } catch (err) {
      console.error(err);
    }

    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWin === null) createWindow();
    });
    app.on('open-file', (e, pathToFile) => {
      filePath = pathToFile;
    });
  })
  .catch(console.log);
