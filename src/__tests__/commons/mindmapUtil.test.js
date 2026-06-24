/**
 * @jest-environment jsdom
 *
 * Covers the parser's tolerance of AI output drift: the LearnAbout prompt
 * asks for `- keyword | description`, but the AI sometimes returns numbered
 * lists, headers, asterisk bullets, etc. The old `isAlphaNumeric` filter
 * mis-rejected numbered lines (because '1' is alphanumeric), causing the
 * intermittent "no mindmap card" bug.
 */

// jsdom's canvas returns null for getContext('2d'); the parser uses canvas
// only to measure text width for node sizing — stub it with a deterministic
// estimator so the structural parse can be tested.
HTMLCanvasElement.prototype.getContext = function getContext() {
  return {
    set font(v) {},
    measureText(s) {
      return { width: (s ? s.length : 0) * 8 };
    },
  };
};

const {
  default: parseMindmapToReactFlow,
} = require('../../commons/utils/content/mindmapUtil');

function descNodes(md) {
  const r = parseMindmapToReactFlow(md);
  return r.descriptionMap?.nodes ?? [];
}

describe('parseMindmapToReactFlow — AI format tolerance', () => {
  test('dash bullets (the prompt-requested format)', () => {
    const md = '- Root | the root\n  - Child1 | first\n  - Child2 | second';
    const nodes = descNodes(md);
    expect(nodes.length).toBe(3);
  });

  test('numbered list (regression: 1. used to be skipped)', () => {
    const md = '1. Root | the root\n  2. Child1 | first\n  3. Child2 | second';
    const nodes = descNodes(md);
    expect(nodes.length).toBe(3);
    // Marker must be stripped from displayed text
    expect(nodes[0].data.label.startsWith('1.')).toBe(false);
    expect(nodes[0].data.label.trim().startsWith('Root')).toBe(true);
  });

  test('asterisk bullets', () => {
    const md = '* Root | r\n  * Child | c';
    const nodes = descNodes(md);
    expect(nodes.length).toBe(2);
  });

  test('plus bullets', () => {
    const md = '+ Root | r\n  + Child | c';
    expect(descNodes(md).length).toBe(2);
  });

  test('markdown headers as bullets', () => {
    const md = '# Root | r\n## Child | c';
    expect(descNodes(md).length).toBe(2);
  });

  test('prose preamble is skipped, list lines that follow are kept', () => {
    const md =
      "Here's the mindmap for you:\n- Root | r\n  - Child | c";
    const nodes = descNodes(md);
    expect(nodes.length).toBe(2);
  });

  test('pure prose / refusal yields zero nodes (not a broken card)', () => {
    const md =
      "I'm sorry, I cannot generate a mindmap for that topic.";
    expect(descNodes(md).length).toBe(0);
  });

  test('parent edges connect siblings to the same parent (not chain)', () => {
    const md = '- Root | r\n  - A | a\n  - B | b';
    const r = parseMindmapToReactFlow(md);
    const edges = r.descriptionMap?.edges ?? [];
    // Two sibling-of-root edges. Source IDs must match the root's node id.
    const nodes = r.descriptionMap.nodes;
    const root = nodes[0];
    const sibEdges = edges.filter(
      (e) => e.source === root.id && e.target !== '-1',
    );
    expect(sibEdges.length).toBe(2);
  });
});
