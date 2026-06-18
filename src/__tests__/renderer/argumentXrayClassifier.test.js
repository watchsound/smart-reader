/**
 * argumentXrayClassifier — splits the LLM's phrase-level claims/evidence
 * into single-word items consumable by srsHaloWalker. The walker matches
 * one token at a time, so multi-word phrases ("power corrupts") have to
 * fan out into per-word items.
 *
 * @jest-environment node
 */

const { classify } = require('../../renderer/utils/argumentXrayClassifier');

describe('argumentXrayClassifier.classify', () => {
  it('fans out claim phrases into per-word items tagged claim', () => {
    const items = classify({
      claims: ['Power corrupts', 'democracy requires checks'],
      evidence: [],
    });
    // Stopwords ("the", "a") removed in a later test; for now any
    // substantive word from a claim should arrive as state='claim'.
    const words = items.map((it) => it.word);
    expect(words).toContain('power');
    expect(words).toContain('corrupts');
    expect(words).toContain('democracy');
    expect(items.every((it) => it.state === 'claim')).toBe(true);
  });

  it('fans out evidence phrases into per-word items tagged evidence', () => {
    const items = classify({
      claims: [],
      evidence: ['Federalist 51', 'Roman Republic collapse'],
    });
    expect(items.find((it) => it.word === 'federalist')?.state).toBe(
      'evidence',
    );
    expect(items.find((it) => it.word === 'roman')?.state).toBe('evidence');
    expect(items.find((it) => it.word === 'collapse')?.state).toBe(
      'evidence',
    );
  });

  it('drops common stopwords + short tokens — they would highlight every paragraph as a claim', () => {
    // The contract: if the LLM returns a phrase like "the power of checks",
    // we MUST NOT emit "the" as a claim word. Every paragraph contains
    // "the", "a", "of"; tagging them would turn the page into yellow noise.
    const items = classify({
      claims: ['the power of checks'],
      evidence: [],
    });
    const words = items.map((it) => it.word);
    expect(words).toContain('power');
    expect(words).toContain('checks');
    expect(words).not.toContain('the');
    expect(words).not.toContain('of');
  });

  it('claim wins over evidence when a word appears in both (mutual exclusion)', () => {
    // If the LLM returns "power" as both a claim word and evidence word,
    // visually we need exactly one color per word. Pick claim — claims
    // are the load-bearing words; evidence supports them.
    const items = classify({
      claims: ['power corrupts'],
      evidence: ['power dynamics'],
    });
    const power = items.find((it) => it.word === 'power');
    expect(power.state).toBe('claim');
  });
});
