/**
 * Renderer client for the Brain Spine bridge (Phase 9d).
 *
 * Mirrors `aiProviderManager` shape so cluster migrations are mechanical:
 *   - `aiProviderManager.generateContent(prompt)`         → `spineApi.generateContent(prompt, { label })`
 *   - `aiProviderManager.generateContentWithJson(prompt)` → `spineApi.generateContentWithJson(prompt, schema, { label })`
 *
 * Pass `{ label, withMeta: true }` if you need the `callId` back.
 */
const { ipcRenderer } = window.require ? window.require('electron') : require('electron');

async function invokeBridge(payload) {
  const res = await ipcRenderer.invoke('spine:meter', payload);
  if (res?.error) throw new Error(res.error);
  return res;
}

const spineApi = {
  async generateContent(prompt, options = {}) {
    const res = await invokeBridge({
      kind: 'text',
      label: options.label || 'unknown',
      prompt,
    });
    return options.withMeta ? res : res.output;
  },
  async generateContentWithJson(prompt, schema, options = {}) {
    const res = await invokeBridge({
      kind: 'json',
      label: options.label || 'unknown',
      prompt,
      schema: schema || null,
    });
    return options.withMeta ? res : res.output;
  },
};

export default spineApi;
