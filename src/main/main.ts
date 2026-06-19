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
  DeepSeekModel,
} from '../commons/model/DataTypes';

import { getUserIdFromToken } from './db/dbManager';
import { login, register, ensureUserSchema } from './db/PersonManager';
import {
  createBook,
  getBookById,
  getBookByIdFromServer,
  getBooks,
  getBooksByQuery,
  getBooksByBookshelfId,
  getBooksByCategory,
  updateBook,
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
  deleteMessageByChatId,
} from './db/MessageManager';
import {
  createPrompt,
  getPromptById,
  getPromptsByQuery,
  getPromptsBySource,
  updatePrompt,
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
  getBookmarkGroupByName,
  printBookmarkGroupStructure,
  jsonBookmarkGroupStructure,
  renameBookmarkGroup,
} from './db/BookmarkGroupManager';
import {
  updateBookmark,
  deleteBookmarkById,
  getBookmarksBySourceKey,
  getBookmarkByQuery,
  getBookmarksByGroupId,
  getBookmarksRecursiveByGroupId,
} from './db/BookmarkManager';
import {
  getVocabularyByName,
  createVocabulary,
  getVocabulariesBySetId,
  getVocabulariesByQuery,
  getVocabulariesByDueReview,
  updateVocabulary,
  addVocabularyToSet,
} from './db/VocabularyManager';
import {
  createVocabularySet,
  getVocabularySetByQuery,
} from './db/VocabularySetManager';
import {
  createHistoryGroup,
  getHistoryGroupByQuery,
} from './db/HistoryGroupManager';
import {
  createHistory,
  getHistoryByQuery,
  getHistoriesByGroupId,
  getHistoryByGroupIdAndSourceKey,
  updateHistory,
} from './db/HistoryManager';


import createBookmarkUtils, {
  createUrlDescription,
} from './utils/createBookmarkUtils';
import initialDatabase from './db/DatabaseInitializer';
import { createVocabularyPrompt } from '../commons/utils/AIPrompts';

import { instanceInMain as aiProviderManager } from '../commons/service/AIProviderManager';
import checkLibreOfficeInstalled from './utils/checkLibreOfficeInstalled';

import getBaiduAccessToken from './utils/baiduUtil';
import markdownManager from './utils/MarkdownManager';
import graphEmbeddingManager from './utils/GraphEmbeddingManager';
import vectorManager from './utils/VectorManager';
import { buildEmbeddingFunction } from './utils/EmbeddingService';
import { indexBookWithProgress } from './utils/BookIndexer';
import registerGraphHandlers from './ipc/graphHandlers';
import {
  registerSkillHandlers,
  updateSkillServices,
} from './ipc/skillHandlers';
import { registerLearningHandlers } from './ipc/learningHandlers';
import { registerNotificationHandlers } from './ipc/notificationHandlers';
import { registerSpacedRepetitionHandlers } from './ipc/spacedRepetitionHandlers';
import { registerLearningPlanHandlers } from './ipc/learningPlanHandlers';
import { registerStudyEnhancementHandlers } from './ipc/studyEnhancementHandlers';
import { registerStudyAnalyticsHandlers } from './ipc/studyAnalyticsHandlers';
import { registerBrainHandlers } from './ipc/brainHandlers';
import { registerUnifiedLearningHandlers } from './ipc/unifiedLearningHandlers';
import { registerLearningPointHandlers } from './ipc/learningPointHandlers';
import { registerMicroCardHandlers } from './ipc/microCardHandlers';
import { registerEnrichmentHandlers } from './ipc/enrichmentHandlers';
import { registerVocabMirrorHandlers } from './ipc/vocabMirrorHandlers';
import { registerArgumentXrayHandlers } from './ipc/argumentXrayHandlers';
import { registerBookDiagnosticHandlers } from './ipc/bookDiagnosticHandlers';
import { registerComprehensionHandlers } from './ipc/comprehensionHandlers';
import { registerRereadQueueHandlers } from './ipc/rereadQueueHandlers';
import { registerMoodBoardOrganizerHandlers } from './ipc/moodBoardOrganizerHandlers';
import { registerProductionPromptHandlers } from './ipc/productionPromptHandlers';
import { registerLearningPathPlannerHandlers } from './ipc/learningPathPlannerHandlers';
import graphInterface from './utils/GraphInterface';
import { initializeLearningBrain, shutdownLearningBrain } from './brain';

import { fetchPageHeadless } from './utils/webParserUtil';
// Brain-driven shell (Plan 1): renderer trigger-bus IPC + main-process trigger emitter.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { registerTriggerBusHandlers } = require('./ipc/triggerBusHandlers');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const TriggerEmitter = require('./brain/TriggerEmitter');
// Plan 2 fork #5 (Quest layer)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { registerQuestHandlers } = require('./ipc/questHandlers');
// Plan 4: re-emit a Phase 7 path from OrbQuestMenu
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { registerQuestWalkHandlers } = require('./ipc/questWalkHandlers');
// Plan 9a (Brain Spine): Call Ledger IPC — Rationale Card + Economics Panel
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { registerCallLedgerHandlers } = require('./ipc/callLedgerHandlers');
// Plan 9d (Brain Spine): Renderer-direct LLM calls bridge — meteredCallJson IPC
// eslint-disable-next-line @typescript-eslint/no-var-requires
const spineHandlers = require('./ipc/spineHandlers');
// Phase 10b-1 (Study-Session Director): session lifecycle IPC
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sessionHandlers = require('./ipc/sessionHandlers');
// Phase 10b-3: wire rereadQueueSingleton for Director's scheduleReread tool
// eslint-disable-next-line @typescript-eslint/no-var-requires
const rereadQueueSingleton = require('./utils/rereadQueueSingleton');
// Phase 11 (Brain Visibility): dashboard + concept IPC
// eslint-disable-next-line @typescript-eslint/no-var-requires
const brainVisibilityHandlers = require('./ipc/brainVisibilityHandlers');

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
  const apiKeyDoubao = store.get(`doubao_key_${userId}`) as string;
  const apiKeyQwen = store.get(`qwen_key_${userId}`) as string;
  const apiKeyDeepSeek = store.get(`deepseek_key_${userId}`) as string;

  const { key, provider } = aiProviderManager.preSetup(
    provider0,
    apiKeyChatgpt,
    apiKeyGemini,
    apiKeyKimi,
    apiKeyClaude,
    apiKeyBaidu,
    apiKeyDoubao,
    apiKeyQwen,
    apiKeyDeepSeek,
  );

  let model = '';
  if (provider === AIProvider.ChatGPT) {
    // IPC handler writes to `chatgpt-model_<uid>` (see line 889).
    // Was reading `openai_model_<uid>` — wrong prefix AND wrong separator;
    // never matched, so user's model selection was silently dropped on every
    // boot and the hardcoded default in ChatGPTProvider applied instead.
    model = store.get(`chatgpt-model_${userId}`) as string;
  } else if (provider === AIProvider.Gemini) {
    // IPC handler writes to `gemini-model_<uid>` (see line 832). Was reading
    // `gemini_model_<uid>` — separator mismatch; same silent-drop bug.
    model = store.get(`gemini-model_${userId}`) as string;
  } else if (provider === AIProvider.Kimi) {
    model = store.get(`kimi-model_${userId}`) as string;
  } else if (provider === AIProvider.Claude) {
    model = store.get(`claude-model_${userId}`) as string;
  } else if (provider === AIProvider.Baidu) {
    model = store.get(`baidu_secret_${userId}`) as string;
  } else if (provider === AIProvider.Doubao) {
    model = store.get(`doubao-model_${userId}`) as string;
  } else if (provider === AIProvider.Qwen) {
    model = store.get(`qwen-model_${userId}`) as string;
  } else if (provider === AIProvider.Ollama) {
    model = store.get(`ollama-model_${userId}`) as string;
  } else if (provider === AIProvider.DeepSeek) {
    model = (store.get(`deepseek-model_${userId}`) as string) || DeepSeekModel.DEEPSEEK_CHAT;
  }

  aiProviderManager.setup(false, userId, provider, key, model);

  // Phase 15a — populate the cross-provider failover registry. Each
  // (name, key, model) pair that the user has configured becomes eligible
  // for the DEFAULT_CHAIN walk in meteredCall. The currently-active
  // provider is included too so a single-provider user still sees the
  // benefit of same-provider retry without the chain looking degenerate.
  const providerCatalog: Array<[string, string, string]> = [
    [AIProvider.ChatGPT, apiKeyChatgpt, store.get(`chatgpt-model_${userId}`) as string],
    [AIProvider.Gemini, apiKeyGemini, store.get(`gemini-model_${userId}`) as string],
    [AIProvider.Kimi, apiKeyKimi, store.get(`kimi-model_${userId}`) as string],
    [AIProvider.Claude, apiKeyClaude, store.get(`claude-model_${userId}`) as string],
    [AIProvider.Baidu, apiKeyBaidu, store.get(`baidu_secret_${userId}`) as string],
    [AIProvider.Doubao, apiKeyDoubao, store.get(`doubao-model_${userId}`) as string],
    [AIProvider.Qwen, apiKeyQwen, store.get(`qwen-model_${userId}`) as string],
    [
      AIProvider.DeepSeek,
      apiKeyDeepSeek,
      (store.get(`deepseek-model_${userId}`) as string) || DeepSeekModel.DEEPSEEK_CHAT,
    ],
  ];
  for (const [name, k, m] of providerCatalog) {
    if (k) aiProviderManager.registerProvider(name, k, m, false);
  }

  const embeddingFn = buildEmbeddingFunction(store, userId, provider);
  await vectorManager.setup(store, embeddingFn);
  await graphEmbeddingManager.setup(store, embeddingFn);
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

  ipcMain.on('deleteCollectionInStore', (_, name, keyName, keyValue) => {
    console.log(`deleteCollectionInStore ${name} ${keyName} = ${keyValue} `);
    const c = store.get(name) as Array<Record<string, unknown>> | undefined;
    if (!c) {
      _.returnValue = false;
      return;
    }
    const index = c.findIndex(
      (item: Record<string, unknown>) => item[keyName] === keyValue,
    );
    if (index > -1) {
      c.splice(index, 1);
      store.set(name, c);
      _.returnValue = true;
    } else {
      _.returnValue = false;
    }
  });

  ipcMain.on('getOneInCollection', (_, name, keyName, keyValue) => {
    const c = store.get(name) as Array<Record<string, unknown>> | undefined;
    if (!c) return null;
    const found = c.find(
      (item: Record<string, unknown>) => item[keyName] === keyValue,
    );
    _.returnValue = found;
  });
  ipcMain.handle('addToVocabulary', async (_event, text, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0 || !text || text.length < 3) {
      return false;
    }
    const exists = await getVocabularyByName(text.trim());
    if (exists) {
      return exists;
    }
    try {
      const level = store.get('reader_level');
      // eslint-disable-next-line global-require
      const meteredCallJson = require('./brain/spine/meteredCallJson');
      const { output: json } = await meteredCallJson(
        createVocabularyPrompt(text.trim(), level),
        null,
        { legacyLabel: 'add-vocabulary' },
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
      return newOne;
    } catch (e: unknown) {
      const err = e as { message?: string };
      console.log(err.message ? err.message : e);
      return false;
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
        if (
          fieldOne &&
          item[fieldOne] &&
          (item[fieldOne] as string).indexOf(query) >= 0
        )
          return true;
        if (
          fieldTwo &&
          item[fieldTwo] &&
          (item[fieldTwo] as string).indexOf(query) >= 0
        )
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

  ipcMain.handle('getNoteBgImage', (_evt, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return -1;
    const mode = store.get(`note-bg-image_${userId}`);
    return mode || 0;
  });

  ipcMain.handle('setNoteBgImage', (_evt, { imageNum, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) return false;
    store.set(`note-bg-image_${userId}`, imageNum);
    return true;
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

  ipcMain.on('getDeepSeekKey', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      const key = store.get(`deepseek_key_${userId}`);
      _.returnValue = key || false;
    }
  });

  ipcMain.on('setDeepSeekKey', (_, { key, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`deepseek_key_${userId}`, key || false);
      _.returnValue = true;
    }
  });

  ipcMain.on('getDeepSeekModel', (_, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = -1;
    } else {
      const mode = store.get(`deepseek-model_${userId}`);
      _.returnValue = mode || DeepSeekModel.DEEPSEEK_CHAT;
    }
  });

  ipcMain.on('setDeepSeekModel', (_, { mode, token }) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      _.returnValue = false;
    } else {
      store.set(`deepseek-model_${userId}`, mode);
      _.returnValue = true;
    }
  });

  ipcMain.handle('getBaiduAccessToken', async (_event, token) => {
    const userId = getUserIdFromToken(token);
    if (userId < 0) {
      return false;
    }
    const key = await getBaiduAccessToken(store, userId);
    return key || false;
  });

  /** database related */
  /** user manage */
  // Run the UNIQUE(email) migration once before exposing register so
  // duplicate-email submissions fail loudly even on legacy DBs that
  // shipped with the pre-UNIQUE schema.
  ensureUserSchema();
  ipcMain.handle('register', async (_evt, user, email, password) => {
    try {
      return register(user, email, password);
    } catch (e) {
      console.log(e.message ? e.message : e);
      return { ok: false, code: 'db-error' };
    }
  });
  ipcMain.handle('login', async (_evt, email, password) => {
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
        return userInfo;
      }
      return { id, username, email, token: '' };
    } catch (e) {
      console.log(e.message ? e.message : e);
      // Match the success/empty-username return shape so callers can
      // safely destructure without conditional shape checks.
      return { id: -1, username: '', email, token: '' };
    }
  });
  ipcMain.handle('logout', async (_evt, token) => {
    try {
      const info = store.get('session_info');
      // Don't log the token or the full session_info — they are short-lived
      // secrets that should not end up in user-pasted bug-report logs.
      if (info && info.token === token) {
        store.set('session_info', '');
        console.log('logout: success');
        return true;
      }
      console.log('logout: token mismatch');
      return false;
    } catch (e) {
      console.log(e.message ? e.message : e);
      return false;
    }
  });
  // Validate session - check if renderer's token matches main process session
  ipcMain.handle('validateSession', async (_evt, token) => {
    try {
      const info = store.get('session_info');
      if (info && info.token && info.token === token) {
        return info;
      }
      return null;
    } catch (e) {
      console.log(e.message ? e.message : e);
      return null;
    }
  });
  ipcMain.handle('emojiData', async () => {
    const module = await import('./utils/emoji-data.js');
    return module.default;
  });

  ipcMain.on('getPDF4URL', (_, { id }) => {
    try {
      const dataPath = global.shared.store.get('storageLocation');
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
  ipcMain.on('deleteAllChat', async (_, { token }) => {
    _.returnValue = deleteAllChat(token);
  });
  ipcMain.on('deleteAllNote', async (_, { token }) => {
    _.returnValue = deleteAllNote(token);
  });
  ipcMain.on('deleteAllQuizProblem', async (_, { token }) => {
    _.returnValue = deleteAllQuizProblem(token);
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
  ipcMain.on('createHistoryGroup', async (_, { name, token }) => {
    _.returnValue = createHistoryGroup(name, token);
  });
  ipcMain.on(
    'getHistoryGroupByQuery',
    async (_, { query, page, limit, token }) => {
      _.returnValue = getHistoryGroupByQuery(query, page, limit, token);
    },
  );
  ipcMain.handle('createHistory', async (_event, { history, token }) => {
    if (history.sourceType === 'url') {
      const meta = await createUrlDescription(history.sourceKey);
      history.description = meta.description;
      console.log(` in createHistory, favicon = ${meta.favicon}`);
      if (meta.favicon) {
        const image = await createImage(meta.favicon);
        history.favicon = image.id;
      }
    }
    return createHistory(history, token);
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
  ipcMain.on('updateHistory', async (_, { id, description, token }) => {
    _.returnValue = updateHistory(id, description, token);
  });
  ipcMain.handle(
    'addContentToInMemoryVectorDB',
    async (_event, { content }) => {
      await graphEmbeddingManager.addContentToTempStorage(content);
      return true;
    },
  );
  ipcMain.handle('queryInMemoryVectorDB', async (_event, { content }) => {
    try {
      return await graphEmbeddingManager.queryTempStorage(content, 10);
    } catch (e) {
      return [];
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
  ipcMain.on('renameBookmarkGroup', async (_, { id, name, token }) => {
    _.returnValue = renameBookmarkGroup(id, name, token);
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
  ipcMain.handle('getBooksByQuery', async (_event, { query, token }) => {
    try {
      const books = getBooksByQuery(query, token);
      // Semantic search via graph-backed vector store
      if (query.indexOf(' ') > 0 && graphInterface.checkConnection()) {
        const r = await graphEmbeddingManager.searchBooks(query, token);
        r.forEach((m) => books.push(m));
      }
      // Also search graph database if available (text match over node properties)
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
      return books;
    } catch (e) {
      console.log(e.message ? e.message : e);
      return [];
    }
  });
  ipcMain.handle(
    'getBookContentByQuery',
    async (_event, { bookKey, bookType, query, token }) => {
      console.log(
        ` bookKey = ${bookKey} bookType = ${bookType} query= ${query} token = ${token}`,
      );
      return graphEmbeddingManager.getBookContentByQuery(
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
  ipcMain.handle('createBookmark', async (_event, { url, token }) => {
    const b = await createBookmarkUtils(url, token);
    if (b) {
      try {
        if (typeof b.id !== 'undefined') {
          // Add bookmark to graph + its embedding via the unified manager
          await graphEmbeddingManager.addBookmark(b, token);
        }
      } catch (e) {
        console.log(e);
      }
      console.log(` main createbookmark = ${JSON.stringify(b)}`);
    }
    return b ?? null;
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

  ipcMain.on('createChat', (_, { chat, token }) => {
    const c = createChat(chat, token);
    _.returnValue = c;
    // Best-effort graph sync, fire-and-forget so sync IPC returns immediately.
    if (graphInterface.isReady() && c && typeof c.id !== 'undefined') {
      graphInterface.createChat(chat, token).catch((graphError: unknown) => {
        console.error('Failed to add chat to graph:', graphError);
      });
    }
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
  ipcMain.on('createMessage', (_, { message, token }) => {
    const m = createMessage(message, token);
    _.returnValue = m;
    // Best-effort graph sync, fire-and-forget so sync IPC returns immediately.
    if (
      graphInterface.isReady() &&
      m &&
      typeof m.id !== 'undefined' &&
      message.chatId
    ) {
      graphInterface
        .addMessage(message, message.chatId, token)
        .catch((graphError: unknown) => {
          console.error('Failed to add message to graph:', graphError);
        });
    }
  });
  ipcMain.on('getMessageById', async (_, { id, token }) => {
    _.returnValue = getMessageById(id, token);
  });
  ipcMain.handle('getMessageByQuery', async (_event, { query, token }) => {
    try {
      const messages = getMessageByQuery(query, token);
      // Semantic search via graph-backed vector store
      if (query.indexOf(' ') > 0 && graphInterface.checkConnection()) {
        const r = await graphEmbeddingManager.searchMessages(query, token);
        r.forEach((m) => messages.push(m));
      }
      // Also search graph database if available (text match over node properties)
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
      return messages;
    } catch (e) {
      console.log(e.message ? e.message : e);
      return false;
    }
  });
  ipcMain.on('getMessagesByChatId', async (_, { id, token }) => {
    _.returnValue = getMessagesByChatId(id, token);
  });
  ipcMain.on('updateMessage', async (_, { id, field, value, token }) => {
    _.returnValue = updateMessage(id, field, value, token);
  });
  ipcMain.on('createNote', (_, { note, token }) => {
    const n = createNote(note, token);
    _.returnValue = n;
    // Best-effort graph sync + embedding storage, fire-and-forget so sync IPC returns immediately.
    if (typeof n.id !== 'undefined') {
      if (graphInterface.isReady()) {
        graphInterface
          .createNote(note, token)
          .then(() => graphEmbeddingManager.addNote(note, token))
          .catch((e: unknown) => {
            console.error('Failed to add note to graph:', e);
          });
      }
    }
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
  ipcMain.handle(
    'getNotesByQuery',
    async (_event, { query, tag, star, page, limit, token }) => {
      const notes = getNotesByQuery(query, tag, star, page, limit, token);
      try {
        // Semantic search via graph-backed vector store
        if (query.indexOf(' ') > 0 && graphInterface.checkConnection()) {
          const r = await graphEmbeddingManager.searchNotes(query, token);
          r.forEach((m) => notes.data.push(m));
        }
        // Also search graph database if available (text match over node properties)
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

      return notes;
    },
  );
  ipcMain.on('updateNote', (_, { noteId, field, value, token }) => {
    const result = updateNote(noteId, field, value, token);
    _.returnValue = result;
    // Best-effort graph sync, fire-and-forget so sync IPC returns immediately.
    if (result && graphInterface.isReady()) {
      const note = getNoteById(noteId, token);
      if (note) {
        graphInterface.syncNote(note, token).catch((e: unknown) => {
          console.error('Failed to sync note update to graph:', e);
        });
      }
    }
  });

  ipcMain.on('clearNotesBy', async (_, { sourceKey, sourceType, token }) => {
    _.returnValue = deleteNoteBySourceKeyAndSourceType(
      sourceKey,
      sourceType,
      token,
    );
  });
  ipcMain.on('replaceNote', (_, { noteId, note, token }) => {
    const result = replaceNote(noteId, note, token);
    _.returnValue = result;
    // Best-effort graph sync, fire-and-forget so sync IPC returns immediately.
    if (result && graphInterface.isReady()) {
      graphInterface.syncNote(result, token).catch((e: unknown) => {
        console.error('Failed to sync note replacement to graph:', e);
      });
    }
  });
  ipcMain.on(
    'updateNoteCard',
    (_, { noteId, cardIndex, field, value, token }) => {
      const result = updateNoteCard(noteId, cardIndex, field, value, token);
      _.returnValue = result;
      // Best-effort graph sync, fire-and-forget so sync IPC returns immediately.
      if (result && graphInterface.isReady()) {
        const note = getNoteById(noteId, token);
        if (note) {
          graphInterface.syncNote(note, token).catch((e: unknown) => {
            console.error('Failed to sync note card update to graph:', e);
          });
        }
      }
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

  /// //////// vocabulary and vocabulary_set ////////////////
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
  ipcMain.on('addVocabularyToSet', async (_, { id, setId, token }) => {
    _.returnValue = addVocabularyToSet(id, setId, token);
  });
  /// ///  vocabulary set
  ipcMain.on('createVocabularySet', async (_, { vocabularySet, token }) => {
    _.returnValue = createVocabularySet(vocabularySet, token);
  });
  ipcMain.on(
    'getVocabularySetByQuery',
    async (_, { query, page, limit, token }) => {
      _.returnValue = getVocabularySetByQuery(query, page, limit, token);
    },
  );

  ipcMain.handle('fetchPageHeadless', async (_event, { url }) => {
    return fetchPageHeadless(url);
  });
  /**  related to vector database  */
  // response = { ids:[] documents:[]}
  ipcMain.handle(
    'semanticQuery',
    async (_event, query, nResults, _condition, token) => {
      if (!graphInterface.checkConnection()) {
        return { ids: [], documents: [] };
      }
      try {
        const limit = nResults || 10;
        const embedding = await graphEmbeddingManager.generateEmbedding(query);
        if (!embedding) return { ids: [], documents: [] };

        const ids: string[] = [];
        const documents: string[] = [];

        const nodeHits = await graphInterface.findSimilar(
          embedding,
          ['Note', 'Bookmark', 'Message'],
          limit,
          0.7,
          token,
        );
        for (const hit of nodeHits) {
          const node = hit.node || {};
          ids.push(String(node.id ?? hit.id ?? ''));
          documents.push(
            String(node.text || node.content || node.title || ''),
          );
        }

        const chunkHits = await graphInterface.searchSimilarChunks(
          embedding,
          {},
          limit,
          0.7,
        );
        for (const r of chunkHits) {
          // BookChunk IDs preserve the `bookId|...` shape callers parse on.
          ids.push(String(r.chunk?.id ?? ''));
          documents.push(String(r.chunk?.text ?? ''));
        }

        return { ids, documents };
      } catch (e) {
        console.log(e.message ? e.message : e);
        return { ids: [], documents: [] };
      }
    },
  );

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

  ipcMain.on('getOllamaUrl', (_) => {
    const url = store.get('ollama_url');
    _.returnValue = url || 'http://127.0.0.1:11434';
  });

  ipcMain.on('setOllamaUrl', (_, url) => {
    store.set('ollama_url', url);
    _.returnValue = true;
  });

  /**  export & import  */

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
      // Create book node in graph + auto-index chunks for RAG. Indexing is
      // fire-and-forget; it emits progress events the renderer toasts on.
      try {
        if (graphInterface.isReady()) {
          await graphInterface.createBook(book, token);
        }
        void indexBookWithProgress(mainWin, book, token);
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
        // Create book node in graph + auto-index chunks for RAG. Indexing is
        // fire-and-forget; it emits progress events the renderer toasts on.
        try {
          if (graphInterface.isReady()) {
            await graphInterface.createBook(book, token);
          }
          void indexBookWithProgress(mainWin, book, token);
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


  ipcMain.handle('open-book', (event, config) => {
    try {
      openBook(config);
      return 'success';
    } catch (e) {
      console.log(e.message ? e.message : e);
      return false;
    }
  });

  ipcMain.handle('speak-text-by-say', async (_event, { text }) => {
    console.log('enter speak-text-by-say');

    try {
      return await ttsManager.speakTextBySayImp(text);
    } catch (error) {
      console.error(error);
      return false;
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

    // Initialize GraphInterface (SQLite embedded by default, no external server required)
    try {
      const graphConfig = store.get('graph', {
        enabled: true,
        adapterType: 'sqlite',
      });
      if (graphConfig.enabled) {
        // Kùzu was retired in D3 — its win32-x64 prebuilt segfaults Electron.
        // Any install that stored 'kuzu' before the migration falls back to 'sqlite'.
        const raw = graphConfig.adapterType || 'sqlite';
        const adapterType = raw === 'kuzu' ? 'sqlite' : raw;
        await graphInterface.initialize(adapterType, store);
        const status = graphInterface.getStatus();
        console.log(`[main] GraphInterface initialized with ${adapterType}:`, {
          connected: status.connected,
          dbPath: status.dbPath,
          capabilities: Object.keys(status.capabilities).filter(
            (k) => status.capabilities[k],
          ),
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

    // Brain-driven shell: TriggerEmitter ships Triggers to the renderer
    // via mainWin.webContents. Phase 5-8 services receive it as a dep
    // (Phase 4 stays in-paragraph and does not emit Triggers).
    const triggerEmitter = new TriggerEmitter({
      getWebContents: () => mainWin?.webContents ?? null,
    });

    // Phase 3d + 4a: micro-card proposer and batch enrichment IPC handlers
    registerMicroCardHandlers();
    registerEnrichmentHandlers();
    // Vocabulary → learning_point lazy backfill (legacy vocab rows gain
    // a learning_point mirror on first SRS-halo fetch per user-per-session).
    registerVocabMirrorHandlers(ipcMain);
    // Feature #13: Argument Skeleton X-ray — paragraph LLM analysis.
    registerArgumentXrayHandlers(ipcMain);
    // Phase 5: pre-book diagnostic IPC handlers
    registerBookDiagnosticHandlers();
    // Phase 6: chapter-end comprehension grading IPC handlers
    registerComprehensionHandlers();
    // Phase 7: cross-book curriculum planner IPC handlers.
    // Receives `store` + `getWebContents` so it can auto-create a Quest
    // when a path succeeds and broadcast `quest:changed` to the renderer.
    registerLearningPathPlannerHandlers({
      triggerEmitter,
      store,
      getWebContents: () => mainWin?.webContents ?? null,
    });
    // Phase 8/10b-3: spaced re-reading queue IPC handlers + singleton init
    // Init the singleton so Director's scheduleReread tool can access it
    rereadQueueSingleton.init(store);
    registerRereadQueueHandlers(store, { triggerEmitter });
    // Plan 2 fork #5: Quest layer + Plan 3 fork: Brain weighting hook.
    // The handlers broadcast `quest:changed` after each mutation so the
    // renderer triggerBus can re-hydrate its quest book IDs and re-sort
    // the queue with quest-aligned items bubbled to the top.
    registerQuestHandlers(store, {
      getWebContents: () => mainWin?.webContents ?? null,
    });
    // Plan 4: quest-walk re-emits a Phase 7 path so OrbQuestMenu can resume.
    registerQuestWalkHandlers(store, { triggerEmitter });
    // Plan 9a (Brain Spine): Call Ledger — Rationale Card + Economics Panel.
    // No store arg needed; the DAO accesses DBManager directly.
    registerCallLedgerHandlers();
    // Plan 9d (Brain Spine): Renderer-direct LLM calls bridge.
    // Polymorphic IPC channel for both text (meteredCall) and JSON (meteredCallJson).
    spineHandlers.register();
    // Phase 10b-1 (Study-Session Director): session lifecycle IPC.
    sessionHandlers.register();
    // Phase 11 (Brain Visibility): dashboard + concept IPC.
    brainVisibilityHandlers.register();

    // Phase 14a (Predictive Engine): predict / rank / refresh / report IPC.
    const PredictiveEngine = require('./brain/predictive/PredictiveEngine');
    const predictiveHandlers = require('./ipc/predictiveHandlers');
    const predictiveEngine = new PredictiveEngine();
    predictiveHandlers.register(ipcMain, predictiveEngine);

    // Phase 15b (Anomaly detector): list / rescan / acknowledge IPC.
    const anomalyHandlers = require('./ipc/anomalyHandlers');
    anomalyHandlers.register();

    // Phase 12: backfill mastery_event on first boot.
    const { isEmpty } = require('./db/MasteryEventStore');
    const { backfill: backfillMastery } = require('./utils/MasteryEventBackfill');
    setImmediate(async () => {
      try {
        if (isEmpty()) {
          console.log('[phase-12] mastery_event empty → running backfill');
          await backfillMastery({ userId: 1 });
          console.log('[phase-12] backfill complete');
        }
      } catch (e) {
        console.warn('[phase-12] backfill failed (continuing):', e.message);
      }
    });

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
      graphInterface,
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
          registerTriggerBusHandlers({ brain, store });
          console.log('[main] Learning Brain initialized successfully');
        } else {
          // Brain disabled or failed - still register handlers for status queries
          registerBrainHandlers({ brain: null, store });
          registerTriggerBusHandlers({ brain: null, store });
          console.log('[main] Learning Brain disabled or unavailable');
        }
      })
      .catch((err) => {
        console.error('[main] Learning Brain initialization failed:', err);
        registerBrainHandlers({ brain: null, store });
        registerTriggerBusHandlers({ brain: null, store });
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
  })
  .catch(console.log);
