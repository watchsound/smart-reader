/* eslint-disable prettier/prettier */
import customStorage from '../../store/customStorage';

import { createDecomposeParagraphPrompt } from '../../../commons/utils/AIPrompts';
import spineApi from '../../api/spineApi';
import { generateLayout, selectLayoutTheme } from './layoutGenerators';
import { getRuntimeBundleString } from './effects/runtime';

/**
 * Build the impress.js HTML document from already-resolved slide data.
 * No AI call. Render-time consumers (EmbeddedPresentationCard) call this
 * directly with stored slide data so the AI cost is paid only once.
 *
 * @param {Object} slideData
 * @param {string|null} slideData.layout_theme
 * @param {string|null} slideData.global_mood
 * @param {string|null} slideData.background
 * @param {Array<{content:string, role?:string, typography?:string, transition?:string, background?:string}>} slideData.data
 * @returns {Promise<string|null>} HTML, or null if no slides.
 */
const buildImpressHTML = async (slideData) => {
  const slidesData = (slideData?.data || []).map((s) => ({
    content: s.content,
    role: s.role || null,
    typography: s.typography || null,
    transition: s.transition || null,
    background: s.background || null,
  }));
  if (slidesData.length === 0) return null;

  const deckData = {
    layout_theme: slideData?.layout_theme || null,
    global_mood: slideData?.global_mood || null,
    background: slideData?.background || null,
  };
  const suggestedTheme = deckData.layout_theme;
  const sentences = slidesData.map((s) => s.content);

  // Select layout theme based on AI suggestion and content analysis
  const layoutTheme = selectLayoutTheme(
    suggestedTheme,
    sentences.length,
    sentences,
  );
  console.log(`Selected layout theme: ${layoutTheme}`);

  // Generate dynamic layout based on theme and slide count
  const layouts = generateLayout(layoutTheme, sentences.length);

  const aPath = await window.electron.ipcRenderer.getAssetRootPath();
  console.log(aPath);

  let scriptPath = `${aPath}/scripts/impress-2.0.0.js`;
  scriptPath = `file://${scriptPath.replace(/\\/g, '/')}`;
  let css1Path = `${aPath}/styles/impress-common.css`;
  css1Path = `file://${css1Path.replace(/\\/g, '/')}`;
  let css2Path = `${aPath}/styles/impress-demo.css`;
  css2Path = `file://${css2Path.replace(/\\/g, '/')}`;

  // Load registries (side-effect imports register the descriptors)
  require('./effects/cssEffects');
  const { lookup } = require('./effects/registries');
  const {
    pickTypographyByMoodRole,
    pickBackgroundByMood,
    pickTransitionByMood,
  } = require('./effects/fallbackTables');

  // Resolve deck-level background: per-deck override -> mood-based fallback -> 'none'
  const resolvedBackground = deckData.background
    || (deckData.global_mood ? pickBackgroundByMood(deckData.global_mood) : 'none');

  let steps = '';
  const numSentences = sentences.length;

  slidesData.forEach((slide, index) => {
    // Layout — use registry; fall back to legacy `layouts` array if name unknown
    const layoutDesc = lookup('layout', layoutTheme);
    const layoutAttrs = layoutDesc
      ? layoutDesc.generate(index, slidesData.length)
      : layouts[index];

    // Typography — per-slide -> mood+role fallback -> 'none'
    const typo = slide.typography
      || pickTypographyByMoodRole(deckData.global_mood || 'calm', slide.role || 'key_concept');

    // Transition — per-slide -> mood fallback -> 'default'
    const trans = slide.transition || pickTransitionByMood(deckData.global_mood || 'calm');

    // Background — per-slide override -> deck-level background
    const bg = slide.background || resolvedBackground;

    steps += `
    <div id="step-${index}" ${layoutAttrs} data-typo="${typo}" data-transition="${trans}" data-bg="${bg}">
    ${slide.content}
    </div>`;
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Impress.js Presentation</title>
        <meta charset="utf-8" />
        <meta http-equiv="Content-Security-Policy" content="
          default-src 'self' file:;
          script-src * 'self' file: 'unsafe-inline' 'unsafe-eval';
          style-src * 'self' file: 'unsafe-inline';
          style-src-elem * 'self' file: 'unsafe-inline';
          img-src * 'self' data: file: blob:;
          connect-src * file:;
        ">
        <link href="${css1Path}" rel="stylesheet" />
        <link href="${css2Path}" rel="stylesheet" />
        <style>
          /* Cinema dark base — overrides demo.css grey radial gradient */
          html, body {
            background: #0d0d0d !important;
            color: #e4e4e4;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif !important;
            min-height: 100%;
          }

          /* Slide visibility: inactive nearly invisible, active full */
          .step {
            opacity: 1;
            color: rgba(255, 255, 255, 0.06);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif !important;
            font-size: 44px;
            line-height: 1.55;
            letter-spacing: -0.01em;
            text-align: center;
            transition: color 0.6s ease-in-out;
          }
          .step.active {
            color: #e4e4e4;
          }
          .step.past, .step.future {
            color: rgba(255, 255, 255, 0.06);
          }

          /* Headings inside slides */
          .step h3, .step h4 {
            margin: 0 0 0.45em 0;
            color: #fff;
            font-weight: 600;
            letter-spacing: -0.02em;
          }
          .step.active h3, .step.active h4 {
            text-shadow: 0 0 40px rgba(255, 215, 0, 0.25);
          }

          /* Lists */
          .step ul, .step ol {
            margin: 0.5em 0;
            padding-left: 1.4em;
            text-align: left;
            font-size: 0.85em;
          }
          .step li {
            margin: 0.35em 0;
            line-height: 1.5;
          }

          /* Tables */
          .step table {
            border-collapse: collapse;
            margin: 0.5em auto;
          }
          .step td, .step th {
            border: 1px solid rgba(255,255,255,0.15);
            padding: 0.4em 0.8em;
            font-size: 0.8em;
          }
          .step th {
            background: rgba(255,255,255,0.08);
            font-weight: 600;
          }
          .step p {
            margin: 0.3em 0;
          }

          /* Inline emphasis — gold / sky blue */
          .step strong, .step b {
            color: #ffd700;
            font-weight: 600;
          }
          .step em, .step i {
            color: #7ec8e3;
            font-style: italic;
          }

          /* Navigation hint — bottom center, fades on first advance */
          .hint {
            position: fixed;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            color: rgba(255,255,255,0.35);
            font-size: 12px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            transition: opacity 0.6s;
            pointer-events: none;
          }
        </style>
      </head>
      <body>
        <div id="impress"
          data-transition-duration="1000"
          data-width="1024"
          data-height="768"
          data-max-scale="3"
          data-min-scale="0"
          data-perspective="1000">
         ${steps}
        </div>
        <div id="impress-toolbar"></div>
        <div class="hint">
          <p>Use spacebar, arrow keys, or click to navigate</p>
        </div>

        <script src="${scriptPath}"></script>
        <script>
          ${getRuntimeBundleString()}

          // Hide hint after first interaction
          document.addEventListener("impress:stepenter", function() {
            var hint = document.querySelector('.hint');
            if (hint) hint.style.opacity = '0';
          }, { once: true });

          // Apply deck-level background effect once (resolved at HTML-gen time)
          (function applyDeckBackground() {
            var bg = ${JSON.stringify(resolvedBackground)};
            var desc = window.__impressEffects.lookup('background', bg);
            if (desc) desc.apply({ slideEl: null, doc: document, slideData: {}, deck: ${JSON.stringify(deckData)}, scene: null });
          })();

          // Apply per-slide typography + transition on stepenter; cleanup on stepleave
          var activeCleanups = [];
          document.addEventListener('impress:stepenter', function (e) {
            while (activeCleanups.length) { try { activeCleanups.pop()(); } catch (err) {} }
            var slideEl = e.target;
            var typoName = slideEl.getAttribute('data-typo') || 'none';
            var transName = slideEl.getAttribute('data-transition') || 'default';
            var ctx = {
              slideEl: slideEl, doc: document, slideData: {},
              deck: ${JSON.stringify(deckData)}, scene: null,
            };
            var typoDesc = window.__impressEffects.lookup('typography', typoName);
            var transDesc = window.__impressEffects.lookup('transition', transName);
            if (typoDesc) activeCleanups.push(typoDesc.apply(ctx));
            if (transDesc) activeCleanups.push(transDesc.apply(ctx));
          });

          impress().init();
        </script>
      </body>
    </html>
  `;

  return htmlContent;
};

/**
 * Resolve raw paragraph input (string or string[]) into the slideData shape
 * that buildImpressHTML expects. For string input this calls the AI; for
 * array input it wraps each item as a plain slide.
 *
 * @param {string|string[]} paragraph
 * @returns {Promise<Object>} slideData
 */
const resolveSlideData = async (paragraph) => {
  if (Array.isArray(paragraph)) {
    return {
      layout_theme: null,
      global_mood: null,
      background: null,
      data: paragraph.map((p) => ({
        content: p,
        role: null,
        typography: null,
        transition: null,
        background: null,
      })),
    };
  }

  const prompt = createDecomposeParagraphPrompt(paragraph);
  const r = await spineApi.generateContentWithJson(prompt, null, {
    label: 'impress-slide-decompose',
  });

  if (r && Array.isArray(r.data) && r.data.length > 0) {
    return {
      layout_theme: r.layout_theme || null,
      global_mood: r.global_mood || null,
      background: r.background || null,
      data: r.data.map((item) => ({
        content: item.content,
        role: item.role || null,
        typography: item.typography || null,
        transition: item.transition || null,
        background: item.background || null,
      })),
    };
  }

  // Fallback: tokenize raw text into sentences when AI gives nothing usable
  const sentences = await customStorage.sentenceTokenizer(paragraph);
  return {
    layout_theme: null,
    global_mood: null,
    background: null,
    data: sentences.map((p) => ({
      content: p,
      role: null,
      typography: null,
      transition: null,
      background: null,
    })),
  };
};

/**
 * Generate HTML content for impress.js presentation
 * @param {Object} options - Options object
 * @param {string|string[]} options.paragraph - Text to convert to slides
 * @returns {Promise<string|null>} - HTML content for the presentation, or null if no content
 */
const generateImpressHTML = async ({ paragraph }) => {
  const slideData = await resolveSlideData(paragraph);
  return buildImpressHTML(slideData);
};

/**
 * Open impress.js presentation in a new window
 * @param {Object} options - Options object
 * @param {string|string[]} options.paragraph - Text to convert to slides
 * @returns {Promise<void>}
 */
const openImpressWindow = async ({ paragraph }) => {
  try {
    console.log('[ImpressJS] Opening presentation window...');
    const htmlContent = await generateImpressHTML({ paragraph });
    if (!htmlContent) {
      console.warn('[ImpressJS] No content generated for presentation');
      return;
    }

    console.log('[ImpressJS] HTML content generated, opening window...');

    // Open a new window with the presentation
    const presentationWindow = window.open('', '_blank', 'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no');
    if (presentationWindow) {
      presentationWindow.document.write(htmlContent);
      presentationWindow.document.close();
      presentationWindow.focus();
      console.log('[ImpressJS] Presentation window opened successfully');
    } else {
      console.error('[ImpressJS] Failed to open presentation window - popup may be blocked');
      // Fallback: use IPC to open in Electron BrowserWindow
      if (window.electron?.ipcRenderer?.openPresentationWindow) {
        window.electron.ipcRenderer.openPresentationWindow(htmlContent);
      }
    }
  } catch (error) {
    console.error('[ImpressJS] Error opening presentation:', error);
  }
};

export { buildImpressHTML, resolveSlideData, generateImpressHTML, openImpressWindow };
export default openImpressWindow;
