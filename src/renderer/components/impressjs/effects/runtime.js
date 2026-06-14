/* eslint-disable prettier/prettier */
/**
 * Runtime bundle for the Impress presentation popup window.
 *
 * The popup runs in its own JS context (window.open + document.write) and
 * cannot import the renderer modules. We hand-write the effect descriptors
 * as a self-contained JS string and emit it into the popup's <script>.
 *
 * Each descriptor here MUST mirror its counterpart in effects/cssEffects.js.
 * When adding a new CSS effect, update BOTH files.
 */

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
`;

/**
 * Returns the runtime JS bundle as a string. Embed this inside a <script>
 * tag in the popup window's HTML. After it runs, window.__impressEffects is
 * populated and you can call window.__impressEffects.lookup(track, name).
 *
 * @returns {string}
 */
function getRuntimeBundleString() {
  // JSON-stringify the CSS once so the bundle string can safely embed it.
  const cssJson = JSON.stringify(CSS_KEYFRAMES);
  return `
(function () {
  var CSS_KEYFRAMES = ${cssJson};
  var descriptors = { typography: {}, background: {}, transition: {}, layout: {} };
  function register(d) { descriptors[d.track][d.name] = d; }
  function lookup(track, name) {
    var bag = descriptors[track] || {};
    return bag[name] || null;
  }
  window.__impressEffects = { lookup: lookup, register: register };

  var stylesheetInjected = false;
  function injectStylesheet(doc) {
    if (stylesheetInjected) return;
    stylesheetInjected = true;
    var style = doc.createElement('style');
    style.id = 'impress-css-effects-runtime';
    style.textContent = CSS_KEYFRAMES;
    doc.head.appendChild(style);
  }

  // --- Typography ---
  register({
    name: 'none', track: 'typography',
    apply: function () { return function () {}; },
  });
  register({
    name: 'blur_in', track: 'typography',
    apply: function (ctx) {
      injectStylesheet(ctx.doc);
      ctx.slideEl.classList.add('impress-typo-blur_in');
      return function () { ctx.slideEl.classList.remove('impress-typo-blur_in'); };
    },
  });
  register({
    name: 'typewriter', track: 'typography',
    apply: function (ctx) {
      injectStylesheet(ctx.doc);
      ctx.slideEl.classList.add('impress-typo-typewriter');
      return function () { ctx.slideEl.classList.remove('impress-typo-typewriter'); };
    },
  });
  register({
    name: 'word_by_word_fade', track: 'typography',
    apply: function (ctx) {
      injectStylesheet(ctx.doc);
      var slideEl = ctx.slideEl;
      var doc = ctx.doc;
      var text = slideEl.textContent;
      var words = text.split(/(\s+)/);
      slideEl.textContent = '';
      for (var i = 0; i < words.length; i++) {
        var w = words[i];
        if (/^\s+$/.test(w)) {
          slideEl.appendChild(doc.createTextNode(w));
        } else {
          var span = doc.createElement('span');
          span.textContent = w;
          span.style.animationDelay = (i * 80) + 'ms';
          slideEl.appendChild(span);
        }
      }
      slideEl.classList.add('impress-typo-word_by_word_fade');
      return function () {
        slideEl.textContent = text;
        slideEl.classList.remove('impress-typo-word_by_word_fade');
      };
    },
  });
  register({
    name: 'scramble_decode', track: 'typography',
    apply: function (ctx) {
      injectStylesheet(ctx.doc);
      var slideEl = ctx.slideEl;
      var original = slideEl.textContent;
      var chars = '!@#$%^&*<>/?\\\\|{}[]=+-_';
      var start = Date.now();
      var duration = 700;
      var interval = setInterval(function () {
        var elapsed = Date.now() - start;
        var progress = Math.min(elapsed / duration, 1);
        var reveal = Math.floor(original.length * progress);
        var out = '';
        for (var i = 0; i < original.length; i++) {
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
      return function () {
        clearInterval(interval);
        slideEl.textContent = original;
        slideEl.classList.remove('impress-typo-scramble_decode');
      };
    },
  });
  register({
    name: 'letters_from_edges', track: 'typography',
    apply: function (ctx) {
      injectStylesheet(ctx.doc);
      var slideEl = ctx.slideEl;
      var doc = ctx.doc;
      var text = slideEl.textContent;
      var chars = text.split('');
      slideEl.textContent = '';
      for (var i = 0; i < chars.length; i++) {
        var c = chars[i];
        if (/\s/.test(c)) {
          slideEl.appendChild(doc.createTextNode(c));
        } else {
          var span = doc.createElement('span');
          span.textContent = c;
          span.style.setProperty('--dx', ((Math.random() - 0.5) * 1200) + 'px');
          span.style.setProperty('--dy', ((Math.random() - 0.5) * 800) + 'px');
          span.style.animationDelay = (i * 30) + 'ms';
          slideEl.appendChild(span);
        }
      }
      slideEl.classList.add('impress-typo-letters_from_edges');
      return function () {
        slideEl.textContent = text;
        slideEl.classList.remove('impress-typo-letters_from_edges');
      };
    },
  });
  register({
    // runtime: simplified -- SVG ink-write requires async font measurement
    name: 'ink_write', track: 'typography',
    apply: function (ctx) {
      injectStylesheet(ctx.doc);
      ctx.slideEl.classList.add('impress-typo-blur_in');
      return function () { ctx.slideEl.classList.remove('impress-typo-blur_in'); };
    },
  });
  register({
    name: 'glitch_chromatic', track: 'typography',
    apply: function (ctx) {
      injectStylesheet(ctx.doc);
      ctx.slideEl.classList.add('impress-typo-glitch_chromatic');
      return function () { ctx.slideEl.classList.remove('impress-typo-glitch_chromatic'); };
    },
  });
  register({
    name: 'neon_glow_pulse', track: 'typography',
    apply: function (ctx) {
      injectStylesheet(ctx.doc);
      ctx.slideEl.classList.add('impress-typo-neon_glow_pulse');
      return function () { ctx.slideEl.classList.remove('impress-typo-neon_glow_pulse'); };
    },
  });

  // --- Background ---
  register({
    name: 'none', track: 'background',
    apply: function () { return function () {}; },
  });
  register({
    name: 'gradient_flow', track: 'background',
    apply: function (ctx) {
      injectStylesheet(ctx.doc);
      ctx.doc.body.classList.add('impress-bg-gradient_flow');
      return function () { ctx.doc.body.classList.remove('impress-bg-gradient_flow'); };
    },
  });

  // --- Transition ---
  register({
    name: 'default', track: 'transition',
    apply: function () { return function () {}; },
  });
  register({
    name: 'depth_blur', track: 'transition',
    apply: function (ctx) {
      injectStylesheet(ctx.doc);
      var root = ctx.doc.getElementById('impress');
      if (root) root.classList.add('impress-transition-depth_blur');
      return function () {
        if (root) root.classList.remove('impress-transition-depth_blur');
      };
    },
  });
  register({
    name: 'dissolve', track: 'transition',
    apply: function (ctx) {
      injectStylesheet(ctx.doc);
      var root = ctx.doc.getElementById('impress');
      if (root) root.classList.add('impress-transition-dissolve');
      return function () {
        if (root) root.classList.remove('impress-transition-dissolve');
      };
    },
  });
  register({
    name: 'ink_bleed', track: 'transition',
    apply: function (ctx) {
      injectStylesheet(ctx.doc);
      var root = ctx.doc.getElementById('impress');
      if (root) root.classList.add('impress-transition-ink_bleed');
      return function () {
        if (root) root.classList.remove('impress-transition-ink_bleed');
      };
    },
  });
  register({
    name: 'shatter_rebuild', track: 'transition',
    apply: function (ctx) {
      injectStylesheet(ctx.doc);
      var root = ctx.doc.getElementById('impress');
      if (root) root.classList.add('impress-transition-shatter_rebuild');
      return function () {
        if (root) root.classList.remove('impress-transition-shatter_rebuild');
      };
    },
  });
})();
`;
}

module.exports = { getRuntimeBundleString, CSS_KEYFRAMES };
