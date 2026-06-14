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
})();
`;
}

module.exports = { getRuntimeBundleString, CSS_KEYFRAMES };
