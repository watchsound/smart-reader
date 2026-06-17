/**
 * ArgumentXrayService — analyzes a paragraph for argumentative structure
 * via brainCall (spine). The renderer applies the results through
 * srsHaloWalker (state='claim'|'evidence') to light up load-bearing words
 * against supporting ones.
 *
 * Cache by content hash so toggling the X-ray on/off doesn't re-bill the
 * LLM for the same paragraph.
 *
 * @jest-environment node
 */

const mockBrainCall = jest.fn();
jest.mock('../../main/brain/spine', () => ({
  brainCall: mockBrainCall,
}));

// aiProviderManager guard — return a truthy provider so the early-exit
// branch doesn't swallow calls in the happy-path tests.
jest.mock('../../commons/service/AIProviderManager', () => ({
  __esModule: true,
  instanceInMain: { currentProvider: { name: 'mock-provider' } },
}));

const {
  ArgumentXrayService,
} = require('../../main/utils/ArgumentXrayService');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ArgumentXrayService.analyze', () => {
  it('returns {claims, evidence, callId, cacheHit} parsed from brainCall output', async () => {
    // The contract — given a paragraph, the service yields two arrays of
    // verbatim strings the renderer can match against source words, plus
    // the ledger callId for the Economics Panel. Nothing else makes sense
    // until this shape is right.
    mockBrainCall.mockResolvedValue({
      output: {
        claims: ['democracy requires checks', 'power corrupts'],
        evidence: ['Federalist 51', 'Roman Republic collapse'],
      },
      callId: 10,
      cacheHit: false,
    });

    const service = new ArgumentXrayService();
    const result = await service.analyze(
      'Democracy requires checks because power corrupts; see Federalist 51 and the Roman Republic collapse.',
      'tok',
    );

    expect(result.claims).toEqual([
      'democracy requires checks',
      'power corrupts',
    ]);
    expect(result.evidence).toEqual([
      'Federalist 51',
      'Roman Republic collapse',
    ]);
    expect(result.callId).toBe(10);
    expect(result.cacheHit).toBe(false);
    expect(mockBrainCall).toHaveBeenCalledTimes(1);

    // Intent, prompt content, and schema must match what the service declares.
    const [intent, prompt, opts] = mockBrainCall.mock.calls[0];
    expect(intent).toBe('argument-xray');
    expect(prompt.toLowerCase()).toContain('claim');
    expect(prompt.toLowerCase()).toContain('evidence');
    expect(opts.schema).toMatchObject({
      type: 'object',
      properties: expect.objectContaining({
        claims: expect.any(Object),
        evidence: expect.any(Object),
      }),
    });
  });

  it('caches by content — second analyze of the same paragraph reuses the result', async () => {
    // The X-ray toggle is per-paragraph. Without a cache, every toggle
    // off+on would re-bill the LLM for the same text. At a few cents
    // per request and 30+ paragraphs per chapter, an inattentive reader
    // could spend dollars just flipping the X-ray. Cache here is what
    // makes the feature economically viable.
    mockBrainCall.mockResolvedValue({
      output: { claims: ['x'], evidence: ['y'] },
      callId: 1,
      cacheHit: false,
    });
    const service = new ArgumentXrayService();
    const text = 'Some paragraph text that the user toggles twice.';

    const first = await service.analyze(text, 'tok');
    const second = await service.analyze(text, 'tok');

    expect(mockBrainCall).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });

  it('does NOT share cache across distinct paragraphs', async () => {
    // Two paragraphs in the same chapter must each get their own call;
    // otherwise the user X-rays paragraph A and paragraph B inherits
    // A's claims — a worse experience than no X-ray at all.
    mockBrainCall
      .mockResolvedValueOnce({ output: { claims: ['a'], evidence: [] }, callId: 1, cacheHit: false })
      .mockResolvedValueOnce({ output: { claims: ['b'], evidence: [] }, callId: 2, cacheHit: false });
    const service = new ArgumentXrayService();

    const a = await service.analyze('paragraph A', 'tok');
    const b = await service.analyze('paragraph B', 'tok');

    expect(mockBrainCall).toHaveBeenCalledTimes(2);
    expect(a.claims).toEqual(['a']);
    expect(b.claims).toEqual(['b']);
  });
});
