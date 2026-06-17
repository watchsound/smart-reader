// src/__tests__/director/sessionReadTools.test.js
const tools = require('../../main/brain/spine/tools');
require('../../main/brain/director/tools/dueReviewsByDomain');
require('../../main/brain/director/tools/recentlyAcceptedMicroCards');

jest.mock('../../main/db/LearningPointManager', () => ({
  dueByDomain: jest.fn(),
  recentlyAccepted: jest.fn(),
}));
const LPM = require('../../main/db/LearningPointManager');

test('dueReviewsByDomain returns domain buckets', async () => {
  LPM.dueByDomain.mockReturnValue([
    { domain: 'vocabulary', count: 5, sampleIds: [1, 2, 3] },
    { domain: 'concept', count: 2, sampleIds: [4, 5] },
  ]);
  const result = await tools.invoke('dueReviewsByDomain', { userId: 1 });
  expect(result).toEqual([
    { domain: 'vocabulary', count: 5, sampleIds: [1, 2, 3] },
    { domain: 'concept', count: 2, sampleIds: [4, 5] },
  ]);
});

test('recentlyAcceptedMicroCards returns last N cards', async () => {
  LPM.recentlyAccepted.mockReturnValue([
    { id: 10, headword: 'parse', acceptedAt: 1000 },
    { id: 11, headword: 'lex', acceptedAt: 1100 },
  ]);
  const result = await tools.invoke('recentlyAcceptedMicroCards', { userId: 1, n: 2 });
  expect(result).toHaveLength(2);
  expect(result[0].headword).toBe('parse');
});

test('both tools registered with kind=read', () => {
  const desc = tools.descriptors();
  expect(desc.find(t => t.name === 'dueReviewsByDomain').kind).toBe('read');
  expect(desc.find(t => t.name === 'recentlyAcceptedMicroCards').kind).toBe('read');
});
