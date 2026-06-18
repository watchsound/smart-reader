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

  // Phase 13.2 — per-provider pricing overrides
  // Stored in electron-store under `aiPricing.overrides`.
  // Using a fresh Store() per call keeps this handler stateless and avoids
  // the singleton concern; electron-store shares the same backing JSON file.
  ipcMain.handle('aiPricing:get', () => {
    const Store = require('electron-store');
    const store = new Store();
    return store.get('aiPricing.overrides') || {};
  });

  ipcMain.handle('aiPricing:set', (_e, { providerKey, input, output }) => {
    const Store = require('electron-store');
    const store = new Store();
    const all = store.get('aiPricing.overrides') || {};
    if (input === null && output === null) {
      delete all[providerKey];
    } else {
      all[providerKey] = { input: Number(input), output: Number(output) };
    }
    store.set('aiPricing.overrides', all);
    return all;
  });

  ipcMain.handle('aiPricing:defaults', () => {
    const { PRICING } = require('../brain/spine/costEstimator');
    return PRICING;
  });
}

module.exports = { register };
