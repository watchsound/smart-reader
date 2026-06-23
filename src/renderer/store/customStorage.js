import JSON5 from 'json5';
import { loginHandled, logoutHandled } from './reducers/userSlice';
import {
  AIProvider,
  ChatGPTModel,
  ClaudeModel,
  GeminiModel,
  OllamaModel,
  BaiduModel,
  KimiModel,
  DoubaoModel,
  QwenModel,
  DeepSeekModel,
} from '../../commons/model/DataTypes';
import { instanceInRender as aiProviderManager } from '../../commons/service/AIProviderManager';

class customStorage {
  static getUserInfo() {
    const userInfo = localStorage.getItem('_userInfo_');
    return userInfo
      ? JSON5.parse(userInfo)
      : { user: '', email: '', token: '' };
  }

  static setUserInfo(userInfo) {
    localStorage.setItem('_userInfo_', JSON.stringify(userInfo));
  }

  static getSessionToken() {
    return this.getUserInfo().token;
  }

  // Alias for getSessionToken - used by LeitnerSystem and other components
  static getToken() {
    return this.getSessionToken();
  }

  static getUserId() {
    return this.getUserInfo().id;
  }

  static isLoggedIn() {
    const token = this.getSessionToken();
    return token && token.length > 0;
  }

  static async setupAiProvider(userId, newProvider) {
    const provider0 = newProvider || (await this.getAIProvider());
    const apiKeyChatgpt = await this.getOpenAIKey();
    const apiKeyGemini = await this.getGeminiKey();
    const apiKeyKimi = await this.getKimiKey();
    const apiKeyClaude = await this.getClaudeKey();
    const apiKeyBaidu = await this.getBaiduKey();
    const apiKeyDoubao = await this.getDoubaoKey();
    const apiKeyQwen = await this.getQwenKey();
    const apiKeyDeepSeek = await this.getApiKeyDeepSeek();
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
    let advancedModel = '';
    if (provider === AIProvider.ChatGPT) {
      model = await this.getChatGPTModel();
      advancedModel = await this.getChatGPTAdvancedModel();
    } else if (provider === AIProvider.Gemini) {
      model = await this.getGeminiModel();
      advancedModel = await this.getGeminiAdvancedModel();
    } else if (provider === AIProvider.Claude) {
      model = await this.getClaudeModel();
      advancedModel = await this.getClaudeAdvancedModel();
    } else if (provider === AIProvider.Baidu) {
      model = await this.getBaiduAccessToken(); // ugly but....
      advancedModel = await this.getBaiduAdvancedModel();
    } else if (provider === AIProvider.Ollama) {
      model = await this.getOllamaModel(); // ugly but....
      advancedModel = await this.getOllamaAdvancedModel();
    } else if (provider === AIProvider.Doubao) {
      model = await this.getDoubaoModel();
      advancedModel = await this.getDoubaoAdvancedModel();
    } else if (provider === AIProvider.Qwen) {
      model = await this.getQwenModel();
      advancedModel = await this.getQwenAdvancedModel();
    } else if (provider === AIProvider.Kimi) {
      advancedModel = await this.getKimiAdvancedModel();
    } else if (provider === AIProvider.DeepSeek) {
      model = await this.getModelDeepSeek();
    }

    aiProviderManager.setup(true, userId, provider, key, model);
    aiProviderManager.setupAdvanced(true, provider, key, advancedModel);
  }

  static async login(email, password) {
    const userInfo = await window.electron.ipcRenderer.login(email, password);
    console.log(JSON.stringify(userInfo));
    this.setUserInfo(userInfo);
    if (typeof userInfo.id !== 'undefined') {
      this.setupAiProvider(userInfo.id);
    }
    return userInfo;
  }

  static async logout(dispatch) {
    const t = this.getSessionToken();
    if (t) {
      const flag = await window.electron.ipcRenderer.logout(t);
      if (flag) {
        const v = { user: '', email: '', token: '' };
        this.setUserInfo(v);
        if (dispatch) dispatch(logoutHandled(v));
      }
    }
  }

  // Validate that renderer's token matches main process session.
  // Async since the underlying IPC was converted to ipcRenderer.invoke.
  // Returns session info if valid, null if invalid.
  static async validateSession() {
    const token = this.getSessionToken();
    if (!token) return null;
    const sessionInfo = await window.electron.ipcRenderer.validateSession(token);
    if (!sessionInfo) {
      // Session invalid - clear local storage
      this.setUserInfo({ user: '', email: '', token: '' });
    }
    return sessionInfo;
  }

  static async register(user, email, password) {
    return window.electron.ipcRenderer.register(user, email, password);
  }

  static emojiData() {
    return window.electron.ipcRenderer.emojiData();
  }

  // static queryNote(query) {
  //   return window.electron.ipcRenderer.queryNote(query);
  // }

  static importBookFromFile() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.importBookFromFile(
      this.getSessionToken(),
    );
  }

  static importImageBase64FromFile() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.importImageBase64FromFile(
      this.getSessionToken(),
    );
  }

  static importBookFromServer(bookFromServer) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.importBookFromServer(
      bookFromServer,
      this.getSessionToken(),
    );
  }

  static getPDF4URL(id) {
    if (!this.isLoggedIn()) return '';
    return window.electron.ipcRenderer.getPDF4URL(id);
  }


  static deleteBookmarkById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteBookmarkById(
      id,
      this.getSessionToken(),
    );
  }

  static deleteChatById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteChatById(
      id,
      this.getSessionToken(),
    );
  }


  static deleteNoteById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteNoteById(
      id,
      this.getSessionToken(),
    );
  }

  static addNoteToLeitnerStudy(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.addNoteToLeitnerStudy(
      id,
      this.getSessionToken(),
    );
  }

  static deleteQuizProblemById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteQuizProblemById(
      id,
      this.getSessionToken(),
    );
  }

  static deleteAllChat() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteAllChat(this.getSessionToken());
  }

  static deleteAllNote() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteAllNote(this.getSessionToken());
  }

  static deleteAllQuizProblem() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteAllQuizProblem(
      this.getSessionToken(),
    );
  }

  static createBookmarkGroup(parentGroupId, name) {
    if (!this.isLoggedIn() || !name) return null;
    return window.electron.ipcRenderer.createBookmarkGroup(
      parentGroupId,
      name,
      this.getSessionToken(),
    );
  }

  static getBookmarkGroupByName(name) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getBookmarkGroupByName(
      name,
      this.getSessionToken(),
    );
  }

  static jsonBookmarkGroupStructure() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.jsonBookmarkGroupStructure(
      this.getSessionToken(),
    );
  }

  static printBookmarkGroupStructure(gapChar) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.printBookmarkGroupStructure(
      gapChar,
      this.getSessionToken(),
    );
  }

  static renameBookmarkGroup(id, name) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.renameBookmarkGroup(
      id,
      name,
      this.getSessionToken(),
    );
  }

  static createHistoryGroup(name) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.createHistoryGroup(
      name,
      this.getSessionToken(),
    );
  }

  static getHistoryGroupByQuery(query, page, limit) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getHistoryGroupByQuery(
      query,
      page,
      limit,
      this.getSessionToken(),
    );
  }

  static createHistory(history) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.createHistory(
      history,
      this.getSessionToken(),
    );
  }

  static getHistoryByGroupIdAndSourceKey(groupId, sourceKey) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getHistoriesByGroupId(
      groupId,
      sourceKey,
      this.getSessionToken(),
    );
  }

  static getHistoriesByGroupId(groupId) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getHistoriesByGroupId(
      groupId,
      this.getSessionToken(),
    );
  }

  static updateHistory(id, description) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.updateHistory(
      id,
      description,
      this.getSessionToken(),
    );
  }

  static getHistoryByQuery(sourceType, query, page, limit) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getHistoryByQuery(
      sourceType,
      query,
      page,
      limit,
      this.getSessionToken(),
    );
  }

  static addContentToInMemoryVectorDB(description) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.addContentToInMemoryVectorDB(
      description,
    );
  }

  static queryInMemoryVectorDB(description) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.queryInMemoryVectorDB(description);
  }

  static createBookshelf(name) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.createBookshelf(
      name,
      this.getSessionToken(),
    );
  }

  static renameBookshelf(id, name) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.renameBookshelf(
      name,
      this.getSessionToken(),
    );
  }

  static deleteAllBookshelf() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteAllBookshelf(
      this.getSessionToken(),
    );
  }

  static deleteBookshelfById(bookshelfId) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteBookshelfById(
      bookshelfId,
      this.getSessionToken(),
    );
  }

  static getAllBookshelf() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getAllBookshelf(this.getSessionToken());
  }

  static getBookshelfById(bookshelfId) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getBookshelfById(
      bookshelfId,
      this.getSessionToken(),
    );
  }

  // book related
  static getBooksByCategory(category) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getBooksByCategory(
      category,
      this.getSessionToken(),
    );
  }

  static getBooksByBookshelfId(bookshelfId) {
    if (!this.isLoggedIn()) return [];
    return window.electron.ipcRenderer.getBooksByBookshelfId(
      bookshelfId,
      this.getSessionToken(),
    );
  }

  static changeBookshelf(bookId, newId) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.changeBookshelf(
      bookId,
      newId,
      this.getSessionToken(),
    );
  }

  static getBooksByQuery(query) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getBooksByQuery(
      query || '',
      this.getSessionToken(),
    );
  }

  static getBooks() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getBooks(this.getSessionToken());
  }

  static getBookById(bookId) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getBookById(
      bookId,
      this.getSessionToken(),
    );
  }

  static getBookByIdFromServer(idFromServer) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getBookByIdFromServer(
      idFromServer,
      this.getSessionToken(),
    );
  }

  static updateBook(id, field, value) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.updateBook(
      id,
      field,
      value,
      this.getSessionToken(),
    );
  }

  // bookmarks
  static getBookmarksBySourceKey(sourceId, sourceType) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getBookmarksBySourceKey(
      sourceId,
      sourceType,
      this.getSessionToken(),
    );
  }

  static getBookmarksByUrl(url) {
    return this.getBookmarksBySourceKey(url, 'url');
  }

  static async createBookmark(url) {
    if (!this.isLoggedIn()) return null;
    const r = await this.getBookmarksByUrl(url);
    if (r && r.length > 0) return r[0];
    return window.electron.ipcRenderer.createBookmark(
      url,
      this.getSessionToken(),
    );
  }

  static getBookmarksByGroupId(groupId) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getBookmarksByGroupId(
      groupId,
      this.getSessionToken(),
    );
  }

  static getBookmarksRecursiveByGroupId(groupId) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getBookmarksRecursiveByGroupId(
      groupId,
      this.getSessionToken(),
    );
  }

  static getBookmarkByQuery(query) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getBookmarkByQuery(
      query,
      this.getSessionToken(),
    );
  }

  static updateBookmark(id, field, value) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.updateBookmark(
      id,
      field,
      value,
      this.getSessionToken(),
    );
  }

  // chat
  static createChat(chat) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.createChat(chat, this.getSessionToken());
  }

  static getChatById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getChatById(id, this.getSessionToken());
  }

  static getPinnedChats() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getPinnedChats(this.getSessionToken());
  }

  static getPinnedLearnAbout() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getPinnedLearnAbout(
      this.getSessionToken(),
    );
  }

  static getLearnAboutByQuery({ query, page, limit }) {
    if (!this.isLoggedIn())
      return {
        data: [],
        total: 0,
        totalPages: 0,
        currentPage: 0,
      };
    return window.electron.ipcRenderer.getLearnAboutByQuery(
      query,
      page,
      limit,
      this.getSessionToken(),
    );
  }

  static async jsonLearnAboutChats() {
    if (!this.isLoggedIn()) return [];
    const result = await this.getLearnAboutByQuery({ query: '', page: 1, limit: 100 });
    return result?.data || [];
  }

  static getChatsByQuery({ query, page, limit }) {
    if (!this.isLoggedIn())
      return {
        data: [],
        total: 0,
        totalPages: 0,
        currentPage: 0,
      };
    return window.electron.ipcRenderer.getChatsByQuery(
      query,
      page,
      limit,
      this.getSessionToken(),
    );
  }

  static updateChat(id, field, value) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.updateChat(
      id,
      field,
      value,
      this.getSessionToken(),
    );
  }

  // note
  static createNote(note) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.createNote(note, this.getSessionToken());
  }

  static getNoteById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getNoteById(id, this.getSessionToken());
  }

  static getNotesByIds(ids) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getNotesByIds(
      ids,
      this.getSessionToken(),
    );
  }

  static getNotesByDueReview({ dueTime, page, limit }) {
    if (!this.isLoggedIn())
      return {
        data: [],
        total: 0,
        totalPages: 0,
        currentPage: 0,
      };
    return window.electron.ipcRenderer.getNotesByDueReview(
      dueTime,
      page,
      limit,
      this.getSessionToken(),
    );
  }

  static getNotesByQuery({ query, tag, star, page, limit }) {
    if (!this.isLoggedIn())
      return {
        data: [],
        total: 0,
        totalPages: 0,
        currentPage: 0,
      };
    return window.electron.ipcRenderer.getNotesByQuery(
      query || '',
      tag || '',
      star || 0,
      page,
      limit,
      this.getSessionToken(),
    );
  }

  static queryNoteBySourceKeyAndSourceType(sourceKey, sourceType) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.queryNoteBySourceKeyAndSourceType(
      sourceKey,
      sourceType,
      this.getSessionToken(),
    );
  }

  static updateNote(noteId, field, value) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.updateNote(
      noteId,
      field,
      value,
      this.getSessionToken(),
    );
  }

  static replaceNote(noteId, note) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.replaceNote(
      noteId,
      note,
      this.getSessionToken(),
    );
  }

  static clearNotesBy(sourceKey, sourceType) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.clearNotesBy(
      sourceKey,
      sourceType,
      this.getSessionToken(),
    );
  }

  static updateNoteCard(noteId, cardIndex, field, value) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.updateNoteCard(
      noteId,
      cardIndex,
      field,
      value,
      this.getSessionToken(),
    );
  }

  // mood board
  static createMoodBoard(moodBoard) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.createMoodBoard(
      moodBoard,
      this.getSessionToken(),
    );
  }

  static getMoodBoardById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getMoodBoardById(
      id,
      this.getSessionToken(),
    );
  }

  static getMoodBoardsByQuery(query, page, limit) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getMoodBoardsByQuery(
      query || '',
      page,
      limit,
      this.getSessionToken(),
    );
  }

  static updateMoodBoard(id, field, value) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.updateMoodBoard(
      id,
      field,
      value,
      this.getSessionToken(),
    );
  }

  static deleteMoodBoardById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteMoodBoardById(
      id,
      this.getSessionToken(),
    );
  }

  static deleteAllMoodBoards() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteAllMoodBoards(
      this.getSessionToken(),
    );
  }

  static getActiveMoodBoardId() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getActiveMoodBoardId(
      this.getSessionToken(),
    );
  }

  static setActiveMoodBoardId(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.setActiveMoodBoardId(
      id,
      this.getSessionToken(),
    );
  }

  // prompt
  static createPrompt(prompt) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.createPrompt(
      prompt,
      this.getSessionToken(),
    );
  }

  static getPromptById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getPromptById(
      id,
      this.getSessionToken(),
    );
  }

  static getPromptsByQuery({ query, page, limit }) {
    if (!this.isLoggedIn())
      return {
        data: [],
        total: 0,
        totalPages: 0,
        currentPage: 0,
      };
    return window.electron.ipcRenderer.getPromptsByQuery(
      query,
      page,
      limit,
      this.getSessionToken(),
    );
  }

  static getPromptsBySource(source) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getPromptsBySource(
      source,
      this.getSessionToken(),
    );
  }

  static updatePrompt({ id, field, value }) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.updatePrompt(
      id,
      field,
      value,
      this.getSessionToken(),
    );
  }

  // vocabulary
  static getVocabularyByName(name) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getVocabularyByName(
      name,
      this.getSessionToken(),
    );
  }

  static createVocabulary(vocabulary) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.createVocabulary(
      vocabulary,
      this.getSessionToken(),
    );
  }

  static getVocabulariesBySetId(setId) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getVocabulariesBySetId(
      setId,
      this.getSessionToken(),
    );
  }

  static getVocabulariesByDueReview({ dueTime, page, limit }) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getVocabulariesByDueReview(
      dueTime,
      page,
      limit,
      this.getSessionToken(),
    );
  }

  static getVocabulariesByQuery({ query, page, limit }) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getVocabulariesByQuery(
      query,
      page,
      limit,
      this.getSessionToken(),
    );
  }

  static updateVocabulary({ id, field, value }) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.updateVocabulary(
      id,
      field,
      value,
      this.getSessionToken(),
    );
  }


  static addVocabularyToSet({ id, setId }) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.addVocabularyToSet(
      id,
      setId,
      this.getSessionToken(),
    );
  }

  // vocabulary set
  static createVocabularySet(vocabularySet) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.createVocabularySet(
      vocabularySet,
      this.getSessionToken(),
    );
  }

  static getVocabularySetByQuery({ query, page, limit }) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getVocabularySetByQuery(
      query,
      page,
      limit,
      this.getSessionToken(),
    );
  }

  static getBookContentByQuery({ bookKey, bookType, query }) {
    return window.electron.ipcRenderer.getBookContentByQuery(
      bookKey,
      bookType,
      query,
      this.getSessionToken(),
    );
  }

  // image
  static createImage(image) {
    return window.electron.ipcRenderer.createImage(image);
  }

  static getImage(id) {
    return window.electron.ipcRenderer.getImage(id);
  }

  // quiz problem
  static createMessage(message) {
    if (!this.isLoggedIn()) return null;
    console.log('create message');
    return window.electron.ipcRenderer.createMessage(
      message,
      this.getSessionToken(),
    );
  }

  static getMessagesByChatId(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getMessagesByChatId(
      id,
      this.getSessionToken(),
    );
  }

  static getMessageByQuery(query) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getMessageByQuery(
      query,
      this.getSessionToken(),
    );
  }

  static updateMessage(id, field, value) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.updateMessage(
      id,
      field,
      value,
      this.getSessionToken(),
    );
  }

  // quiz problem
  static createQuizProblem(quizProblem) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.createQuizProblem(
      quizProblem,
      this.getSessionToken(),
    );
  }

  static getQuizProblemById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getQuizProblemById(
      id,
      this.getSessionToken(),
    );
  }

  static getQuizProblemByQuery({ query, page, limit }) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getQuizProblemByQuery(
      query,
      page,
      limit,
      this.getSessionToken(),
    );
  }

  static getQuizProblemBySourceKeyAndSourceType(sourceKey, sourceType) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getQuizProblemBySourceKeyAndSourceType(
      sourceKey,
      sourceType,
      this.getSessionToken(),
    );
  }

  static updateQuizProblem(id, field, value) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.updateQuizProblem(
      id,
      field,
      value,
      this.getSessionToken(),
    );
  }

  /// ////////////////////////////////////////////////
  static getItem(key) {
    return window.electron.ipcRenderer.getStoreValue(key);
  }

  static setItem(key, value) {
    return window.electron.ipcRenderer.setStoreValue(key, value);
  }

  static getInMainlandChina() {
    const v = this.getItem('in_mainland_china');
    return v === true || v === 'true';
  }

  static setInMainlandChina(value) {
    return this.setItem('in_mainland_china', value);
  }

  static getOllamaUrl() {
    return window.electron.ipcRenderer.getOllamaUrl();
  }

  static setOllamaUrl(url) {
    return window.electron.ipcRenderer.setOllamaUrl(url);
  }

  static getServerUrl() {
    return window.electron.ipcRenderer.getServerUrl();
  }

  static setServerUrl(url) {
    return window.electron.ipcRenderer.setServerUrl(url);
  }

  static speakTextBySay(text) {
    return window.electron.ipcRenderer.speakTextBySay(text);
  }

  static getStudyMode() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getStudyMode(this.getSessionToken());
  }

  static setStudyMode(mode) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.setStudyMode(
      mode,
      this.getSessionToken(),
    );
  }

  static async setClaudeModel(mode) {
    if (!this.isLoggedIn()) return null;
    const r = await window.electron.ipcRenderer.setClaudeModel(
      mode,
      this.getSessionToken(),
    );
    await this.setupAiProvider(this.getUserInfo().id);
    return r;
  }

  static getClaudeModel() {
    if (!this.isLoggedIn()) return ClaudeModel.CLAUDE_HAIKU_4_5;
    return window.electron.ipcRenderer.getClaudeModel(this.getSessionToken());
  }

  static async setClaudeAdvancedModel(mode) {
    if (!this.isLoggedIn()) return null;
    const r = await window.electron.ipcRenderer.setClaudeAdvancedModel(
      mode,
      this.getSessionToken(),
    );
    return r;
  }

  static getClaudeAdvancedModel() {
    if (!this.isLoggedIn()) return ClaudeModel.CLAUDE_OPUS_4_5;
    return window.electron.ipcRenderer.getClaudeAdvancedModel(this.getSessionToken());
  }

  static async setGeminiModel(mode) {
    if (!this.isLoggedIn()) return null;
    const r = await window.electron.ipcRenderer.setGeminiModel(
      mode,
      this.getSessionToken(),
    );
    await this.setupAiProvider(this.getUserInfo().id);
    return r;
  }

  static getGeminiModel() {
    if (!this.isLoggedIn()) return GeminiModel.GEMINI_2_5_FLASH;
    return window.electron.ipcRenderer.getGeminiModel(this.getSessionToken());
  }

  static async setGeminiAdvancedModel(mode) {
    if (!this.isLoggedIn()) return null;
    const r = await window.electron.ipcRenderer.setGeminiAdvancedModel(
      mode,
      this.getSessionToken(),
    );
    return r;
  }

  static getGeminiAdvancedModel() {
    if (!this.isLoggedIn()) return GeminiModel.GEMINI_2_5_PRO;
    return window.electron.ipcRenderer.getGeminiAdvancedModel(this.getSessionToken());
  }

  static async setOllamaModel(mode) {
    if (!this.isLoggedIn()) return null;
    const r = await window.electron.ipcRenderer.setOllamaModel(
      mode,
      this.getSessionToken(),
    );
    await this.setupAiProvider(this.getUserInfo().id);
    return r;
  }

  static getOllamaModel() {
    if (!this.isLoggedIn()) return OllamaModel.LLAMA_3_2_3B;
    return window.electron.ipcRenderer.getOllamaModel(this.getSessionToken());
  }

  static async setOllamaAdvancedModel(mode) {
    if (!this.isLoggedIn()) return null;
    const r = await window.electron.ipcRenderer.setOllamaAdvancedModel(
      mode,
      this.getSessionToken(),
    );
    return r;
  }

  static getOllamaAdvancedModel() {
    if (!this.isLoggedIn()) return OllamaModel.LLAMA_3_3_70B;
    return window.electron.ipcRenderer.getOllamaAdvancedModel(this.getSessionToken());
  }

  static async setChatGPTModel(mode) {
    if (!this.isLoggedIn()) return null;
    const r = await window.electron.ipcRenderer.setChatGPTModel(
      mode,
      this.getSessionToken(),
    );
    await this.setupAiProvider(this.getUserInfo().userId);
    return r;
  }

  static getChatGPTModel() {
    if (!this.isLoggedIn()) return ChatGPTModel.GPT4_1_MINI;
    return window.electron.ipcRenderer.getChatGPTModel(this.getSessionToken());
  }

  static async setChatGPTAdvancedModel(mode) {
    if (!this.isLoggedIn()) return null;
    const r = await window.electron.ipcRenderer.setChatGPTAdvancedModel(
      mode,
      this.getSessionToken(),
    );
    return r;
  }

  static getChatGPTAdvancedModel() {
    if (!this.isLoggedIn()) return ChatGPTModel.GPT4_1;
    return window.electron.ipcRenderer.getChatGPTAdvancedModel(this.getSessionToken());
  }

  // Baidu models
  static async setBaiduModel(mode) {
    if (!this.isLoggedIn()) return null;
    const r = await window.electron.ipcRenderer.setBaiduModel(
      mode,
      this.getSessionToken(),
    );
    return r;
  }

  static getBaiduModel() {
    if (!this.isLoggedIn()) return BaiduModel.ERNIE_4_5_TURBO;
    return window.electron.ipcRenderer.getBaiduModel(this.getSessionToken());
  }

  static async setBaiduAdvancedModel(mode) {
    if (!this.isLoggedIn()) return null;
    const r = await window.electron.ipcRenderer.setBaiduAdvancedModel(
      mode,
      this.getSessionToken(),
    );
    return r;
  }

  static getBaiduAdvancedModel() {
    if (!this.isLoggedIn()) return BaiduModel.ERNIE_5;
    return window.electron.ipcRenderer.getBaiduAdvancedModel(this.getSessionToken());
  }

  // Kimi models
  static async setKimiModel(mode) {
    if (!this.isLoggedIn()) return null;
    const r = await window.electron.ipcRenderer.setKimiModel(
      mode,
      this.getSessionToken(),
    );
    return r;
  }

  static getKimiModel() {
    if (!this.isLoggedIn()) return KimiModel.KIMI_K2;
    return window.electron.ipcRenderer.getKimiModel(this.getSessionToken());
  }

  static async setKimiAdvancedModel(mode) {
    if (!this.isLoggedIn()) return null;
    const r = await window.electron.ipcRenderer.setKimiAdvancedModel(
      mode,
      this.getSessionToken(),
    );
    return r;
  }

  static getKimiAdvancedModel() {
    if (!this.isLoggedIn()) return KimiModel.KIMI_K2_5;
    return window.electron.ipcRenderer.getKimiAdvancedModel(this.getSessionToken());
  }

  // Doubao models
  static async setDoubaoModel(mode) {
    if (!this.isLoggedIn()) return null;
    const r = await window.electron.ipcRenderer.setDoubaoModel(
      mode,
      this.getSessionToken(),
    );
    return r;
  }

  static getDoubaoModel() {
    if (!this.isLoggedIn()) return DoubaoModel.DOUBAO_PRO_32K;
    return window.electron.ipcRenderer.getDoubaoModel(this.getSessionToken());
  }

  static async setDoubaoAdvancedModel(mode) {
    if (!this.isLoggedIn()) return null;
    const r = await window.electron.ipcRenderer.setDoubaoAdvancedModel(
      mode,
      this.getSessionToken(),
    );
    return r;
  }

  static getDoubaoAdvancedModel() {
    if (!this.isLoggedIn()) return DoubaoModel.DOUBAO_SEED_1_6;
    return window.electron.ipcRenderer.getDoubaoAdvancedModel(this.getSessionToken());
  }

  // Qwen models
  static async setQwenModel(mode) {
    if (!this.isLoggedIn()) return null;
    const r = await window.electron.ipcRenderer.setQwenModel(
      mode,
      this.getSessionToken(),
    );
    return r;
  }

  static getQwenModel() {
    if (!this.isLoggedIn()) return QwenModel.QWEN_PLUS;
    return window.electron.ipcRenderer.getQwenModel(this.getSessionToken());
  }

  static async setQwenAdvancedModel(mode) {
    if (!this.isLoggedIn()) return null;
    const r = await window.electron.ipcRenderer.setQwenAdvancedModel(
      mode,
      this.getSessionToken(),
    );
    return r;
  }

  static getQwenAdvancedModel() {
    if (!this.isLoggedIn()) return QwenModel.QWEN3_MAX;
    return window.electron.ipcRenderer.getQwenAdvancedModel(this.getSessionToken());
  }

  static fetchPageHeadless(url) {
    return window.electron.ipcRenderer.fetchPageHeadless(url);
  }

  static getLeitnerSpeed() {
    if (!this.isLoggedIn()) return 0;
    return window.electron.ipcRenderer.getLeitnerSpeed(this.getSessionToken());
  }

  static setLeitnerSpeed(speed) {
    if (!this.isLoggedIn()) return 0;
    return window.electron.ipcRenderer.setLeitnerSpeed(
      speed,
      this.getSessionToken(),
    );
  }

  static getNoteBgImage() {
    if (!this.isLoggedIn()) return 0;
    return window.electron.ipcRenderer.getNoteBgImage(this.getSessionToken());
  }

  static setNoteBgImage(bgImageNum) {
    if (!this.isLoggedIn()) return 0;
    return window.electron.ipcRenderer.setNoteBgImage(
      bgImageNum,
      this.getSessionToken(),
    );
  }

  static setFontFamily(fontFamily) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.setFontFamily(
      fontFamily,
      this.getSessionToken(),
    );
  }

  static getFontFamily() {
    if (!this.isLoggedIn()) return 'Arial';
    return window.electron.ipcRenderer.getFontFamily(this.getSessionToken());
  }

  static setNoteColorSetting(colors) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.setNoteColorSetting(
      colors,
      this.getSessionToken(),
    );
  }

  static getNoteColorSetting() {
    if (!this.isLoggedIn()) return ['#000000', '#FFFFFF', '#000000'];
    return window.electron.ipcRenderer.getNoteColorSetting(
      this.getSessionToken(),
    );
  }

  static setReaderLevel(mode) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.setReaderLevel(
      mode,
      this.getSessionToken(),
    );
  }

  static getReaderLevel() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getReaderLevel(this.getSessionToken());
  }

  static getOpenAIKey() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getOpenAIKey(this.getSessionToken());
  }

  static setOpenAIKey(key) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.setOpenAIKey(
      key,
      this.getSessionToken(),
    );
  }

  static getAIProvider() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getAIProvider(this.getSessionToken());
  }

  static setAIProvider(provider) {
    if (!this.isLoggedIn()) return null;
    this.setupAiProvider(this.getUserInfo().id, provider);
    return window.electron.ipcRenderer.setAIProvider(
      provider,
      this.getSessionToken(),
    );
  }

  static getClaudeKey() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getClaudeKey(this.getSessionToken());
  }

  static setClaudeKey(key) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.setClaudeKey(
      key,
      this.getSessionToken(),
    );
  }

  static getBaiduKey() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getBaiduKey(this.getSessionToken());
  }

  static setBaiduKey(key) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.setBaiduKey(key, this.getSessionToken());
  }

  static getBaiduSecret() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getBaiduSecret(this.getSessionToken());
  }

  static setBaiduSecret(key) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.setBaiduSecret(
      key,
      this.getSessionToken(),
    );
  }

  static getBaiduAccessToken() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getBaiduAccessToken(
      this.getSessionToken(),
    );
  }

  static getGeminiKey() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getGeminiKey(this.getSessionToken());
  }

  static setGeminiKey(key) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.setGeminiKey(
      key,
      this.getSessionToken(),
    );
  }

  static getKimiKey() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getKimiKey(this.getSessionToken());
  }

  static setKimiKey(key) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.setKimiKey(key, this.getSessionToken());
  }

  static getDoubaoKey() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getDoubaoKey(this.getSessionToken());
  }

  static setDoubaoKey(key) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.setDoubaoKey(key, this.getSessionToken());
  }

  static getQwenKey() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getQwenKey(this.getSessionToken());
  }

  static setQwenKey(key) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.setQwenKey(key, this.getSessionToken());
  }

  // DeepSeek key
  static getApiKeyDeepSeek() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getDeepSeekKey(this.getSessionToken());
  }

  static setApiKeyDeepSeek(key) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.setDeepSeekKey(key, this.getSessionToken());
  }

  // DeepSeek model
  static async setModelDeepSeek(mode) {
    if (!this.isLoggedIn()) return null;
    const r = await window.electron.ipcRenderer.setDeepSeekModel(
      mode,
      this.getSessionToken(),
    );
    return r;
  }

  static getModelDeepSeek() {
    if (!this.isLoggedIn()) return DeepSeekModel.DEEPSEEK_CHAT;
    return window.electron.ipcRenderer.getDeepSeekModel(this.getSessionToken());
  }

  static getOpenAiImage() {
    if (!this.isLoggedIn()) return false;
    return window.electron.ipcRenderer.getOpenAiImage(this.getSessionToken());
  }

  static setOpenAiImage(flag) {
    if (!this.isLoggedIn()) return false;
    return window.electron.ipcRenderer.setOpenAiImage(
      flag,
      this.getSessionToken(),
    );
  }

  static addToVocabulary(text) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.addToVocabulary(
      text,
      this.getSessionToken(),
    );
  }

  static addToKeyWordList(mode, word) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.addToKeyWordList(
      mode,
      word,
      this.getSessionToken(),
    );
  }

  static setKeyWordList(mode, words) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.setKeyWordList(
      mode,
      words,
      this.getSessionToken(),
    );
  }

  static removeFromKeyWordList(mode, word) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.removeFromKeyWordList(
      mode,
      word,
      this.getSessionToken(),
    );
  }

  static sentenceTokenizer(paragraph) {
    return window.electron.ipcRenderer.sentenceTokenizer(paragraph);
  }

  static getKeyWordList(mode) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getKeyWordList(
      mode,
      this.getSessionToken(),
    );
  }

  static getRecentURL() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getRecentURL(this.getSessionToken());
  }

  static addToRecentURL(url) {
    if (!this.isLoggedIn() || !url) return null;
    return window.electron.ipcRenderer.addToRecentURL(
      url,
      this.getSessionToken(),
    );
  }

  static getOneInCollection(name, keyName, keyValue) {
    return window.electron.ipcRenderer.getOneInCollection(
      name,
      keyName,
      keyValue,
    );
  }

  static semanticQuery(query, nResults, condition) {
    return window.electron.ipcRenderer.semanticQuery(
      query,
      nResults,
      condition,
    );
  }

  static queryCollection(name, query, fieldOne, fieldTwo) {
    return window.electron.ipcRenderer.queryCollection(
      name,
      query,
      fieldOne,
      fieldTwo,
    );
  }

  static deleteCollectionInStore(name, keyName, keyValue) {
    return window.electron.ipcRenderer.deleteCollectionInStore(
      name,
      keyName,
      keyValue,
    );
  }

  static removeItem(key) {
    return window.electron.ipcRenderer.deleteStoreValue(key);
  }

  static getReaderConfig(key) {
    const v0 = window.electron.ipcRenderer.getStoreValue('readerConfig');
    const readerConfig = v0 ? JSON5.parse(v0) : {};
    return readerConfig[key];
  }

  static setReaderConfig(key, value) {
    const v0 = window.electron.ipcRenderer.getStoreValue('readerConfig');
    const readerConfig = v0 ? JSON5.parse(v0) : {};
    readerConfig[key] = value;
    customStorage.setItem('readerConfig', JSON.stringify(readerConfig));
  }

  // Graph database settings
  static getGraphEnabled() {
    return window.electron.ipcRenderer.getStoreValue('graph.enabled') ?? true;
  }

  static setGraphEnabled(enabled) {
    return window.electron.ipcRenderer.setStoreValue('graph.enabled', enabled);
  }

  static getGraphUri() {
    return (
      window.electron.ipcRenderer.getStoreValue('graph.connectionUri') ||
      'bolt://localhost:7687'
    );
  }

  static setGraphUri(uri) {
    return window.electron.ipcRenderer.setStoreValue('graph.connectionUri', uri);
  }

  static getGraphUsername() {
    return (
      window.electron.ipcRenderer.getStoreValue('graph.username') || 'neo4j'
    );
  }

  static setGraphUsername(username) {
    return window.electron.ipcRenderer.setStoreValue('graph.username', username);
  }

  static getGraphPassword() {
    return window.electron.ipcRenderer.getStoreValue('graph.password') || '';
  }

  static setGraphPassword(password) {
    return window.electron.ipcRenderer.setStoreValue('graph.password', password);
  }
}

export default customStorage;
