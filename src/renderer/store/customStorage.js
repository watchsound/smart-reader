import JSON5 from 'json5';
import { loginHandled, logoutHandled } from './reducers/userSlice';
import {
  AIProvider,
  ChatGPTModel,
  ClaudeModel,
  GeminiModel,
} from '../../commons/model/DataTypes';
import aiProviderManager from '../../commons/service/AIProviderManager';

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
      model = await this.getChatGPTModel();
    } else if (provider === AIProvider.Gemini) {
      model = await this.getGeminiModel();
    } else if (provider === AIProvider.Claude) {
      model = await this.getClaudeModel();
    } else if (provider === AIProvider.Baidu) {
      model = await this.getBaiduAccessToken();  // ugly but....
    }

    aiProviderManager.setup(true, userId, provider, key, model);
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

  static register(user, email, password) {
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


  static deleteBookById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteBookById(
      id,
      this.getSessionToken(),
    );
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

  static deleteMessageById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteMessageById(
      id,
      this.getSessionToken(),
    );
  }

  static deletePromptById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deletePromptById(
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

  static deleteAllBook() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteAllBook(this.getSessionToken());
  }

  static deleteAllBookmark() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteAllBookmark(
      this.getSessionToken(),
    );
  }

  static deleteAllChat() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteAllChat(this.getSessionToken());
  }

  static deleteAllMessage() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteAllMessage(this.getSessionToken());
  }

  static deleteAllNote() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteAllNote(this.getSessionToken());
  }

  static deleteAllPrompt() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteAllPrompt(this.getSessionToken());
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

  static getBookmarkGroupById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getBookmarkGroupById(
      id,
      this.getSessionToken(),
    );
  }

  static getTopBookmarkGroup() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getTopBookmarkGroup(
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

  static deleteAllBookmarkGroups() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteAllBookmarkGroups(
      this.getSessionToken(),
    );
  }

  static getHistoryGroupById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getHistoryGroupById(
      id,
      this.getSessionToken(),
    );
  }

  static getHistoryGroupByName(groupName) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getHistoryGroupByName(
      groupName,
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

  static deleteAllHistoryGroups() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteAllHistoryGroups(
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

  static getHistoryById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getHistoryById(
      id,
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

  static deleteAllHistories() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteAllHistories(
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
  static createBook(book) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.createBook(book, this.getSessionToken());
  }

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

  static getBookmarkById(bookmarkId) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getBookmarkById(
      bookmarkId,
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

  static getVocabularyById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getVocabularyById(
      id,
      this.getSessionToken(),
    );
  }

  static getLeitnerItemById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getLeitnerItemById(id);
  }

  static createLeitnerItem(leitnerItem) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.createLeitnerItem(leitnerItem);
  }

  static deleteLeitnerItemById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteLeitnerItemById(id);
  }

  static updateLeitnerItem({ id, field, value }) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.updateLeitnerItem(id, field, value);
  }

  // vocabulary
  static getVocabularyById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getVocabularyById(
      id,
      this.getSessionToken(),
    );
  }

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

  static deleteVocabularyById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteVocabularyById(
      id,
      this.getSessionToken(),
    );
  }

  static deleteAllVocabulary() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteAllVocabulary(
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
  static getVocabularySetById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.getVocabularySetById(
      id,
      this.getSessionToken(),
    );
  }

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

  static updateVocabularySet({ id, field, value }) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.updateVocabularySet(
      id,
      field,
      value,
      this.getSessionToken(),
    );
  }

  static updateVocabularySetByTime(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.updateVocabularySetByTime(
      id,
      this.getSessionToken(),
    );
  }

  static deleteVocabularySetById(id) {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteVocabularySetById(
      id,
      this.getSessionToken(),
    );
  }

  static deleteAllVocabularySet() {
    if (!this.isLoggedIn()) return null;
    return window.electron.ipcRenderer.deleteAllVocabularySet(
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

  static getChromaUrl() {
    return window.electron.ipcRenderer.getChromaUrl();
  }

  static setChromaUrl(url) {
    return window.electron.ipcRenderer.setChromaUrl(url);
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
    if (!this.isLoggedIn()) return ClaudeModel.CLAUDE_3_HAIKU;
    return window.electron.ipcRenderer.getClaudeModel(this.getSessionToken());
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
    if (!this.isLoggedIn()) return GeminiModel.GEMINI1_5_flash;
    return window.electron.ipcRenderer.getGeminiModel(this.getSessionToken());
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
    if (!this.isLoggedIn()) return ChatGPTModel.GPT3_5;
    return window.electron.ipcRenderer.getChatGPTModel(this.getSessionToken());
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

  static getUseChroma() {
    if (!this.isLoggedIn()) return false;
    return window.electron.ipcRenderer.getUseChroma(this.getSessionToken());
  }

  static setUseChroma(flag) {
    if (!this.isLoggedIn()) return false;
    return window.electron.ipcRenderer.setUseChroma(
      flag,
      this.getSessionToken(),
    );
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

  static getByIdsInCollection(name, keyName, keyList) {
    return window.electron.ipcRenderer.getByIdsInCollection(
      name,
      keyName,
      keyList,
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

  static upSertCollectionInStore(name, keyName, keyValue, obj) {
    return window.electron.ipcRenderer.upSertCollectionInStore(
      name,
      keyName,
      keyValue,
      obj,
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
}

export default customStorage;
