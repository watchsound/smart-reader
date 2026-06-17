/**
 * @jest-environment jsdom
 */
jest.mock('../../renderer/api/spineApi', () => ({
  __esModule: true,
  default: {
    generateContentWithJson: jest.fn(),
  },
}));
jest.mock('../../renderer/store/customStorage', () => ({
  __esModule: true,
  default: { sentenceTokenizer: jest.fn() },
}));

// Stub the electron bridge minimally so generateImpressHTML can resolve asset paths
global.window = global.window || {};
global.window.electron = {
  ipcRenderer: { getAssetRootPath: jest.fn().mockResolvedValue('/fake/assets') },
};

const spineApi = require('../../renderer/api/spineApi').default;
const { generateImpressHTML } = require('../../renderer/components/impressjs/index.js');

describe('Impress orchestrator HTML generation', () => {
  test('emits per-slide data attributes from extended AI schema', async () => {
    spineApi.generateContentWithJson.mockResolvedValueOnce({
      layout_theme: 'helix',
      global_mood: 'dramatic',
      background: 'gradient_flow',
      data: [
        { content: 'Hello', role: 'opening', typography: 'blur_in', transition: 'default' },
        { content: 'World', role: 'key_concept', typography: 'blur_in', transition: 'depth_blur' },
      ],
    });
    const html = await generateImpressHTML({ paragraph: 'Hello world.' });
    expect(html).toContain('data-typo="blur_in"');
    expect(html).toContain('data-transition="depth_blur"');
    expect(html).toContain('data-bg="gradient_flow"');
  });

  test('legacy AI schema (no new fields) still produces valid HTML', async () => {
    spineApi.generateContentWithJson.mockResolvedValueOnce({
      layout_theme: 'spiral',
      data: [{ content: 'A' }, { content: 'B' }],
    });
    const html = await generateImpressHTML({ paragraph: 'A B.' });
    // Falls back to 'none' typography/transition default and 'none' background
    expect(html).toContain('data-typo=');
    expect(html).toContain('data-transition=');
    expect(html).toContain('id="step-0"');
    expect(html).toContain('id="step-1"');
  });
});
