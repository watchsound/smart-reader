// src/main/ipc/spineHandlers.js
const { ipcMain } = require('electron');
const meteredCall = require('../brain/spine/meteredCall');
const meteredCallJson = require('../brain/spine/meteredCallJson');
const {
  instanceInMain: aiProviderManager,
} = require('../../commons/service/AIProviderManager');

function register() {
  ipcMain.handle('spine:meter', async (_e, { kind, label, prompt, schema }) => {
    try {
      if (kind === 'json') {
        const r = await meteredCallJson(prompt, schema || null, { legacyLabel: label });
        return { output: r.output, callId: r.callId };
      }
      const provider = aiProviderManager?.currentProvider;
      if (!provider) return { output: null, callId: null, error: 'no provider' };
      const r = await meteredCall(provider, prompt, { legacyLabel: label });
      return { output: r.output, callId: r.callId };
    } catch (e) {
      return { output: null, callId: null, error: e?.message || String(e) };
    }
  });
}

module.exports = { register };
