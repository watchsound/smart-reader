/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
/* eslint-disable promise/always-return */
// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import ePub from 'epubjs';

export type Channels = 'ipc-example';

const electronHandler = {
  ipcRenderer: {
    invoke(channel: string, ...args: any[]): Promise<any> {
      return ipcRenderer.invoke(channel, ...args);
    },

    on(channel: string, func: (...args: unknown[]) => void) {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);
      // Return an unsubscribe so React effects can clean up. Callers that
      // pass `func` to removeListener can't — the wrapper is what was
      // actually registered, so the user-visible handler reference is
      // never the right key. Using this return is the only way to unhook.
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once(channel: string, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },
    /* common api */
    sendMessage(channel: string, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },
    /**
     * If you need to transfer a `MessagePort` to the main process, use
     * `ipcRenderer.postMessage`.
     *
     * If you want to receive a single response from the main process, like the result
     * of a method call, consider using `ipcRenderer.invoke`.
     */
    send(channel: string, ...args: any[]): void {
      ipcRenderer.send(channel, ...args);
    },
    sendSync(channel: string, ...args: any[]): any {
      return ipcRenderer.sendSync(channel, ...args);
    },

    removeAllListeners(channel: string): void {
      ipcRenderer.removeAllListeners(channel);
    },

    removeListener(channel: string, listener: (...args: any[]) => void): void {
      ipcRenderer.removeListener(channel, listener);
    },

    /** **************************************************** */
    emojiData: () => {
      return ipcRenderer.invoke('emojiData');
    },

    savePDF4URL: (id: number, url: string) => {
      return ipcRenderer.sendSync('savePDF4URL', { id, url });
    },
    getPDF4URL: (id: number) => {
      return ipcRenderer.sendSync('getPDF4URL', { id });
    },
    // sql related

    deleteBookmarkById: (id: number, token: string) => {
      return ipcRenderer.sendSync('deleteBookmarkById', { id, token });
    },
    deleteChatById: (id: number, token: string) => {
      return ipcRenderer.sendSync('deleteChatById', { id, token });
    },
    deleteNoteById: (id: number, token: string) => {
      return ipcRenderer.sendSync('deleteNoteById', { id, token });
    },
    addNoteToLeitnerStudy: (id: number, token: string) => {
      return ipcRenderer.sendSync('addNoteToLeitnerStudy', { id, token });
    },
    deleteQuizProblemById: (id: number, token: string) => {
      return ipcRenderer.sendSync('deleteQuizProblemById', { id, token });
    },

    deleteAllChat: (token: string) => {
      return ipcRenderer.sendSync('deleteAllChat', { token });
    },
    deleteAllQuizProblem: (token: string) => {
      return ipcRenderer.sendSync('deleteAllQuizProblem', { token });
    },
    deleteAllNote: (token: string) => {
      return ipcRenderer.sendSync('deleteAllNote', { token });
    },

    createBookmarkGroup: (
      parentGroupId: number,
      name: string,
      token: string,
    ) => {
      return ipcRenderer.sendSync('createBookmarkGroup', {
        parentGroupId,
        name,
        token,
      });
    },
    jsonBookmarkGroupStructure: (token: string) => {
      return ipcRenderer.sendSync('jsonBookmarkGroupStructure', { token });
    },
    printBookmarkGroupStructure: (gapChar: string, token: string) => {
      return ipcRenderer.sendSync('printBookmarkGroupStructure', {
        gapChar,
        token,
      });
    },
    getBookmarkGroupByName: (name: string, token: string) => {
      return ipcRenderer.sendSync('getBookmarkGroupByName', { name, token });
    },
    renameBookmarkGroup: (id: number, name: string, token: string) => {
      return ipcRenderer.sendSync('renameBookmarkGroup', { id, name, token });
    },

    createHistoryGroup: (name: string, token: string) => {
      return ipcRenderer.sendSync('createHistoryGroup', {
        name,
        token,
      });
    },
    getHistoryGroupByQuery: (
      query: string,
      page: number,
      limit: number,
      token: string,
    ) => {
      return ipcRenderer.sendSync('getHistoryGroupByQuery', {
        query,
        page,
        limit,
        token,
      });
    },

    createHistory: (history: any, token: string) => {
      return ipcRenderer.invoke('createHistory', { history, token });
    },
    getHistoryByQuery: (
      sourceType: string,
      query: string,
      page: number,
      limit: number,
      token: string,
    ) => {
      return ipcRenderer.sendSync('getHistoryByQuery', {
        sourceType,
        query,
        page,
        limit,
        token,
      });
    },
    getHistoryByGroupIdAndSourceKey: (
      id: number,
      sourceKey: string,
      token: string,
    ) => {
      return ipcRenderer.sendSync('getHistoryByGroupIdAndSourceKey', {
        id,
        sourceKey,
        token,
      });
    },
    getHistoriesByGroupId: (id: number, token: string) => {
      return ipcRenderer.sendSync('getHistoriesByGroupId', { id, token });
    },
    updateHistory: (id: number, description: string, token: string) => {
      return ipcRenderer.sendSync('updateHistory', { id, description, token });
    },
    addContentToInMemoryVectorDB: (content: string) => {
      return ipcRenderer.invoke('addContentToInMemoryVectorDB', { content });
    },
    queryInMemoryVectorDB: (content: string) => {
      return ipcRenderer.invoke('queryInMemoryVectorDB', { content });
    },
    createBookshelf: (name: string, token: string) => {
      return ipcRenderer.sendSync('createBookshelf', { name, token });
    },
    renameBookshelf: (id: number, name: string, token: string) => {
      return ipcRenderer.sendSync('renameBookshelf', { id, name, token });
    },
    deleteAllBookshelf: (token: string) => {
      return ipcRenderer.sendSync('deleteAllBookshelf', { token });
    },
    deleteBookshelfById: (bookshelfId: string, token: string) => {
      return ipcRenderer.sendSync('deleteBookshelfById', {
        bookshelfId,
        token,
      });
    },
    getAllBookshelf: (token: string) => {
      return ipcRenderer.sendSync('getAllBookshelf', { token });
    },
    getBookshelfById: (bookshelfId: string, token: string) => {
      return ipcRenderer.sendSync('getBookshelfById', { bookshelfId, token });
    },

    createBook: (book: any, token: string) => {
      return ipcRenderer.sendSync('createBook', { book, token });
    },

    getBookById: (bookId: number, token: string) => {
      return ipcRenderer.sendSync('getBookById', { bookId, token });
    },
    getBookByIdFromServer: (idFromServer: number, token: string) => {
      return ipcRenderer.sendSync('getBookByIdFromServer', {
        idFromServer,
        token,
      });
    },
    getBooksByCategory: (category: string, token: string) => {
      return ipcRenderer.sendSync('getBooksByCategory', { category, token });
    },

    getBooksByBookshelfId: (bookshelfId: number, token: string) => {
      return ipcRenderer.sendSync('getBooksByBookshelfId', {
        bookshelfId,
        token,
      });
    },

    changeBookshelf: (bookId: number, newId: number, token: string) => {
      return ipcRenderer.sendSync('changeBookshelf', { bookId, newId, token });
    },

    getBooksByQuery: (query: string, token: string) => {
      return ipcRenderer.invoke('getBooksByQuery', { query, token });
    },

    getBooks: (token: string) => {
      return ipcRenderer.sendSync('getBooks', { token });
    },

    updateBook: (
      noteId: number,
      field: string,
      value: string,
      token: string,
    ) => {
      return ipcRenderer.sendSync('updateBook', {
        noteId,
        field,
        value,
        token,
      });
    },

    getBookmarksByGroupId: (groupId: number, token: string) => {
      return ipcRenderer.sendSync('getBookmarksByGroupId', { groupId, token });
    },
    getBookmarksRecursiveByGroupId: (groupId: number, token: string) => {
      return ipcRenderer.sendSync('getBookmarksRecursiveByGroupId', {
        groupId,
        token,
      });
    },

    createBookmark: (url: string, token: string) => {
      return ipcRenderer.invoke('createBookmark', { url, token });
    },

    getBookmarkByQuery: (query: string, token: string) => {
      return ipcRenderer.sendSync('getBookmarkByQuery', { query, token });
    },

    getBookmarksBySourceKey: (
      sourceKey: string,
      sourceType: string,
      token: string,
    ) => {
      return ipcRenderer.sendSync('getBookmarksBySourceKey', {
        sourceKey,
        sourceType,
        token,
      });
    },

    updateBookmark: (
      noteId: number,
      field: string,
      value: string,
      token: string,
    ) => {
      return ipcRenderer.sendSync('updateBookmark', {
        noteId,
        field,
        value,
        token,
      });
    },

    createMoodBoard: (moodBoard: number, token: string) => {
      return ipcRenderer.sendSync('createMoodBoard', { moodBoard, token });
    },
    getMoodBoardById: (id: number, token: string) => {
      return ipcRenderer.sendSync('getMoodBoardById', { id, token });
    },
    getMoodBoardsByQuery: (
      query: string,
      page: number,
      limit: number,
      token: string,
    ) => {
      return ipcRenderer.sendSync('getMoodBoardsByQuery', {
        query,
        page,
        limit,
        token,
      });
    },
    updateMoodBoard: (
      id: number,
      field: string,
      value: string | number,
      token: string,
    ) => {
      return ipcRenderer.sendSync('updateMoodBoard', {
        id,
        field,
        value,
        token,
      });
    },
    deleteMoodBoardById: (id: number, token: string) => {
      return ipcRenderer.sendSync('deleteMoodBoardById', { id, token });
    },
    deleteAllMoodBoards: (token: string) => {
      return ipcRenderer.sendSync('deleteAllMoodBoards', { token });
    },

    createChat: (chat: any, token: string) => {
      return ipcRenderer.sendSync('createChat', { chat, token });
    },

    getChatById: (id: number, token: string) => {
      return ipcRenderer.sendSync('getChatById', { id, token });
    },

    getPinnedChats: (token: string) => {
      return ipcRenderer.sendSync('getPinnedChats', { token });
    },
    getPinnedLearnAbout: (token: string) => {
      return ipcRenderer.sendSync('getPinnedLearnAbout', { token });
    },

    getLearnAboutByQuery: (
      query: string,
      page: number,
      limit: number,
      token: string,
    ) => {
      return ipcRenderer.sendSync('getLearnAboutByQuery', {
        query,
        page,
        limit,
        token,
      });
    },

    getChatsByQuery: (
      query: string,
      page: number,
      limit: number,
      token: string,
    ) => {
      return ipcRenderer.sendSync('getChatsByQuery', {
        query,
        page,
        limit,
        token,
      });
    },

    updateChat: (id: number, field: string, value: string, token: string) => {
      return ipcRenderer.sendSync('updateChat', {
        id,
        field,
        value,
        token,
      });
    },

    fetchPageHeadless: (url: string) => {
      return ipcRenderer.invoke('fetchPageHeadless', { url });
    },

    createMessage: (message: any, token: string) => {
      // console.log("preload message = ");
      return ipcRenderer.sendSync('createMessage', { message, token });
    },

    getMessageById: (id: number, token: string) => {
      return ipcRenderer.sendSync('getMessageById', { id, token });
    },

    getMessagesByChatId: (id: number, token: string) => {
      return ipcRenderer.sendSync('getMessagesByChatId', { id, token });
    },

    getMessageByQuery: (query: string, token: string) => {
      return ipcRenderer.invoke('getMessageByQuery', { query, token });
    },

    updateMessage: (
      id: number,
      field: string,
      value: string,
      token: string,
    ) => {
      return ipcRenderer.sendSync('updateMessage', {
        id,
        field,
        value,
        token,
      });
    },

    createNote: (note: any, token: string) => {
      return ipcRenderer.sendSync('createNote', { note, token });
    },

    getNoteById: (id: number, token: string) => {
      return ipcRenderer.sendSync('getNoteById', { id, token });
    },

    getNotesByIds: (ids: number, token: string) => {
      return ipcRenderer.sendSync('getNotesByIds', { ids, token });
    },
    getNotesByDueReview: (
      dueTime: Date,
      page: number,
      limit: number,
      token: string,
    ) => {
      return ipcRenderer.sendSync('getNotesByDueReview', {
        dueTime,
        page,
        limit,
        token,
      });
    },
    getNotesByQuery: (
      query: string,
      tag: string,
      star: number,
      page: number,
      limit: number,
      token: string,
    ) => {
      return ipcRenderer.invoke('getNotesByQuery', {
        query,
        tag,
        star,
        page,
        limit,
        token,
      });
    },

    queryNoteBySourceKeyAndSourceType: (
      sourceKey: string,
      sourceType: string,
      token: string,
    ) => {
      return ipcRenderer.sendSync('queryNoteBySourceKeyAndSourceType', {
        sourceKey,
        sourceType,
        token,
      });
    },

    updateNote: (
      noteId: number,
      field: string,
      value: string,
      token: string,
    ) => {
      return ipcRenderer.sendSync('updateNote', {
        noteId,
        field,
        value,
        token,
      });
    },

    clearNotesBy: (sourceKey: number, sourceType: string, token: string) => {
      return ipcRenderer.sendSync('clearNotesBy', {
        sourceKey,
        sourceType,
        token,
      });
    },

    replaceNote: (noteId: number, note: any, token: string) => {
      return ipcRenderer.sendSync('replaceNote', {
        noteId,
        note,
        token,
      });
    },

    updateNoteCard: (
      noteId: number,
      cardIndex: number,
      field: string,
      value: string,
      token: string,
    ) => {
      return ipcRenderer.sendSync('updateNoteCard', {
        noteId,
        cardIndex,
        field,
        value,
        token,
      });
    },

    createPrompt: (prompt: any, token: string) => {
      return ipcRenderer.sendSync('createPrompt', { prompt, token });
    },

    getPromptById: (id: number, token: string) => {
      return ipcRenderer.sendSync('getPromptById', { id, token });
    },

    getPromptsByQuery: (
      query: string,
      page: number,
      limit: number,
      token: string,
    ) => {
      return ipcRenderer.sendSync('getPromptsByQuery', {
        query,
        page,
        limit,
        token,
      });
    },

    getPromptsBySource: (source: string, token: string) => {
      return ipcRenderer.sendSync('getPromptsBySource', { source, token });
    },

    updatePrompt: (id: number, field: string, value: string, token: string) => {
      return ipcRenderer.sendSync('updatePrompt', {
        id,
        field,
        value,
        token,
      });
    },

    createQuizProblem: (quizProblem: any, token: string) => {
      return ipcRenderer.sendSync('createQuizProblem', { quizProblem, token });
    },

    getQuizProblemById: (id: number, token: string) => {
      return ipcRenderer.sendSync('getQuizProblemById', { id, token });
    },

    getQuizProblemByQuery: (
      query: string,
      page: number,
      limit: number,
      token: string,
    ) => {
      return ipcRenderer.sendSync('getQuizProblemByQuery', {
        query,
        page,
        limit,
        token,
      });
    },

    getQuizProblemBySourceKeyAndSourceType: (
      sourceKey: string,
      sourceType: string,
      token: string,
    ) => {
      return ipcRenderer.sendSync('getQuizProblemBySourceKeyAndSourceType', {
        sourceKey,
        sourceType,
        token,
      });
    },

    updateQuizProblem: (
      id: number,
      field: string,
      value: string,
      token: string,
    ) => {
      return ipcRenderer.sendSync('updateQuizProblem', {
        id,
        field,
        value,
        token,
      });
    },

    //
    getVocabularyByName: (name: string, token: string) => {
      return ipcRenderer.sendSync('getVocabularyByName', { name, token });
    },
    createVocabulary: (vocabulary: any, token: string) => {
      return ipcRenderer.sendSync('createVocabulary', { vocabulary, token });
    },
    getVocabulariesBySetId: (setId: number, token: string) => {
      return ipcRenderer.sendSync('getVocabulariesBySetId', { setId, token });
    },
    getVocabulariesByDueReview: (
      dueTime: Date,
      page: number,
      limit: number,
      token: string,
    ) => {
      return ipcRenderer.sendSync('getVocabulariesByDueReview', {
        dueTime,
        page,
        limit,
        token,
      });
    },
    getVocabulariesByQuery: (
      query: string,
      page: number,
      limit: number,
      token: string,
    ) => {
      return ipcRenderer.sendSync('getVocabulariesByQuery', {
        query,
        page,
        limit,
        token,
      });
    },
    updateVocabulary: (
      id: number,
      field: string,
      value: any,
      token: string,
    ) => {
      return ipcRenderer.sendSync('updateVocabulary', {
        id,
        field,
        value,
        token,
      });
    },
    addVocabularyToSet: (id: number, setId: number, token: string) => {
      return ipcRenderer.sendSync('addVocabularyToSet', { id, setId, token });
    },
    //
    createVocabularySet: (vocabularySet: any, token: string) => {
      return ipcRenderer.sendSync('createVocabularySet', {
        vocabularySet,
        token,
      });
    },
    getVocabularySetByQuery: (
      query: string,
      page: number,
      limit: number,
      token: string,
    ) => {
      return ipcRenderer.sendSync('getVocabularySetByQuery', {
        query,
        page,
        limit,
        token,
      });
    },
    getBookContentByQuery: (
      bookKey: string,
      bookType: string,
      query: string,
      token: string,
    ) => {
      return ipcRenderer.invoke('getBookContentByQuery', {
        bookKey,
        bookType,
        query,
        token,
      });
    },
    /** **************************************************** */
    /**  save/query operations  related to store */
    setStoreValue: (key: string, value: any) => {
      return ipcRenderer.sendSync('setStoreValue', key, value);
    },

    deleteCollectionInStore: (name: string, keyName: string, keyValue: any) => {
      return ipcRenderer.sendSync(
        'deleteCollectionInStore',
        name,
        keyName,
        keyValue,
      );
    },

    /**
     *
     * @param query
     * @param sourceType sourceType:  [note, epub]
     * @param nResults n of result.
     * @returns responseObject = { ids:[] documents:[]}
     */
    semanticQuery(query: string, nResults: number, condition: object) {
      return ipcRenderer.invoke('semanticQuery', query, nResults, condition);
    },
    getOneInCollection(name: string, keyName: string, keyValue: any) {
      const resp = ipcRenderer.sendSync(
        'getOneInCollection',
        name,
        keyName,
        keyValue,
      );
      return resp;
    },

    queryCollection(
      name: string,
      query: string,
      fieldOne: string,
      fieldTwo: string,
    ) {
      const resp = ipcRenderer.sendSync(
        'queryCollection',
        name,
        query,
        fieldOne,
        fieldTwo || '',
      );
      return resp;
    },
    getStoreValue(key: string) {
      const resp = ipcRenderer.sendSync('getStoreValue', key);
      return resp;
    },
    deleteStoreValue: (key: string) => {
      return ipcRenderer.sendSync('deleteStoreValue', key);
    },

    /** **************************************************** */

    login(email: string, password: string) {
      return ipcRenderer.invoke('login', email, password);
    },
    register(user: string, email: string, password: string) {
      return ipcRenderer.invoke('register', user, email, password);
    },
    logout(token: string) {
      return ipcRenderer.invoke('logout', token);
    },
    validateSession(token: string) {
      return ipcRenderer.invoke('validateSession', token);
    },
    getNoteBgImage(token: string) {
      return ipcRenderer.invoke('getNoteBgImage', token);
    },
    setNoteBgImage(imageNum: number, token: string) {
      return ipcRenderer.invoke('setNoteBgImage', { imageNum, token });
    },
    getFontFamily(token: string) {
      const resp = ipcRenderer.sendSync('getFontFamily', token);
      return resp;
    },
    setFontFamily(fontFamily: string, token: string) {
      const resp = ipcRenderer.sendSync('setFontFamily', { fontFamily, token });
      return resp;
    },
    getNoteColorSetting(token: string) {
      const resp = ipcRenderer.sendSync('getNoteColorSetting', token);
      return resp;
    },
    setNoteColorSetting(colors: string[], token: string) {
      const resp = ipcRenderer.sendSync('setNoteColorSetting', {
        colors,
        token,
      });
      return resp;
    },
    getClaudeModel(token: string) {
      const resp = ipcRenderer.sendSync('getClaudeModel', token);
      return resp;
    },
    setClaudeModel(mode: string, token: string) {
      const resp = ipcRenderer.sendSync('setClaudeModel', { mode, token });
      return resp;
    },
    getClaudeAdvancedModel(token: string) {
      const resp = ipcRenderer.sendSync('getClaudeAdvancedModel', token);
      return resp;
    },
    setClaudeAdvancedModel(mode: string, token: string) {
      const resp = ipcRenderer.sendSync('setClaudeAdvancedModel', {
        mode,
        token,
      });
      return resp;
    },
    getBaiduModel(token: string) {
      const resp = ipcRenderer.sendSync('getBaiduModel', token);
      return resp;
    },
    setBaiduModel(mode: string, token: string) {
      const resp = ipcRenderer.sendSync('setBaiduModel', { mode, token });
      return resp;
    },
    getBaiduAdvancedModel(token: string) {
      const resp = ipcRenderer.sendSync('getBaiduAdvancedModel', token);
      return resp;
    },
    setBaiduAdvancedModel(mode: string, token: string) {
      const resp = ipcRenderer.sendSync('setBaiduAdvancedModel', {
        mode,
        token,
      });
      return resp;
    },
    getKimiModel(token: string) {
      const resp = ipcRenderer.sendSync('getKimiModel', token);
      return resp;
    },
    setKimiModel(mode: string, token: string) {
      const resp = ipcRenderer.sendSync('setKimiModel', { mode, token });
      return resp;
    },
    getKimiAdvancedModel(token: string) {
      const resp = ipcRenderer.sendSync('getKimiAdvancedModel', token);
      return resp;
    },
    setKimiAdvancedModel(mode: string, token: string) {
      const resp = ipcRenderer.sendSync('setKimiAdvancedModel', {
        mode,
        token,
      });
      return resp;
    },
    getDoubaoModel(token: string) {
      const resp = ipcRenderer.sendSync('getDoubaoModel', token);
      return resp;
    },
    setDoubaoModel(mode: string, token: string) {
      const resp = ipcRenderer.sendSync('setDoubaoModel', { mode, token });
      return resp;
    },
    getDoubaoAdvancedModel(token: string) {
      const resp = ipcRenderer.sendSync('getDoubaoAdvancedModel', token);
      return resp;
    },
    setDoubaoAdvancedModel(mode: string, token: string) {
      const resp = ipcRenderer.sendSync('setDoubaoAdvancedModel', {
        mode,
        token,
      });
      return resp;
    },
    getQwenModel(token: string) {
      const resp = ipcRenderer.sendSync('getQwenModel', token);
      return resp;
    },
    setQwenModel(mode: string, token: string) {
      const resp = ipcRenderer.sendSync('setQwenModel', { mode, token });
      return resp;
    },
    getQwenAdvancedModel(token: string) {
      const resp = ipcRenderer.sendSync('getQwenAdvancedModel', token);
      return resp;
    },
    setQwenAdvancedModel(mode: string, token: string) {
      const resp = ipcRenderer.sendSync('setQwenAdvancedModel', {
        mode,
        token,
      });
      return resp;
    },
    getOllamaModel(token: string) {
      const resp = ipcRenderer.sendSync('getOllamaModel', token);
      return resp;
    },
    setOllamaModel(mode: string, token: string) {
      const resp = ipcRenderer.sendSync('setOllamaModel', { mode, token });
      return resp;
    },
    getOllamaAdvancedModel(token: string) {
      const resp = ipcRenderer.sendSync('getOllamaAdvancedModel', token);
      return resp;
    },
    setOllamaAdvancedModel(mode: string, token: string) {
      const resp = ipcRenderer.sendSync('setOllamaAdvancedModel', {
        mode,
        token,
      });
      return resp;
    },
    getGeminiModel(token: string) {
      const resp = ipcRenderer.sendSync('getGeminiModel', token);
      return resp;
    },
    setGeminiModel(mode: string, token: string) {
      const resp = ipcRenderer.sendSync('setGeminiModel', { mode, token });
      return resp;
    },
    getGeminiAdvancedModel(token: string) {
      const resp = ipcRenderer.sendSync('getGeminiAdvancedModel', token);
      return resp;
    },
    setGeminiAdvancedModel(mode: string, token: string) {
      const resp = ipcRenderer.sendSync('setGeminiAdvancedModel', {
        mode,
        token,
      });
      return resp;
    },
    getChatGPTModel(token: string) {
      const resp = ipcRenderer.sendSync('getChatGPTModel', token);
      return resp;
    },
    setChatGPTModel(mode: string, token: string) {
      const resp = ipcRenderer.sendSync('setChatGPTModel', { mode, token });
      return resp;
    },
    getChatGPTAdvancedModel(token: string) {
      const resp = ipcRenderer.sendSync('getChatGPTAdvancedModel', token);
      return resp;
    },
    setChatGPTAdvancedModel(mode: string, token: string) {
      const resp = ipcRenderer.sendSync('setChatGPTAdvancedModel', {
        mode,
        token,
      });
      return resp;
    },
    getLeitnerSpeed(token: string) {
      const resp = ipcRenderer.sendSync('getLeitnerSpeed', token);
      return resp;
    },
    setLeitnerSpeed(speed: number, token: string) {
      const resp = ipcRenderer.sendSync('setLeitnerSpeed', { speed, token });
      return resp;
    },
    getReaderLevel(token: string) {
      const resp = ipcRenderer.sendSync('getReaderLevel', token);
      return resp;
    },
    setReaderLevel(mode: string, token: string) {
      const resp = ipcRenderer.sendSync('setReaderLevel', { mode, token });
      return resp;
    },
    getStudyMode(token: string) {
      const resp = ipcRenderer.sendSync('getStudyMode', token);
      return resp;
    },
    setStudyMode(mode: string, token: string) {
      const resp = ipcRenderer.sendSync('setStudyMode', { mode, token });
      return resp;
    },
    getOpenAiImage(token: string) {
      const resp = ipcRenderer.sendSync('getOpenAiImage', token);
      return resp;
    },
    setOpenAiImage(key: boolean, token: string) {
      const resp = ipcRenderer.sendSync('setOpenAiImage', { key, token });
      return resp;
    },
    getAIProvider(token: string) {
      const resp = ipcRenderer.sendSync('getAIProvider', token);
      return resp;
    },
    setAIProvider(provider: string, token: string) {
      const resp = ipcRenderer.sendSync('setAIProvider', { provider, token });
      return resp;
    },
    getOpenAIKey(token: string) {
      const resp = ipcRenderer.sendSync('getOpenAIKey', token);
      return resp;
    },
    setOpenAIKey(key: string, token: string) {
      const resp = ipcRenderer.sendSync('setOpenAIKey', { key, token });
      return resp;
    },
    getGeminiKey(token: string) {
      const resp = ipcRenderer.sendSync('getGeminiKey', token);
      return resp;
    },
    setGeminiKey(key: string, token: string) {
      const resp = ipcRenderer.sendSync('setGeminiKey', { key, token });
      return resp;
    },
    getClaudeKey(token: string) {
      const resp = ipcRenderer.sendSync('getClaudeKey', token);
      return resp;
    },
    setClaudeKey(key: string, token: string) {
      const resp = ipcRenderer.sendSync('setClaudeKey', { key, token });
      return resp;
    },
    getBaiduKey(token: string) {
      const resp = ipcRenderer.sendSync('getBaiduKey', token);
      return resp;
    },
    setBaiduKey(key: string, token: string) {
      const resp = ipcRenderer.sendSync('setBaiduKey', { key, token });
      return resp;
    },
    getBaiduSecret(token: string) {
      const resp = ipcRenderer.sendSync('getBaiduSecret', token);
      return resp;
    },
    setBaiduSecret(key: string, token: string) {
      const resp = ipcRenderer.sendSync('setBaiduSecret', { key, token });
      return resp;
    },
    getBaiduAccessToken(token: string) {
      return ipcRenderer.invoke('getBaiduAccessToken', token);
    },
    getKimiKey(token: string) {
      const resp = ipcRenderer.sendSync('getKimiKey', token);
      return resp;
    },
    setKimiKey(key: string, token: string) {
      const resp = ipcRenderer.sendSync('setKimiKey', { key, token });
      return resp;
    },
    getDoubaoKey(token: string) {
      const resp = ipcRenderer.sendSync('getDoubaoKey', token);
      return resp;
    },
    setDoubaoKey(key: string, token: string) {
      const resp = ipcRenderer.sendSync('setDoubaoKey', { key, token });
      return resp;
    },
    getQwenKey(token: string) {
      const resp = ipcRenderer.sendSync('getQwenKey', token);
      return resp;
    },
    setQwenKey(key: string, token: string) {
      const resp = ipcRenderer.sendSync('setQwenKey', { key, token });
      return resp;
    },
    getDeepSeekKey(token: string) {
      const resp = ipcRenderer.sendSync('getDeepSeekKey', token);
      return resp;
    },
    setDeepSeekKey(key: string, token: string) {
      const resp = ipcRenderer.sendSync('setDeepSeekKey', { key, token });
      return resp;
    },
    getDeepSeekModel(token: string) {
      const resp = ipcRenderer.sendSync('getDeepSeekModel', token);
      return resp;
    },
    setDeepSeekModel(mode: string, token: string) {
      const resp = ipcRenderer.sendSync('setDeepSeekModel', { mode, token });
      return resp;
    },
    getRecentURL(token: string) {
      const resp = ipcRenderer.sendSync('getRecentURL', token);
      return resp;
    },
    addToRecentURL(url: string, token: string) {
      const resp = ipcRenderer.sendSync('addToRecentURL', url, token);
      return resp;
    },
    sentenceTokenizer(paragraph: string) {
      const resp = ipcRenderer.sendSync('sentenceTokenizer', paragraph);
      return resp;
    },
    getKeyWordList(mode: string, token: string) {
      const resp = ipcRenderer.sendSync('getKeyWordList', mode, token);
      return resp;
    },
    removeFromKeyWordList(mode: string, keyword: any, token: string) {
      const resp = ipcRenderer.sendSync(
        'removeFromKeyWordList',
        mode,
        keyword,
        token,
      );
      return resp;
    },
    addToVocabulary(text: string, token: string) {
      return ipcRenderer.invoke('addToVocabulary', text, token);
    },
    addToKeyWordList(mode: string, keyword: any, token: string) {
      const resp = ipcRenderer.sendSync(
        'addToKeyWordList',
        mode,
        keyword,
        token,
      );
      return resp;
    },
    setKeyWordList(mode: string, keywords: any, token: string) {
      const resp = ipcRenderer.sendSync(
        'setKeyWordList',
        mode,
        keywords,
        token,
      );
      return resp;
    },
    createImage: (image) => {
      return ipcRenderer.sendSync('createImage', { image });
    },
    getImage: (id) => {
      return ipcRenderer.sendSync('getImage', { id });
    },
    /** **************************************************** */

    system_color: (data) => {
      return ipcRenderer.invoke('system-color', data);
    },

    capturePage: () => {
      return ipcRenderer.invoke('capture-page', {});
    },
    captureArea: ({ x, y, width, height }) => {
      return ipcRenderer.invoke('capture-area', { x, y, width, height });
    },

    importWordFrequencyFromFile: () => {
      return ipcRenderer.invoke('import-word-frequency-from-file', {});
    },
    importKeywordsFromFile: (studyMode) => {
      return ipcRenderer.invoke('import-keywords-from-file', { studyMode });
    },
    importImageBase64FromFile: (token: string) => {
      return ipcRenderer.invoke('import-image-from-file', { token });
    },
    importBookFromFile: (token: string) => {
      return ipcRenderer.invoke('import-book-from-file', { token });
    },
    importBookFromServer: (bookFromServer: any, token: string) => {
      return ipcRenderer.invoke('import-book-from-server', {
        bookFromServer,
        token,
      });
    },
    isBookExist: (id, path) => {
      return ipcRenderer.invoke('is-book-exists', { id, path });
    },
    // generateBook: (id, bookName, extension, md5, size, path, file_content) => {
    //   return ipcRenderer.invoke('generateBook', {
    //     id,
    //     bookName,
    //     extension,
    //     md5,
    //     size,
    //     path,
    //     file_content,
    //   });
    // },
    dirname: () => {
      return ipcRenderer.invoke('dirname');
    },

    appMode: () => {
      return ipcRenderer.invoke('app-mode');
    },

    getOllamaUrl() {
      const resp = ipcRenderer.sendSync('getOllamaUrl');
      return resp;
    },
    setOllamaUrl(url: string) {
      const resp = ipcRenderer.sendSync('setOllamaUrl', url);
      return resp;
    },

    getServerUrl() {
      const resp = ipcRenderer.sendSync('getServerUrl');
      return resp;
    },
    setServerUrl(url: string) {
      const resp = ipcRenderer.sendSync('setServerUrl', url);
      return resp;
    },

    speakTextBySay: (text: string) => {
      return ipcRenderer.invoke('speak-text-by-say', { text });
    },

    parseMarkdown: (data: any) => {
      return ipcRenderer.invoke('parse-markdown', data);
    },

    getAssetRootPath: () => {
      return ipcRenderer.sendSync('getAssetRootPath', {});
    },
  },
};

/**
 * Parse an EPUB into vector-store-ready chunks for VectorManager.
 * One chunk per paragraph cluster ≥ maxChunkSize chars, carrying the CFI
 * of the first paragraph so the reader can deep-link from search hits.
 */
async function extractEpubChunks(
  bookKey: string | number,
  filePath: string,
  maxChunkSize: number,
): Promise<
  Array<{
    text: string;
    chunkIndex: number;
    cfi: string;
    sectionTitle: string | null;
  }>
> {
  if (!filePath) return [];

  const chunks: Array<{
    text: string;
    chunkIndex: number;
    cfi: string;
    sectionTitle: string | null;
  }> = [];
  let chunkIndex = 0;

  try {
    const book = ePub(filePath);
    await book.ready;
    book.locations.generate(1600);

    for (const section of book.spine.spineItems) {
      try {
        const contents = await section.load(book.load.bind(book));
        const paragraphs = contents.querySelectorAll('p');
        const pArray = [...paragraphs];
        let record = '';
        let cfi = '';
        const sectionTitle = section.idref || null;

        for (let i = 0; i < pArray.length; i += 1) {
          const c = pArray[i].textContent;
          if (!record) cfi = section.cfiFromElement(pArray[i], section.cfiBase);
          record = `${record} ${c}`;
          if (record.length < maxChunkSize) continue;

          chunks.push({
            text: record.trim(),
            chunkIndex,
            cfi,
            sectionTitle,
          });
          chunkIndex += 1;
          record = '';
          cfi = '';
        }

        // Flush a trailing partial chunk so the last paragraph isn't lost.
        if (record.trim().length > 0) {
          chunks.push({
            text: record.trim(),
            chunkIndex,
            cfi,
            sectionTitle,
          });
          chunkIndex += 1;
        }
      } catch (sectionError) {
        console.error('extractEpubChunks: section load failed', sectionError);
      }
    }
  } catch (bookError) {
    console.error('extractEpubChunks: book parse failed', bookError);
  }

  return chunks;
}

contextBridge.exposeInMainWorld('electron', electronHandler);

window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.on(
    'extract-epub-chunks',
    (_event, { requestId, bookKey, filePath, maxChunkSize }) => {
      // Reply with the same requestId so main-side BookChunker can correlate
      // concurrent imports — see BookChunker.requestEPubChunks.
      (async () => {
        const chunks = await extractEpubChunks(
          bookKey,
          filePath,
          maxChunkSize || 250,
        );
        ipcRenderer.send('epub-chunks-extracted', { requestId, chunks });
      })();
    },
  );

  document.querySelectorAll('a[href]').forEach((link) => {
    link.addEventListener('click', (e) => {
      if (link.href.startsWith('http://mycustomlink/')) {
        e.preventDefault();
        //  console.log(`Link clicked: ${link.href}`);
        document.dispatchEvent(
          new CustomEvent('mycustomlink', { data: link.href }),
        );
      }
    });
  });
});

export type ElectronHandler = typeof electronHandler;

// // Disable no-unused-vars, broken for spread args
// /* eslint no-unused-vars: off */
// import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// export type Channels = 'ipc-example';

// const electronHandler = {
//   ipcRenderer: {
//     sendMessage(channel: Channels, ...args: unknown[]) {
//       ipcRenderer.send(channel, ...args);
//     },
//     on(channel: Channels, func: (...args: unknown[]) => void) {
//       const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
//         func(...args);
//       ipcRenderer.on(channel, subscription);

//       return () => {
//         ipcRenderer.removeListener(channel, subscription);
//       };
//     },
//     once(channel: Channels, func: (...args: unknown[]) => void) {
//       ipcRenderer.once(channel, (_event, ...args) => func(...args));
//     },
//   },
// };

// contextBridge.exposeInMainWorld('electron', electronHandler);

// export type ElectronHandler = typeof electronHandler;
