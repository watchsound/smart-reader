/**
 * mindmapApi — renderer-side client for the mindmap LP persistence layer.
 *
 * Backed by `mindmap:*` IPC handlers in main (src/main/ipc/mindmapIpc.js).
 * Follows the same shape as moodBoardOrganizerApi / rereadQueueApi:
 *   window.electron.ipcRenderer.invoke(channel, payload)
 *
 * Token is sourced from customStorage (mirrors the sibling api clients).
 */

import customStorage from '../store/customStorage';

export async function saveAsLearningPoints({ mindmapId, bookId, nodes }) {
  const token = customStorage.getToken();
  return window.electron.ipcRenderer.invoke('mindmap:save-as-learning-points', {
    mindmapId,
    bookId,
    nodes,
    token,
  });
}

export async function masterySnapshot({ lpIds }) {
  const token = customStorage.getToken();
  return window.electron.ipcRenderer.invoke('mindmap:mastery-snapshot', {
    lpIds,
    token,
  });
}

const mindmapApi = {
  saveAsLearningPoints,
  masterySnapshot,
};

export default mindmapApi;
