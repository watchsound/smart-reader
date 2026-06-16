/**
 * srsHaloWalker.wrapMatchesInDocument — pure-DOM tests against jsdom.
 *
 * The walker is the SRS halo's rendering core: given a document and a list
 * of classified vocab items {word, state, intensity}, it walks text nodes
 * and wraps each first occurrence of a matched word in a styled span. The
 * per-state CSS class is what makes Forgetting Fog / Knowledge Accretion
 * actually visible to the reader.
 *
 * Extracted from EPUBAdapter so the rendering decisions are testable in
 * isolation (the adapter's coupling to rendition / iframe-document makes
 * direct testing impractical).
 *
 * @jest-environment jsdom
 */

const {
  wrapMatchesInDocument,
} = require('../../renderer/components/animation-core/adapters/srsHaloWalker');

describe('wrapMatchesInDocument', () => {
  let body;

  beforeEach(() => {
    document.body.innerHTML = '<p>The cat sat on the mat reading.</p>';
    body = document.body;
  });

  it("wraps a 'learning' word with the v1 lexical-halo class (preserves v1 behavior)", () => {
    // Backwards-compat anchor: existing readers using v1 should see the
    // SAME blue dotted underline for words that are merely in-vocabulary
    // (no SRS distress signal). If this class name drifts, every reader
    // mid-chapter would see their halos change color without warning.
    const result = wrapMatchesInDocument(document, body, [
      { word: 'cat', state: 'learning', intensity: 0 },
    ]);

    const spans = body.querySelectorAll('span.epub-ac-lexical-halo');
    expect(spans).toHaveLength(1);
    expect(spans[0].textContent).toBe('cat');
    expect(result.spans).toHaveLength(1);
  });

  it("wraps a 'foggy' word with .epub-ac-srs-foggy AND inline opacity reflecting intensity", () => {
    // Forgetting Fog's whole point is gradient. CSS alone can't pick the
    // opacity per word — the classifier already computed `intensity` from
    // the SRS overdue ratio; the walker MUST translate that into an inline
    // style.opacity so the visual signal is per-word, not per-class.
    // Without inline opacity, every foggy word would render at the same
    // dim level and "intensity" would be meaningless.
    wrapMatchesInDocument(document, body, [
      { word: 'cat', state: 'foggy', intensity: 0.5 },
    ]);
    const span = body.querySelector('span.epub-ac-srs-foggy');
    expect(span).toBeTruthy();
    expect(span.textContent).toBe('cat');
    // opacity = 1 - intensity * 0.6 → 0.7 at intensity 0.5. The 0.6 factor
    // is the floor-of-0.4 contract from the plan (max fade).
    expect(span.style.opacity).toBe('0.7');
  });

  it("wraps a 'mastered' word with .epub-ac-srs-mastered (the ✦ constellation badge)", () => {
    // Mastery is the user's reward. Visual must differ from learning + foggy
    // because aggregated over a chapter it's what produces the "starfield"
    // emergence — months of reviews crystallising into the text itself.
    wrapMatchesInDocument(document, body, [
      { word: 'cat', state: 'mastered', intensity: 0 },
    ]);
    const span = body.querySelector('span.epub-ac-srs-mastered');
    expect(span).toBeTruthy();
    expect(span.textContent).toBe('cat');
    // Mastered does not use opacity — full visibility, just the badge.
    expect(span.style.opacity).toBe('');
  });

  it('threads dedup across calls when caller supplies a seenWords Set', () => {
    // Adapter contract: applyXxx may be invoked multiple times within one
    // chapter (e.g. toggle off → on). The second call must NOT re-wrap the
    // same words. Without a caller-supplied seen Set, the walker resets
    // every call and double-wrapping happens.
    document.body.innerHTML = '<p>The cat sat. The cat ran.</p>';
    const seen = new Set();
    wrapMatchesInDocument(document, document.body, [
      { word: 'cat', state: 'learning', intensity: 0 },
    ], { seenWords: seen });
    wrapMatchesInDocument(document, document.body, [
      { word: 'cat', state: 'learning', intensity: 0 },
    ], { seenWords: seen });
    const spans = document.body.querySelectorAll('span.epub-ac-lexical-halo');
    expect(spans).toHaveLength(1);
  });

  it('skips text inside SCRIPT, STYLE, CODE, PRE — never haloes code samples or markup', () => {
    // A reader's EPUB may include programming examples, embedded scripts,
    // or raw style blocks. Haloing matching tokens INSIDE these would
    // (a) make the code unreadable and (b) wrap text that's not really
    // English vocabulary. Equally important: SCRIPT contents shouldn't get
    // mutated at all, in case they're evaluated by the EPUB renderer.
    // Distinct words per tag so dedup can't accidentally mask the bug.
    document.body.innerHTML = `
      <p>The cat sat on the mat.</p>
      <pre>dog foo.txt</pre>
      <code>const fish = 1;</code>
      <script>var bird = 2;</script>
      <style>.fox { color: red; }</style>
    `;
    wrapMatchesInDocument(document, document.body, [
      { word: 'cat', state: 'learning', intensity: 0 },
      { word: 'dog', state: 'learning', intensity: 0 },
      { word: 'fish', state: 'learning', intensity: 0 },
      { word: 'bird', state: 'learning', intensity: 0 },
      { word: 'fox', state: 'learning', intensity: 0 },
    ]);
    // Only the <p> occurrence should be haloed.
    const spans = document.body.querySelectorAll('span.epub-ac-lexical-halo');
    expect(spans).toHaveLength(1);
    expect(spans[0].textContent).toBe('cat');
    expect(spans[0].parentElement.tagName).toBe('P');
  });

  it('dedups: a target word occurring twice in the same call wraps only the first occurrence', () => {
    // First-occurrence-only is the v1 contract that keeps the visual signal
    // legible across long chapters. Without dedup, every "the" or "of" in a
    // user's vocabulary list would underline 400+ times per page.
    document.body.innerHTML = '<p>The cat saw the other cat run.</p>';
    wrapMatchesInDocument(document, document.body, [
      { word: 'cat', state: 'learning', intensity: 0 },
    ]);
    const spans = document.body.querySelectorAll(
      'span.epub-ac-lexical-halo',
    );
    expect(spans).toHaveLength(1);
    expect(spans[0].textContent).toBe('cat');
  });
});
