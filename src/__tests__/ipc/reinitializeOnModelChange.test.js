/**
 * Verifies that every set*Model IPC handler in main.ts calls
 * reinitializeProvider so model changes take effect immediately without
 * requiring an API-key change or app restart.
 *
 * This is a source-level audit test, not a runtime test — main.ts cannot be
 * loaded in Jest (Electron APIs, native modules). We parse the source file
 * as text and check the structural invariant directly.
 */
const fs = require('fs');
const path = require('path');

const mainPath = path.resolve(__dirname, '../../main/main.ts');
const source = fs.readFileSync(mainPath, 'utf8');

// Split into lines for precise assertions.
const lines = source.split('\n');

/**
 * Returns the index of the line that starts the ipcMain.on(channelName, …) handler.
 */
function findHandlerStart(channelName) {
  return lines.findIndex((l) => l.includes(`ipcMain.on('${channelName}'`));
}

/**
 * Returns the slice of lines that forms the body of the handler starting at
 * startIdx. Stops when we see a matching closing `});` at indent level 2
 * (the same level ipcMain.on opens at).
 */
function extractHandlerBody(startIdx) {
  const result = [];
  let depth = 0;
  let started = false;
  for (let i = startIdx; i < lines.length; i++) {
    const l = lines[i];
    if (!started && l.includes('{')) started = true;
    if (started) {
      result.push(l);
      for (const ch of l) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
      }
      if (depth === 0) break;
    }
  }
  return result.join('\n');
}

// These are the model-selection channels whose store keys are read by
// reinitializeProvider to call aiProviderManager.setup(…, model).
// Channels NOT in this list (e.g. setBaiduModel — reinitializeProvider reads
// baidu_secret, not baidu-model; setBaiduAdvancedModel, setKimiAdvancedModel,
// setDoubaoAdvancedModel — reinitializeProvider doesn't read those keys) are
// intentionally excluded.
const MODEL_CHANNELS = [
  'setGeminiModel',
  'setOllamaModel',
  'setClaudeModel',
  'setChatGPTModel',
  'setKimiModel',
  'setDoubaoModel',
  'setQwenModel',
  'setDeepSeekModel',
];

describe('reinitializeProvider called in every set*Model handler', () => {
  test.each(MODEL_CHANNELS)('%s calls reinitializeProvider', (channel) => {
    const startIdx = findHandlerStart(channel);
    expect(startIdx).toBeGreaterThan(-1);

    const body = extractHandlerBody(startIdx);
    expect(body).toContain('reinitializeProvider(userId)');
  });

  test('all set*Key handlers also call reinitializeProvider (regression guard)', () => {
    const keyChannels = [
      'setAIProvider',
      'setOpenAIKey',
      'setGeminiKey',
      'setClaudeKey',
      'setBaiduKey',
      'setBaiduSecret',
      'setKimiKey',
      'setDoubaoKey',
      'setQwenKey',
      'setDeepSeekKey',
    ];
    for (const channel of keyChannels) {
      const startIdx = findHandlerStart(channel);
      expect(startIdx).toBeGreaterThan(-1);
      const body = extractHandlerBody(startIdx);
      expect(body).toContain('reinitializeProvider(userId)');
    }
  });
});
