/**
 * Quest API — renderer-side client for Plan 2 fork #5 Quest IPC.
 *
 * The Quest layer is intentionally separated from brainApi: brainApi is
 * Brain-state-centric (status, episodes, triggers), while quests are
 * user-declared first-class objects with their own CRUD surface.
 *
 * IPC lookup is lazy on every call — module load time may run before
 * tests inject window.electron, and capturing at module load would
 * permanently freeze a stale undefined reference.
 */

const ipc = () => window.electron?.ipcRenderer ?? null;

const questApi = {
  /**
   * @param {{ name: string, goal: string, bookIds?: number[], metadata?: object, token?: string }} input
   */
  async create(input) {
    return ipc()?.invoke('quest-create', input);
  },

  /**
   * @param {{ status?: 'active' | 'paused' | 'archived', token?: string }} [filter]
   */
  async list(filter = {}) {
    return ipc()?.invoke('quest-list', filter);
  },

  async get(id) {
    return ipc()?.invoke('quest-get', { id });
  },

  async update(id, patch) {
    return ipc()?.invoke('quest-update', { id, patch });
  },

  async pause(id) {
    return ipc()?.invoke('quest-pause', { id });
  },

  async resume(id) {
    return ipc()?.invoke('quest-resume', { id });
  },

  async archive(id) {
    return ipc()?.invoke('quest-archive', { id });
  },
};

export default questApi;
