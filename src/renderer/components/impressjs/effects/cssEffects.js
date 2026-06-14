/* eslint-disable prettier/prettier */
const { register } = require('./registries');

const CSS_KEYFRAMES = `
@keyframes impress-blur-in {
  from { filter: blur(20px); opacity: 0; }
  to   { filter: blur(0px);  opacity: 1; }
}
@keyframes impress-gradient-flow {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.impress-bg-gradient_flow {
  background: linear-gradient(120deg, #1a1a2e, #16213e, #0f3460, #533483);
  background-size: 400% 400%;
  animation: impress-gradient-flow 18s ease infinite;
}
.impress-typo-blur_in {
  animation: impress-blur-in 1s ease forwards;
}
.impress-transition-depth_blur .step.past,
.impress-transition-depth_blur .step.future {
  filter: blur(8px);
  transition: filter 0.6s ease;
}
.impress-transition-depth_blur .step.active {
  filter: blur(0px);
}
`;

/**
 * Inject the global stylesheet once per presentation document.
 * @param {Document} doc
 */
function injectStylesheet(doc) {
  if (doc.getElementById('impress-css-effects')) return;
  const style = doc.createElement('style');
  style.id = 'impress-css-effects';
  style.textContent = CSS_KEYFRAMES;
  doc.head.appendChild(style);
}

// --- Typography ---------------------------------------------------------
register({
  name: 'none',
  track: 'typography',
  requiresWebGL: false,
  mood: [],
  roles: ['*'],
  apply: () => () => {},
});

register({
  name: 'blur_in',
  track: 'typography',
  requiresWebGL: false,
  mood: ['calm', 'dramatic', 'scholarly', 'cinematic'],
  roles: ['opening', 'key_concept', '*'],
  apply: ({ slideEl, doc }) => {
    injectStylesheet(doc);
    slideEl.classList.add('impress-typo-blur_in');
    return () => slideEl.classList.remove('impress-typo-blur_in');
  },
});

// --- Background ---------------------------------------------------------
register({
  name: 'none',
  track: 'background',
  requiresWebGL: false,
  mood: [],
  roles: ['*'],
  apply: () => () => {},
});

register({
  name: 'gradient_flow',
  track: 'background',
  requiresWebGL: false,
  mood: ['calm', 'scholarly'],
  roles: ['*'],
  apply: ({ doc }) => {
    injectStylesheet(doc);
    doc.body.classList.add('impress-bg-gradient_flow');
    return () => doc.body.classList.remove('impress-bg-gradient_flow');
  },
});

// --- Transition ---------------------------------------------------------
register({
  name: 'default',
  track: 'transition',
  requiresWebGL: false,
  mood: [],
  roles: ['*'],
  apply: () => () => {},
});

register({
  name: 'depth_blur',
  track: 'transition',
  requiresWebGL: false,
  mood: ['dramatic', 'tech'],
  roles: ['*'],
  apply: ({ doc }) => {
    injectStylesheet(doc);
    const root = doc.getElementById('impress');
    if (root) root.classList.add('impress-transition-depth_blur');
    return () => {
      if (root) root.classList.remove('impress-transition-depth_blur');
    };
  },
});

// --- Layouts (register existing 7 + helix via legacyGenerateLayout) ----
const layoutGen = require('../layoutGenerators');
const { generateLayout: legacyGenerateLayout, LayoutThemes } = layoutGen.default || layoutGen;

const REGISTERED_LAYOUT_NAMES = [
  LayoutThemes.SPIRAL, LayoutThemes.LINEAR, LayoutThemes.GRID, LayoutThemes.CIRCULAR,
  LayoutThemes.DEPTH_ZOOM, LayoutThemes.RANDOM_WALK, LayoutThemes.STORYTELLING,
  LayoutThemes.HELIX,
];

REGISTERED_LAYOUT_NAMES.forEach((themeName) => {
  register({
    name: themeName,
    track: 'layout',
    requiresWebGL: false,
    mood: [],
    roles: ['*'],
    generate: (slideIndex, total) => {
      const all = legacyGenerateLayout(themeName, total);
      return all[slideIndex] || '';
    },
  });
});

module.exports = { injectStylesheet };
