/**
 * srsHaloWalker — pure DOM operation extracted from EPUBAdapter.
 *
 * Given a document and classified vocab items, walks text nodes and wraps
 * each first-occurrence match in a state-specific span. No state held; the
 * caller threads `seenWords` across calls for per-chapter dedup.
 */

const normalize = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[.,!?;:'"()[\]{}]/g, '')
    .trim();

const classForState = (state) => {
  if (state === 'mastered') return 'epub-ac-srs-mastered';
  if (state === 'foggy') return 'epub-ac-srs-foggy';
  if (state === 'claim') return 'argument-claim';
  if (state === 'evidence') return 'argument-evidence';
  return 'epub-ac-lexical-halo';
};

// eslint-disable-next-line import/prefer-default-export
export const wrapMatchesInDocument = (doc, root, items, options = {}) => {
  const targets = new Map();
  items.forEach((item) => {
    const n = normalize(item.word);
    if (n.length >= 2) targets.set(n, item);
  });

  const spans = [];
  const seen = options.seenWords || new Set();
  const excludeTags = new Set([
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'SVG',
    'CANVAS',
    'VIDEO',
    'AUDIO',
    'IFRAME',
    'CODE',
    'PRE',
    ...(options.excludeTags || []),
  ]);
  const haloClasses = new Set([
    'epub-ac-lexical-halo',
    'epub-ac-srs-foggy',
    'epub-ac-srs-mastered',
    'argument-claim',
    'argument-evidence',
  ]);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      let p = n.parentNode;
      while (p && p !== root) {
        if (excludeTags.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.classList) {
          const cls = p.classList;
          let alreadyHaloed = false;
          // for-of avoids no-loop-func: the loop body references `cls`
          // (stable per iteration), not the outer `p`.
          // eslint-disable-next-line no-restricted-syntax
          for (const c of haloClasses) {
            if (cls.contains(c)) {
              alreadyHaloed = true;
              break;
            }
          }
          if (alreadyHaloed) return NodeFilter.FILTER_REJECT;
        }
        p = p.parentNode;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const textNodes = [];
  let node;
  // eslint-disable-next-line no-cond-assign
  while ((node = walker.nextNode())) textNodes.push(node);

  textNodes.forEach((textNode) => {
    const parts = textNode.nodeValue.split(/(\s+)/);
    const matches = [];
    parts.forEach((part, i) => {
      const norm = normalize(part);
      const item = targets.get(norm);
      if (item && !seen.has(norm)) {
        seen.add(norm);
        matches.push({ part, i, item });
      }
    });

    if (matches.length === 0) return;

    const fragment = doc.createDocumentFragment();
    parts.forEach((part, i) => {
      const m = matches.find((x) => x.i === i);
      if (m) {
        const span = doc.createElement('span');
        span.className = classForState(m.item.state);
        span.textContent = part;
        if (m.item.state === 'foggy') {
          span.style.opacity = String(1 - m.item.intensity * 0.6);
        }
        fragment.appendChild(span);
        spans.push(span);
      } else {
        fragment.appendChild(doc.createTextNode(part));
      }
    });
    textNode.parentNode.replaceChild(fragment, textNode);
  });

  return { spans };
};
