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

export async function saveMindmap({ title, query, data }) {
  const token = customStorage.getToken();
  return window.electron.ipcRenderer.invoke('mindmap:save', {
    title,
    query,
    data,
    token,
  });
}

export async function listMindmaps() {
  const token = customStorage.getToken();
  return window.electron.ipcRenderer.invoke('mindmap:list', { token });
}

export async function getMindmap(id) {
  const token = customStorage.getToken();
  return window.electron.ipcRenderer.invoke('mindmap:get', { id, token });
}

export async function deleteMindmap(id) {
  const token = customStorage.getToken();
  return window.electron.ipcRenderer.invoke('mindmap:delete', { id, token });
}

const mindmapApi = {
  saveAsLearningPoints,
  masterySnapshot,
  saveMindmap,
  listMindmaps,
  getMindmap,
  deleteMindmap,
};

export default mindmapApi;
