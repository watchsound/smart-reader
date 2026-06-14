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
@keyframes impress-typewriter {
  from { width: 0; }
  to   { width: 100%; }
}
.impress-typo-typewriter {
  display: inline-block; overflow: hidden; white-space: nowrap;
  border-right: 2px solid currentColor;
  animation: impress-typewriter 1.2s steps(40, end) forwards;
}
.impress-typo-word_by_word_fade > span {
  opacity: 0; display: inline-block;
  animation: impress-fade-up 0.5s ease forwards;
}
@keyframes impress-fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes impress-letters-in {
  from { transform: translate(var(--dx, 0), var(--dy, 0)) scale(0.5); opacity: 0; }
  to   { transform: translate(0, 0) scale(1);                          opacity: 1; }
}
.impress-typo-letters_from_edges > span {
  display: inline-block;
  animation: impress-letters-in 0.7s cubic-bezier(.2,.7,.3,1) forwards;
}
@keyframes impress-glitch {
  0%   { transform: translate(0); filter: none; }
  20%  { transform: translate(-2px, 0); filter: hue-rotate(20deg); }
  40%  { transform: translate(2px, 0);  filter: hue-rotate(-20deg); }
  60%  { transform: translate(-1px, 1px); filter: none; }
  100% { transform: translate(0); filter: none; }
}
.impress-typo-glitch_chromatic {
  animation: impress-glitch 0.6s steps(8) 1;
  text-shadow: 1px 0 #ff0044, -1px 0 #00ffff;
}
@keyframes impress-neon-pulse {
  0%, 100% { text-shadow: 0 0 4px #fff, 0 0 8px currentColor; }
  50%      { text-shadow: 0 0 8px #fff, 0 0 24px currentColor, 0 0 48px currentColor; }
}
.impress-typo-neon_glow_pulse { animation: impress-neon-pulse 1.2s ease 1; }
@keyframes impress-scramble-pulse { 0% { opacity: 0.4; } 100% { opacity: 1; } }
.impress-typo-scramble_decode { animation: impress-scramble-pulse 0.8s linear forwards; }
.impress-typo-ink_write text { stroke-dasharray: 500; stroke-dashoffset: 500; animation: impress-ink 1.4s ease forwards; }
@keyframes impress-ink { to { stroke-dashoffset: 0; } }
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

register({
  name: 'typewriter',
  track: 'typography',
  requiresWebGL: false,
  mood: ['tech'],
  roles: ['key_concept', 'data'],
  apply: ({ slideEl, doc }) => {
    injectStylesheet(doc);
    slideEl.classList.add('impress-typo-typewriter');
    return () => slideEl.classList.remove('impress-typo-typewriter');
  },
});

register({
  name: 'word_by_word_fade',
  track: 'typography',
  requiresWebGL: false,
  mood: ['calm', 'scholarly'],
  roles: ['narration', 'key_concept', '*'],
  apply: ({ slideEl, doc }) => {
    injectStylesheet(doc);
    const text = slideEl.textContent;
    const words = text.split(/(\s+)/);
    slideEl.textContent = '';
    words.forEach((w, i) => {
      if (/^\s+$/.test(w)) {
        slideEl.appendChild(doc.createTextNode(w));
        return;
      }
      const span = doc.createElement('span');
      span.textContent = w;
      span.style.animationDelay = `${i * 80}ms`;
      slideEl.appendChild(span);
    });
    slideEl.classList.add('impress-typo-word_by_word_fade');
    return () => {
      slideEl.textContent = text;
      slideEl.classList.remove('impress-typo-word_by_word_fade');
    };
  },
});

register({
  name: 'scramble_decode',
  track: 'typography',
  requiresWebGL: false,
  mood: ['tech', 'dramatic'],
  roles: ['key_concept', 'data'],
  apply: ({ slideEl, doc }) => {
    injectStylesheet(doc);
    const original = slideEl.textContent;
    const chars = '!@#$%^&*<>/?\\|{}[]=+-_';
    const start = Date.now();
    const duration = 700;
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const reveal = Math.floor(original.length * progress);
      let out = '';
      for (let i = 0; i < original.length; i += 1) {
        if (i < reveal) {
          out += original[i];
        } else if (/\s/.test(original[i])) {
          out += original[i];
        } else {
          out += chars[Math.floor(Math.random() * chars.length)];
        }
      }
      slideEl.textContent = out;
      if (progress >= 1) {
        slideEl.textContent = original;
        clearInterval(interval);
      }
    }, 40);
    slideEl.classList.add('impress-typo-scramble_decode');
    return () => {
      clearInterval(interval);
      slideEl.textContent = original;
      slideEl.classList.remove('impress-typo-scramble_decode');
    };
  },
});

register({
  name: 'letters_from_edges',
  track: 'typography',
  requiresWebGL: false,
  mood: ['dramatic', 'cinematic'],
  roles: ['opening', 'key_concept'],
  apply: ({ slideEl, doc }) => {
    injectStylesheet(doc);
    const text = slideEl.textContent;
    const chars = Array.from(text);
    slideEl.textContent = '';
    chars.forEach((c, i) => {
      if (/\s/.test(c)) {
        slideEl.appendChild(doc.createTextNode(c));
        return;
      }
      const span = doc.createElement('span');
      span.textContent = c;
      span.style.setProperty('--dx', `${(Math.random() - 0.5) * 1200}px`);
      span.style.setProperty('--dy', `${(Math.random() - 0.5) * 800}px`);
      span.style.animationDelay = `${i * 30}ms`;
      slideEl.appendChild(span);
    });
    slideEl.classList.add('impress-typo-letters_from_edges');
    return () => {
      slideEl.textContent = text;
      slideEl.classList.remove('impress-typo-letters_from_edges');
    };
  },
});

register({
  name: 'ink_write',
  track: 'typography',
  requiresWebGL: false,
  mood: ['scholarly', 'calm'],
  roles: ['key_concept', 'opening'],
  apply: ({ slideEl, doc }) => {
    injectStylesheet(doc);
    const text = slideEl.textContent;
    // Short-content fallback gate: if text is too long, defer to a simple class
    // animation rather than replacing with SVG (SVG path stroke-dash works best
    // on short, single-line text).
    if (text.length > 80) {
      slideEl.classList.add('impress-typo-blur_in');
      return () => slideEl.classList.remove('impress-typo-blur_in');
    }
    const originalHTML = slideEl.innerHTML;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = doc.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 800 200');
    svg.setAttribute('width', '100%');
    const textEl = doc.createElementNS(svgNS, 'text');
    textEl.setAttribute('x', '20');
    textEl.setAttribute('y', '120');
    textEl.setAttribute('fill', 'none');
    textEl.setAttribute('stroke', 'currentColor');
    textEl.setAttribute('stroke-width', '2');
    textEl.setAttribute('font-size', '64');
    textEl.textContent = text;
    svg.appendChild(textEl);
    slideEl.textContent = '';
    slideEl.appendChild(svg);
    slideEl.classList.add('impress-typo-ink_write');
    return () => {
      slideEl.innerHTML = originalHTML;
      slideEl.classList.remove('impress-typo-ink_write');
    };
  },
});

register({
  name: 'glitch_chromatic',
  track: 'typography',
  requiresWebGL: false,
  mood: ['tech', 'dramatic'],
  roles: ['key_concept', 'opening'],
  apply: ({ slideEl, doc }) => {
    injectStylesheet(doc);
    slideEl.classList.add('impress-typo-glitch_chromatic');
    return () => slideEl.classList.remove('impress-typo-glitch_chromatic');
  },
});

register({
  name: 'neon_glow_pulse',
  track: 'typography',
  requiresWebGL: false,
  mood: ['tech', 'cinematic'],
  roles: ['key_concept'],
  apply: ({ slideEl, doc }) => {
    injectStylesheet(doc);
    slideEl.classList.add('impress-typo-neon_glow_pulse');
    return () => slideEl.classList.remove('impress-typo-neon_glow_pulse');
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
