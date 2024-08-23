import customStorage from '../../store/customStorage';

import { createDecomposeParagraphPrompt } from '../../../commons/utils/AIPrompts';
import aiProviderManager from '../../../commons/service/AIProviderManager';

const openImpressWindow = async ({ paragraph }) => {
  const predefined = [
    ` class="step slide" data-x="0" data-y="-1500"`,
    ` class="step slide" data-x="1000" data-y="-1500"`,
    ` class="step" data-x="0" data-y="0" data-scale="4"`,
    ` class="step" data-x="850" data-y="3000" data-rotate="90" data-scale="5"`,
    ` class="step" data-x="3500" data-y="2100" data-rotate="180" data-scale="6"`,
    ` class="step" data-x="2825" data-y="2325" data-z="-3000" data-rotate="300" data-scale="1"`,
    ` class="step" data-x="3500" data-y="-850" data-z="0" data-rotate="270" data-scale="6"`,
    ` class="step" data-x="6700" data-y="-300" data-scale="6"`,
    ` class="step" data-x="6300" data-y="2000" data-rotate="20" data-scale="4"`,
    ` class="step" data-x="6000" data-y="4000" data-scale="2"`,
    ` class="step" data-x="6200" data-y="4300" data-z="-100" data-rotate-x="-40" data-rotate-y="10" data-scale="2"`,
    ` class="step" data-x="3000" data-y="1500" data-z="0" data-scale="10"`,
    // { class: 'slide', x: 0, y: -1500 },
    // { class: 'slide', x: 1000, y: -1500 },
    // { x: 0, y: 0, scale: 4 },
    // { x: 850, y: 3000, scale: 5, rotate: 90 },
    // { x: 3500, y: 2100, scale: 6, rotate: 180 },
    // { x: 2825, y: 2325, z: -3000, scale: 1, rotate: 300 },
    // { x: 3500, y: -850, z: 0, scale: 6, rotate: 270 },
    // { x: 6700, y: -300, scale: 4, rotate: 20 },
    // { x: 6300, y: 2000, scale: 4, rotate: 20 },
    // { x: 6000, y: 4000, scale: 2 },
    // { x: 6200, y: 4300, z: -100, scale: 2, 'rotate-x': -40, 'rotate-y': 10 },
    // { x: 3000, y: 1500, z: 0, scale: 10 },
  ];

  async function t(input) {
   // if (!openai) return [];
    const prompt = createDecomposeParagraphPrompt(input);
    const r = await aiProviderManager.generateContentWithJson(prompt, true);
    const a = [];
    if (r && r.data) {
      r.data.forEach((item) => a.push(item.content));
    }
    return a;
  }
  let sentences = [];
  if (Array.isArray(paragraph)) sentences = paragraph;
  else {
   // if (openai) {
      sentences = await t(paragraph);
   // }
    if (!sentences || sentences.length === 0) {
      sentences = await customStorage.sentenceTokenizer(paragraph);
    }
  }
  if (sentences.length === 0) return;
  // merge sentence if too short
  // const sentences = [];
  // const tooBigToMerge = 50;
  // const canBeOnePage = 35;
  // let prev = '';
  // for (let i = 0; i < ss.length; i++) {
  //   const cur = ss[i];
  //   if (cur.length > tooBigToMerge) {
  //     if (prev.length > 0) sentences.push(prev);
  //     sentences.push(cur);
  //     prev = '';
  //   } else {
  //     prev += ` ${ss[i]}`;
  //     if (prev.length > canBeOnePage) {
  //       sentences.push(prev);
  //       prev = '';
  //     }
  //   }
  // }
  // if (prev.length > 0) sentences.push(prev);

  console.log(` sentences ${sentences.length} = ${sentences}`);
  // const currentDirectory = await window.electron.ipcRenderer.dirname();
  // console.log(currentDirectory);
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
  const numPredefined = predefined.length;
  // let index = 0;
  // for (let i = 0; i < numSentences; i++) {
  //   const element = sentences[i];
  //   steps += `
  //   <div id="step-${index}" ${predefined[index % numPredefined]} >
  //   ${element}
  //   </div>`;
  //   if (index !== 0 && index % numPredefined === 0) {
  //     index += index;
  //     steps += `
  //     <div id="step-${index}" ${predefined[0]} >
  //     </div>`;
  //   }
  //   index += index;
  // }

  sentences.forEach((element, index) => {
    steps += `
    <div id="step-${index}" ${predefined[index % numPredefined]} >
    ${element}
    </div>`;
  });

  const impressWindow = window.open(
    '',
    'Impress.js Presentation',
    'width=1024,height=768',
  );
  impressWindow.document.write(`
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

        <script src="${scriptPath}"></script>
        <script>
          document.addEventListener("impress:stepenter", function (event) {
            var currentStep = event.target.id.split('-')[1];
            currentStep = parseInt(currentStep, 10);
            var d = parseInt(currentStep / ${numPredefined}, 10);
            var r = parseInt(currentStep % ${numPredefined}, 10);
            var start = d * ${numPredefined};
            var end = start + ${numPredefined} ;
            for (var i = 1; i <= ${numSentences}; i++) {
                var step = document.getElementById('step-' + i);
                if (!step) continue
                if (i >= start && i < end) {
                    step.style.visibility = 'visible';
                } else {
                    step.style.visibility = 'hidden';
                }
            }
           });
           impress().init();
        </script>
      </body>
    </html>
  `);

  impressWindow.document.close();
};

export default openImpressWindow;
