// src/renderer/api/forumApi.js
/**
 * Study Forum renderer API — thin IPC client over forum:* channels.
 *
 * getOrCreate: dedups by anchor; on miss, seeds a 6-turn opening discussion.
 * reply:       appends a user turn, returns the updated thread including
 *              1-2 persona reply turns.
 * listByChapter: powers in-book Forum Marker rendering for the current chapter.
 */
function invoke(channel, args) {
  if (!window.electron?.ipcRenderer) {
    return Promise.reject(new Error('forumApi: ipcRenderer unavailable'));
  }
  return window.electron.ipcRenderer.invoke(channel, args);
}

const forumApi = {
  getOrCreate({ anchor, passageText, bookTitle, chapterTitle }) {
    return invoke('forum:get-or-create', {
      anchor,
      passageText,
      bookTitle,
      chapterTitle,
    });
  },
  reply({ discussionId, userContent, addressedTo }) {
    return invoke('forum:reply', { discussionId, userContent, addressedTo });
  },
  listByChapter({ bookId, chapterId }) {
    return invoke('forum:list-by-chapter', { bookId, chapterId });
  },
};

export default forumApi;
