/* eslint-disable prettier/prettier */
import customStorage from '../../store/customStorage';

import { createDecomposeParagraphPrompt } from '../../../commons/utils/AIPrompts';
import { instanceInRender as aiProviderManager } from '../../../commons/service/AIProviderManager';
import { generateLayout, selectLayoutTheme } from './layoutGenerators';

/**
 * Generate HTML content for impress.js presentation
 * @param {Object} options - Options object
 * @param {string|string[]} options.paragraph - Text to convert to slides
 * @returns {Promise<string|null>} - HTML content for the presentation, or null if no content
 */
const generateImpressHTML = async ({ paragraph }) => {
  let sentences = [];
  let suggestedTheme = null;

  async function decomposeWithAI(input) {
    const prompt = createDecomposeParagraphPrompt(input);
    const r = await aiProviderManager.generateContentWithJson(prompt, true);
    const a = [];
    let theme = null;
    if (r) {
      // Extract layout theme if provided
      if (r.layout_theme) {
        theme = r.layout_theme;
      }
      // Extract content
      if (r.data) {
        r.data.forEach((item) => a.push(item.content));
      }
    }
    return { contents: a, theme };
  }

  if (Array.isArray(paragraph)) {
    sentences = paragraph;
  } else {
    const result = await decomposeWithAI(paragraph);
    sentences = result.contents;
    suggestedTheme = result.theme;

    if (!sentences || sentences.length === 0) {
      sentences = await customStorage.sentenceTokenizer(paragraph);
    }
  }

  if (sentences.length === 0) return null;

  console.log(`sentences ${sentences.length} = ${sentences}`);
  console.log(`AI suggested theme: ${suggestedTheme}`);

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

  let steps = '';
  const numSentences = sentences.length;

  sentences.forEach((element, index) => {
    steps += `
    <div id="step-${index}" ${layouts[index]} >
    ${element}
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
          /* Slide visibility - fade non-active slides to very light color */
          .step {
            opacity: 1;
            color: rgba(200, 200, 200, 0.08);
            transition: color 0.5s ease-in-out;
          }
          .step.active {
            color: inherit;
          }
          /* Past and future slides should have very light text */
          .step.past, .step.future {
            color: rgba(200, 200, 200, 0.08);
          }

          /* Enhanced styles for HTML content in slides */
          .step h3, .step h4 {
            margin: 0 0 0.5em 0;
            color: #fff;
          }
          .step ul, .step ol {
            margin: 0.5em 0;
            padding-left: 1.5em;
            text-align: left;
          }
          .step li {
            margin: 0.3em 0;
          }
          .step table {
            border-collapse: collapse;
            margin: 0.5em auto;
          }
          .step td, .step th {
            border: 1px solid rgba(255,255,255,0.3);
            padding: 0.4em 0.8em;
          }
          .step th {
            background: rgba(255,255,255,0.1);
          }
          .step p {
            margin: 0.3em 0;
          }
          .step strong, .step b {
            color: #ffd700;
          }
          .step em, .step i {
            color: #87ceeb;
          }
          .hint {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            color: rgba(255,255,255,0.5);
            font-size: 14px;
            transition: opacity 0.5s;
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
          data-perspective="1000"
          data-autoplay="7">
         ${steps}
        </div>
        <div id="impress-toolbar"></div>
        <div class="hint">
          <p>Use spacebar, arrow keys, or click to navigate</p>
        </div>

        <script src="${scriptPath}"></script>
        <script>
          // Hide hint after first interaction
          document.addEventListener("impress:stepenter", function() {
            var hint = document.querySelector('.hint');
            if (hint) hint.style.opacity = '0';
          }, { once: true });

          impress().init();
        </script>
      </body>
    </html>
  `;

  return htmlContent;
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

export { generateImpressHTML, openImpressWindow };
export default openImpressWindow;
