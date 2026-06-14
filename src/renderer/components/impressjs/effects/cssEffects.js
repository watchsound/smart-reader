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
.impress-transition-dissolve .step.future { opacity: 0; transition: opacity 0.8s ease; }
.impress-transition-dissolve .step.active { opacity: 1; }
.impress-transition-dissolve .step.past   { opacity: 0; }

.impress-transition-ink_bleed .step {
  -webkit-mask-image: radial-gradient(circle at center, black 0%, black 70%, transparent 100%);
  mask-image:         radial-gradient(circle at center, black 0%, black 70%, transparent 100%);
  -webkit-mask-size: 200% 200%;
  transition: mask-position 0.8s ease;
}

@keyframes impress-shatter {
  0% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); opacity: 1; }
  50% { clip-path: polygon(20% 20%, 60% 0, 100% 50%, 40% 100%); opacity: 0.4; }
  100% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); opacity: 1; }
}
.impress-transition-shatter_rebuild .step.active { animation: impress-shatter 1s ease-out 1; }

@keyframes impress-ink-wash-drift {
  0%   { background-position: 0% 0%; }
  100% { background-position: 100% 100%; }
}
.impress-bg-ink_wash {
  position: relative;
  background-color: #f4ecd8;
}
.impress-bg-ink_wash::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: -1;
  background-image:
    radial-gradient(circle at 20% 30%, rgba(20, 20, 30, 0.18) 0%, transparent 35%),
    radial-gradient(circle at 70% 60%, rgba(20, 20, 30, 0.14) 0%, transparent 40%),
    radial-gradient(circle at 40% 80%, rgba(20, 20, 30, 0.10) 0%, transparent 30%);
  background-size: 200% 200%;
  filter: blur(2px);
  animation: impress-ink-wash-drift 24s ease-in-out infinite alternate;
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

register({
  name: 'starfield_parallax',
  track: 'background',
  requiresWebGL: false,
  mood: ['dramatic'],
  roles: ['*'],
  apply: ({ doc }) => {
    const canvas = doc.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;';
    const w = (doc.defaultView && doc.defaultView.innerWidth) || 1280;
    const h = (doc.defaultView && doc.defaultView.innerHeight) || 720;
    canvas.width = w;
    canvas.height = h;
    doc.body.appendChild(canvas);
    const ctx = canvas.getContext && canvas.getContext('2d');
    const stars = Array.from({ length: 400 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      z: Math.random() * 3 + 0.5,
    }));
    let raf = null;
    if (ctx && typeof requestAnimationFrame === 'function') {
      const tick = () => {
        ctx.fillStyle = '#000814';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        stars.forEach((s) => {
          s.x = (s.x + 0.4 * s.z) % canvas.width;
          ctx.fillRect(s.x, s.y, s.z, s.z);
        });
        raf = requestAnimationFrame(tick);
      };
      tick();
    }
    return () => {
      if (raf !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(raf);
      }
      canvas.remove();
    };
  },
});

register({
  name: 'dust_motes',
  track: 'background',
  requiresWebGL: false,
  mood: ['playful', 'calm'],
  roles: ['*'],
  apply: ({ doc }) => {
    const canvas = doc.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;';
    const w = (doc.defaultView && doc.defaultView.innerWidth) || 1280;
    const h = (doc.defaultView && doc.defaultView.innerHeight) || 720;
    canvas.width = w;
    canvas.height = h;
    doc.body.appendChild(canvas);
    const ctx = canvas.getContext && canvas.getContext('2d');
    const motes = Array.from({ length: 200 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2 + 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
    }));
    let raf = null;
    if (ctx && typeof requestAnimationFrame === 'function') {
      const tick = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(255, 240, 200, 0.3)';
        motes.forEach((m) => {
          m.x += m.vx;
          m.y += m.vy;
          if (m.x < 0) m.x = canvas.width;
          if (m.x > canvas.width) m.x = 0;
          if (m.y < 0) m.y = canvas.height;
          if (m.y > canvas.height) m.y = 0;
          ctx.beginPath();
          ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
          ctx.fill();
        });
        raf = requestAnimationFrame(tick);
      };
      tick();
    }
    return () => {
      if (raf !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(raf);
      }
      canvas.remove();
    };
  },
});

register({
  name: 'ink_wash',
  track: 'background',
  requiresWebGL: false,
  mood: ['scholarly', 'calm'],
  roles: ['*'],
  apply: ({ doc }) => {
    injectStylesheet(doc);
    doc.body.classList.add('impress-bg-ink_wash');
    return () => doc.body.classList.remove('impress-bg-ink_wash');
  },
});

register({
  name: 'cinema_letterbox',
  track: 'background',
  requiresWebGL: false,
  mood: ['cinematic'],
  roles: ['*'],
  apply: ({ doc }) => {
    const top = doc.createElement('div');
    const bot = doc.createElement('div');
    [top, bot].forEach((el) => {
      el.style.cssText = 'position:fixed;left:0;right:0;height:8vh;background:#000;z-index:9999;';
    });
    top.style.top = '0';
    bot.style.bottom = '0';
    doc.body.append(top, bot);
    const vignette = doc.createElement('div');
    vignette.style.cssText = 'position:fixed;inset:0;box-shadow:inset 0 0 200px rgba(0,0,0,.8);pointer-events:none;z-index:9998;';
    doc.body.appendChild(vignette);
    return () => {
      top.remove();
      bot.remove();
      vignette.remove();
    };
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

register({
  name: 'dissolve',
  track: 'transition',
  requiresWebGL: false,
  mood: ['calm', 'cinematic'],
  roles: ['*'],
  apply: ({ doc }) => {
    injectStylesheet(doc);
    const root = doc.getElementById('impress');
    if (root) root.classList.add('impress-transition-dissolve');
    return () => {
      if (root) root.classList.remove('impress-transition-dissolve');
    };
  },
});

register({
  name: 'ink_bleed',
  track: 'transition',
  requiresWebGL: false,
  mood: ['scholarly', 'calm'],
  roles: ['*'],
  apply: ({ doc }) => {
    injectStylesheet(doc);
    const root = doc.getElementById('impress');
    if (root) root.classList.add('impress-transition-ink_bleed');
    return () => {
      if (root) root.classList.remove('impress-transition-ink_bleed');
    };
  },
});

register({
  name: 'shatter_rebuild',
  track: 'transition',
  requiresWebGL: false,
  mood: ['dramatic', 'tech'],
  roles: ['*'],
  apply: ({ doc }) => {
    injectStylesheet(doc);
    const root = doc.getElementById('impress');
    if (root) root.classList.add('impress-transition-shatter_rebuild');
    return () => {
      if (root) root.classList.remove('impress-transition-shatter_rebuild');
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
