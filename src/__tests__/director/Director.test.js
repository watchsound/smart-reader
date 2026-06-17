// src/__tests__/director/Director.test.js
const mockBrainCall = jest.fn();
jest.mock('../../main/brain/spine/brainCall', () => (...args) => mockBrainCall(...args));

const tools = require('../../main/brain/spine/tools');
const Director = require('../../main/brain/director/Director');

// Minimal config for tests
function makeConfig(overrides = {}) {
  return {
    intent: 'director-pull-suggestion',
    contextSlices: [],
    systemPrompt: 'Decide one action.',
    tools: ['topUnmasteredConcepts'],
    outputSchema: {
      type: 'object',
      properties: { title: { type: 'string' }, body: { type: 'string' } },
      required: ['title', 'body'],
    },
    budget: 3,
    deterministicFallback: () => ({ title: 'fallback', body: 'used' }),
    ...overrides,
  };
}

// Ensure the tool exists in the registry before any test registers a handler for it.
// This mirrors what requiring the tool file would do — here we stub the registration
// to keep Director.test self-contained and avoid pulling in DB/brain dependencies.
tools.register('topUnmasteredConcepts', {
  description: 'stub for Director tests',
  schema: { properties: { limit: { type: 'number' } }, required: [] },
});

beforeEach(() => {
  mockBrainCall.mockReset();
  tools._clearHandlers();
  tools.registerHandler('topUnmasteredConcepts', async () => ({ concepts: ['x'] }));
});

describe('Director.run', () => {
  test('happy path: tool then answer', async () => {
    mockBrainCall
      .mockResolvedValueOnce({ output: { action: 'tool', tool: 'topUnmasteredConcepts', args: {} }, callId: 1 })
      .mockResolvedValueOnce({ output: { action: 'answer', answer: { title: 't', body: 'b' } }, callId: 2 });

    const result = await Director.run({ config: makeConfig(), input: 'go', userId: 1 });
    expect(result.usedFallback).toBe(false);
    expect(result.output).toEqual({ title: 't', body: 'b' });
    expect(result.callIds).toEqual([1, 2]);
    expect(result.traceId).toBeTruthy();
  });

  test('budget exhausted falls through to deterministic', async () => {
    mockBrainCall.mockResolvedValue({
      output: { action: 'tool', tool: 'topUnmasteredConcepts', args: {} },
      callId: 1,
    });
    const result = await Director.run({ config: makeConfig({ budget: 2 }), input: 'go', userId: 1 });
    expect(result.usedFallback).toBe(true);
    expect(result.output).toEqual({ title: 'fallback', body: 'used' });
  });

  test('unknown tool recovers and continues', async () => {
    mockBrainCall
      .mockResolvedValueOnce({ output: { action: 'tool', tool: 'doesNotExist', args: {} }, callId: 1 })
      .mockResolvedValueOnce({ output: { action: 'answer', answer: { title: 't', body: 'b' } }, callId: 2 });
    const result = await Director.run({ config: makeConfig(), input: 'go', userId: 1 });
    expect(result.usedFallback).toBe(false);
    expect(result.output).toEqual({ title: 't', body: 'b' });
  });

  test('malformed answer recovers', async () => {
    mockBrainCall
      .mockResolvedValueOnce({ output: { action: 'answer', answer: { wrong: 'shape' } }, callId: 1 })
      .mockResolvedValueOnce({ output: { action: 'answer', answer: { title: 't', body: 'b' } }, callId: 2 });
    const result = await Director.run({ config: makeConfig(), input: 'go', userId: 1 });
    expect(result.usedFallback).toBe(false);
  });

  test('handler throw recovers', async () => {
    tools.registerHandler('topUnmasteredConcepts', async () => { throw new Error('boom'); });
    mockBrainCall
      .mockResolvedValueOnce({ output: { action: 'tool', tool: 'topUnmasteredConcepts', args: {} }, callId: 1 })
      .mockResolvedValueOnce({ output: { action: 'answer', answer: { title: 't', body: 'b' } }, callId: 2 });
    const result = await Director.run({ config: makeConfig(), input: 'go', userId: 1 });
    expect(result.usedFallback).toBe(false);
  });

  test('brainCall throwing falls through to deterministic', async () => {
    mockBrainCall.mockRejectedValue(new Error('provider gone'));
    const result = await Director.run({ config: makeConfig(), input: 'go', userId: 1 });
    expect(result.usedFallback).toBe(true);
  });
});
