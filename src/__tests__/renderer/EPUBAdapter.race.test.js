/**
 * EPUBAdapter — resize-race regression tests.
 *
 * On window resize, epub.js tears down its iframe and rebuilds. It fires
 * `rendered` / `locationChanged` mid-rebuild, when iframe.contentDocument
 * is truthy but the document's <head> and <body> aren't attached yet.
 *
 * Two real bugs lived in that window:
 *   1) _injectStyles called currentDocument.head.appendChild — NPE on
 *      head=null. (Crash reported by user on resize.)
 *   2) _handleLocationChange / _handleContentsLoaded assigned
 *      animationCore.options.container = currentDocument.body without
 *      a null check — silently poisoned the core until the next clean
 *      'rendered' event, breaking the very next animation call.
 *
 * These tests pin both fixes by driving the adapter through a mock
 * rendition whose contentDocument can be flipped between "ready" and
 * "half-built" states.
 *
 * @jest-environment jsdom
 */

const EPUBAdapter = require('../../renderer/components/animation-core/adapters/EPUBAdapter').default;

function makeReadyDoc() {
  // A real Document fully equipped with head + body. createElement and
  // appendChild both work, so _injectStyles runs end-to-end.
  return document.implementation.createHTMLDocument('test');
}

function makeHalfBuiltDoc() {
  // Quacks like a Document up to the gates the adapter checks, but with
  // head + body both null — the exact state epub.js leaves contentDocument
  // in between iframe rebuild and the next 'rendered' event.
  return {
    head: null,
    body: null,
    getElementById: () => null,
  };
}

function makeMockRendition() {
  const state = { contentDoc: null };
  const handlers = {};
  return {
    views: () => ({
      _views: [
        {
          // Reading `iframe` returns a fresh object each time so the
          // adapter sees the latest contentDoc, not a snapshot.
          get iframe() {
            return {
              contentDocument: state.contentDoc,
              contentWindow: state.contentDoc?.defaultView || null,
            };
          },
        },
      ],
    }),
    on: (event, fn) => {
      handlers[event] = handlers[event] || [];
      handlers[event].push(fn);
    },
    off: (event, fn) => {
      handlers[event] = (handlers[event] || []).filter((h) => h !== fn);
    },
    setDoc: (doc) => {
      state.contentDoc = doc;
    },
  };
}

describe('EPUBAdapter resize race', () => {
  it('_injectStyles bails when document.head is null (regression: head NPE on resize)', async () => {
    const rendition = makeMockRendition();
    rendition.setDoc(makeReadyDoc());
    const adapter = new EPUBAdapter(rendition);
    await adapter.initialize();

    // Swap to a half-built document — head is null.
    rendition.setDoc(makeHalfBuiltDoc());
    adapter._setupDocument();

    expect(() => adapter._injectStyles()).not.toThrow();
  });

  it('_handleContentsLoaded does NOT overwrite animationCore.options.container when body is null', async () => {
    const rendition = makeMockRendition();
    const readyDoc = makeReadyDoc();
    rendition.setDoc(readyDoc);
    const adapter = new EPUBAdapter(rendition);
    await adapter.initialize();

    const initialContainer = adapter.animationCore.options.container;
    expect(initialContainer).toBe(readyDoc.body);

    // Mid-rebuild firing of 'rendered': contentDoc exists, body is null.
    rendition.setDoc(makeHalfBuiltDoc());

    expect(() => adapter._handleContentsLoaded()).not.toThrow();

    // Critical invariant: container must NOT have been set to null.
    // A null container would break the next highlightVocabulary / glow call.
    expect(adapter.animationCore.options.container).toBe(initialContainer);
    expect(adapter.animationCore.options.container).not.toBeNull();
  });

  it('recovers and injects styles + container after a clean rebuild', async () => {
    const rendition = makeMockRendition();
    rendition.setDoc(makeReadyDoc());
    const adapter = new EPUBAdapter(rendition);
    await adapter.initialize();

    // Mid-rebuild — guarded, no side effects.
    rendition.setDoc(makeHalfBuiltDoc());
    adapter._handleContentsLoaded();

    // Rebuild completes with a brand-new document (simulates the new iframe).
    const newDoc = makeReadyDoc();
    rendition.setDoc(newDoc);
    adapter._handleContentsLoaded();

    expect(adapter.animationCore.options.container).toBe(newDoc.body);
    expect(newDoc.getElementById('epub-ac-styles')).not.toBeNull();
  });
});
