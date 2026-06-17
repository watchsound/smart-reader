// src/__tests__/director/sessionToolKinds.test.js
const tools = require('../../main/brain/spine/tools');

beforeEach(() => tools.__reset?.());

test('register stores kind; default is read', () => {
  tools.register('t1', { description: 'd', argsSchema: {} });
  tools.register('t2', { description: 'd', argsSchema: {}, kind: 'surface' });
  const desc = tools.descriptors();
  const t1 = desc.find(t => t.name === 't1');
  const t2 = desc.find(t => t.name === 't2');
  expect(t1.kind).toBe('read');
  expect(t2.kind).toBe('surface');
});

test('descriptors returns array with name+description+argsSchema+kind', () => {
  tools.register('alpha', { description: 'A', argsSchema: { x: 'number' }, kind: 'soft-write' });
  const desc = tools.descriptors();
  const a = desc.find(t => t.name === 'alpha');
  expect(a).toEqual({ name: 'alpha', description: 'A', argsSchema: { x: 'number' }, kind: 'soft-write' });
});

test('rejects unknown kind', () => {
  expect(() => tools.register('bad', { description: 'd', argsSchema: {}, kind: 'wonky' }))
    .toThrow(/kind/);
});
