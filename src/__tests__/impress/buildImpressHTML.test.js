/**
 * @jest-environment jsdom
 */
jest.mock('../../renderer/api/spineApi', () => ({
  __esModule: true,
  default: { generateContentWithJson: jest.fn() },
}));
jest.mock('../../renderer/store/customStorage', () => ({
  __esModule: true,
  default: { sentenceTokenizer: jest.fn() },
}));

global.window = global.window || {};
global.window.electron = {
  ipcRenderer: { getAssetRootPath: jest.fn().mockResolvedValue('/fake/assets') },
};

const { buildImpressHTML } = require('../../renderer/components/impressjs/index.js');
const spineApi = require('../../renderer/api/spineApi').default;

describe('buildImpressHTML', () => {
  test('returns null when slideData has no slides', async () => {
    expect(await buildImpressHTML(null)).toBeNull();
    expect(await buildImpressHTML({})).toBeNull();
    expect(await buildImpressHTML({ data: [] })).toBeNull();
  });

  test('produces HTML with one step per slide, no AI call', async () => {
    spineApi.generateContentWithJson.mockClear();
    const slideData = {
      layout_theme: 'helix',
      global_mood: 'dramatic',
      background: 'gradient_flow',
      data: [
        { content: 'Slide 1', role: 'opening', typography: 'blur_in' },
        { content: 'Slide 2', role: 'key_concept', typography: 'typewriter' },
        { content: 'Slide 3', role: 'closing' },
      ],
    };
    const html = await buildImpressHTML(slideData);
    expect(html).toContain('id="step-0"');
    expect(html).toContain('id="step-1"');
    expect(html).toContain('id="step-2"');
    expect(html).toContain('Slide 1');
    expect(html).toContain('data-typo="blur_in"');
    expect(html).toContain('data-typo="typewriter"');
    expect(html).toContain('data-bg="gradient_flow"');
    // Critical: this is the render-time path, no AI should be invoked
    expect(spineApi.generateContentWithJson).not.toHaveBeenCalled();
  });

  test('falls back to per-slide defaults when deck metadata is missing', async () => {
    const html = await buildImpressHTML({
      data: [{ content: 'Bare slide' }],
    });
    expect(html).toContain('Bare slide');
    expect(html).toContain('id="step-0"');
    expect(html).toContain('data-typo=');
    expect(html).toContain('data-transition=');
  });

  test('does not set data-autoplay on the impress root (user controls pacing)', async () => {
    const html = await buildImpressHTML({
      data: [
        { content: 'Slide A' },
        { content: 'Slide B' },
      ],
    });
    // A nonzero autoplay value causes slides to advance without user input —
    // unacceptable in the full-screen modal where the user is reading.
    expect(html).not.toMatch(/data-autoplay="[1-9]/);
  });
});
