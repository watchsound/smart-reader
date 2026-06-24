// Tests for the "Use local knowledge" path in LearnAboutDetailPanel.
//
// Bug fixed: queryLocalData was called without await, so localData was always
// a Promise<string> instead of a string; and even if awaited, localData was
// never passed to constructContextPrompt. Both bugs meant the
// SendAndArchiveIcon ("Use local knowledge") button behaved identically to
// the regular "Explore topic" button.
//
// The fix: (1) await queryLocalData, (2) prepend the result as the first
// webContents source so it becomes Source 1 in the LLM prompt.

// Mock paths are relative to this test file (src/__tests__/renderer/).
// The modules being mocked live under src/commons/ and src/renderer/.
jest.mock('../../commons/service/AIProviderManager', () => ({
  instanceInRender: { sendChatMessage: jest.fn(), getAdvanced: jest.fn() },
}));
jest.mock('../../renderer/api/spineApi', () => ({}));
jest.mock('../../renderer/store/customStorage', () => ({}));
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('cheerio', () => ({ load: jest.fn(() => () => ({})) }));

import { constructContextPrompt } from '../../renderer/components/web-based-search/web-query-utils';

describe('constructContextPrompt — local knowledge injection', () => {
  it('includes text from all webContents sources', () => {
    const prompt = constructContextPrompt('neural networks', [
      { url: 'https://example.com', text: 'deep learning overview' },
    ]);
    expect(prompt).toContain('neural networks');
    expect(prompt).toContain('deep learning overview');
  });

  it('surfaces local knowledge when prepended as the first webContents entry', () => {
    const localText = 'my own notes: perceptrons and backpropagation';
    const prompt = constructContextPrompt('neural networks', [
      { url: 'Local Knowledge Base', text: localText },
      { url: 'https://example.com', text: 'web content' },
    ]);
    expect(prompt).toContain(localText);
    expect(prompt).toContain('Local Knowledge Base');
  });

  it('does not mention local knowledge when no local data is provided', () => {
    const prompt = constructContextPrompt('neural networks', [
      { url: 'https://example.com', text: 'web only content' },
    ]);
    expect(prompt).not.toContain('Local Knowledge Base');
    expect(prompt).toContain('web only content');
  });

  it('handles empty webContents without throwing', () => {
    const prompt = constructContextPrompt('test topic', []);
    expect(prompt).toContain('test topic');
  });
});
