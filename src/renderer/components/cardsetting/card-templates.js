import Handlebars from 'Handlebars';
import { stripLeadingAndEndingTags } from './CardSettingUtil';

const template0 = ({
  cardData,
  width,
  height,
  useMiniHeight,
  bgColor,
  bgImage,
  foreColor,
  borderColor,
  fontFamily,
  fontSize,
  lineHeight,
}) => {
  const heightAttr = useMiniHeight ? 'miniHeight' : 'height';
  const backgroundCode =
    bgImage || cardData.image
      ? `background-image: url('${cardData.image || bgImage}'); background-size: cover; ; opacity: 0.4;`
      : `background-color: ${`${bgColor}7F`};  `;
  return `
     <div  class="card-container" style="width: ${width}px; ${heightAttr}: ${height}px; padding: 5px;   display: flex; flex-direction: column; align-items: center; justify-content: center; color: ${foreColor}; font-size: ${fontSize}px; line-height: ${lineHeight}; font-family: ${fontFamily};">
       ${cardData.htmlCode}
      <div class="card-container-bg-mask" style="${backgroundCode} "></>
    </div>
  `;
};

const template1 = ({
  cardData,
  width,
  height,
  bgColor,
  bgImage,
  foreColor,
  borderColor,
  fontFamily,
  fontSize,
  lineHeight,
}) => {
  const imageSize = Math.min(width, height) / 2;
  const imageCode = cardData.image
    ? `
    <div style="flex: 1; display: flex; align-items: center; justify-content: center;">
        <img src="${cardData.image}"  style="max-width: ${imageSize}px; max-height: ${imageSize}px; border: 1px solid #000; border-radius: 50%; padding: 10px;">
    </div>
  `
    : '';
  const backgroundCode = bgImage
    ? `background-image: url('${bgImage}'); background-size: cover; opacity: 0.4;  `
    : `background-color: ${bgColor};  opacity: 0.4`;

  return `
    <div  class="card-container" style="width: ${width}px; height: ${height}px;  padding: 5px;    display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: ${fontFamily};">
        ${imageCode}
        <div style="flex: 0; text-align: center; font-size: ${fontSize + 2}px; line-height: ${lineHeight}; font-weight: bold; color: ${foreColor};">
            ${cardData.title}
        </div>
        <div style="flex: 0; text-align: center; font-size: ${fontSize}px; line-height: ${lineHeight}; font-weight: bold; color: ${foreColor};">
             ${cardData.htmlCode}
        </div>
        <div class="card-container-bg-mask" style="${backgroundCode} "></>
    </div>
  `;
};

const template2 = ({
  cardData,
  width,
  height,
  bgColor,
  bgImage,
  foreColor,
  borderColor,
  fontFamily,
  fontSize,
  lineHeight,
}) => {
  let listStr = '';
  cardData.textBox.forEach((m) => {
    listStr += `<li id="${m.id}">${m.content}</li>`;
  });
  const backgroundCode =
    bgImage || cardData.image
      ? `background-image: url('${cardData.image || bgImage}'); background-size: cover; ; opacity: 0.4;`
      : `background-color: ${`${bgColor}7F`};   `;
  return `
    <div class="card-container" style="width: ${width}px; height: ${height}px; padding: 5px;     display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: ${fontSize}px; line-height: ${lineHeight}; font-family: ${fontFamily};">

      <div style=" flex: 1; display: flex; flex-direction: column; align-items: flex-start; justify-content: center;  ">
        <ul style="padding-left: 20px; color: ${foreColor};">
            ${listStr}
        </ul>
      </div>
      <div class="card-container-bg-mask" style="${backgroundCode} "></>
    </div>
  `;
};

const template3 = ({
  cardData,
  width,
  height,
  bgColor,
  bgImage,
  foreColor,
  borderColor,
  fontFamily,
  fontSize,
  lineHeight,
}) => {
  const imageSize = Math.min(width, height) / 2;
  const restBox = [];
  cardData.textBox.forEach((m, index) => {
    restBox.push(m.content);
  });
  const imageCode = cardData.image
    ? `
     <div style="flex: 1; display: flex; align-items: center; justify-content: center;">
          <img src="${cardData.image}" alt="rocks" style="max-width: ${imageSize}px; max-height: ${imageSize}px;">
      </div>
  `
    : '';

  const backgroundCode = bgImage
    ? `background-image: url('${bgImage}'); background-size: cover; opacity: 0.4; `
    : `background-color: ${`${bgColor}7F`};   `;
  const t = `
    <div  class="card-container" style="width: ${width}px; height: ${height}px;  padding: 5px;    display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: ${fontFamily};">
      <div style="flex: 0; text-align: center;  font-size: ${fontSize + 2}px; line-height: ${lineHeight};  font-weight: bold; color: #000; margin-bottom: 10px;">
        ${cardData.title}
      </div>
      ${imageCode}
      {{#each restBox}}
        <div id="{{this.id}}" style="flex: 0; text-align: center;  font-size: ${fontSize}px; line-height: ${lineHeight};  color: ${foreColor}; margin-top: 10px;">
            {{this}}
        </div>
      {{/each}}
      <div class="card-container-bg-mask" style="${backgroundCode} "></>
    </div>
  `;
  const template = Handlebars.compile(t);
  return template({ restBox });
};

const template4 = ({
  cardData,
  width,
  height,
  bgColor,
  bgImage,
  foreColor,
  borderColor,
  fontFamily,
  fontSize,
  lineHeight,
}) => {
  const imageSize = Math.min(width, height) / 2;
  const restBox = [];
  cardData.textBox.forEach((m, index) => {
    restBox.push(m.content);
  });
  const backgroundCode = bgImage
    ? `background-image: url('${bgImage}'); background-size: cover; opacity: 0.4; `
    : `background-color: ${`${bgColor}7F`};   `;
  const imageCode = cardData.image
    ? `
    <div style="flex: 1; display: flex; align-items: center; justify-content: center;">
        <img src="${cardData.image}" alt="minerals" style="max-width: ${imageSize}px; max-height: ${imageSize}px;">
    </div>
  `
    : '';
  const t = `
    <div  class="card-container" style="width: ${width}px; height: ${height}px; padding: 5px; border: 0.5px solid ${borderColor || bgColor}; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: ${fontFamily};">
     <div style="flex: 0; text-align: center;  font-size: ${fontSize + 2}px; line-height: ${lineHeight};  font-weight: bold; color: ${foreColor}; margin-bottom: 10px;">
        ${cardData.title}
    </div>
    ${imageCode}
     <div style="flex: 0; text-align: center; font-size: ${fontSize}px; line-height: ${lineHeight}; font-weight: bold; color: ${foreColor};">
        ${cardData.htmlCode}
      </div>
      <div class="card-container-bg-mask" style="${backgroundCode} "></>
    </div>
  `;
  return t;
  //  const template = Handlebars.compile(t);
  // return template({ restBox });
};

const template5 = ({
  cardData,
  width,
  height,
  bgColor,
  bgImage,
  foreColor,
  borderColor,
  fontFamily,
  fontSize,
  lineHeight,
}) => {
  const imageSize = Math.min(width, height) / 2;
  const restBox = [];
  cardData.textBox.forEach((m, index) => {
    restBox.push(m.content);
  });
  const backgroundCode = bgImage
    ? `background-image: url('${bgImage}'); background-size: cover; opacity: 0.4; `
    : `background-color: ${`${bgColor}7F`};   `;
  const imageCode = cardData.image
    ? `
      <div style="flex: 1; display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
          <img src="${cardData.image}" alt="mixture" style="max-width:  ${imageSize}; max-height:  ${imageSize}px;">
      </div>
  `
    : '';
  const t = `
    <div  class="card-container" style="width: ${width}px; height: ${height}px;   padding: 5px; border: 0.5px solid ${borderColor || bgColor}; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: ${fontFamily};">
      <div style="flex: 0; text-align: center;  font-size: ${fontSize - 2}px; line-height: ${lineHeight};  font-weight: bold; color: #000; margin-bottom: 5px;">
         DEFINITION
      </div>
      <div style="flex: 0; text-align: center;  font-size: ${fontSize + 2}px; line-height: ${lineHeight};  font-weight: bold;  background-color: #000; color: #FFF; padding: 5px 10px; border-radius: 5px; margin-bottom: 10px;">
          ${cardData.title}
      </div>
      ${imageCode}
      {{#each restBox}}
        <div id="{{this.id}}" style="flex: 0; text-align: center;  font-size: ${fontSize}px; line-height: ${lineHeight};  color: ${foreColor}; margin-top: 10px;">
            {{this}}
        </div>
     {{/each}}
      <div class="card-container-bg-mask" style="${backgroundCode} "></>
    </div>
  `;
  const template = Handlebars.compile(t);
  return template({ restBox });
};

const template6 = ({
  cardData,
  width,
  height,
  bgColor,
  bgImage,
  foreColor,
  borderColor,
  fontFamily,
  fontSize,
  lineHeight,
}) => {
  const restBox = [];
  cardData.textBox.forEach((m, index) => {
    restBox.push(m.content);
  });
  const backgroundCode =
    bgImage || cardData.image
      ? `background-image: url('${cardData.image || bgImage}'); background-size: cover; ; opacity: 0.4;`
      : `background-color: ${`${bgColor}7F`};   `;
  const t = `
    <div  class="card-container" style="width: ${width}px; height: ${height}px;  padding: 5px; border: 0.5px solid ${borderColor || bgColor}; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: ${fontFamily};">
      {{#each restBox}}
        <div style="flex: 1; display: flex; align-items: center; justify-content: center;   font-size: ${fontSize}px; line-height: ${lineHeight};  color: ${foreColor}; text-align: center;">
         {{this}}
        </div>
     {{/each}}
      <div class="card-container-bg-mask" style="${backgroundCode} "></>
    </div>
  `;
  const template = Handlebars.compile(t);
  return template({ restBox });
};

const template7 = ({
  cardData,
  width,
  height,
  bgColor,
  bgImage,
  foreColor,
  borderColor,
  fontFamily,
  fontSize,
  lineHeight,
}) => {
  const imageSize = Math.min(width, height) / 2;
  const backgroundCode = bgImage
    ? `background-image: url('${bgImage}'); background-size: cover; opacity: 0.4; `
    : `background-color: ${`${bgColor}7F`};   `;
  const imageCode = cardData.image
    ? `
        <div style="flex: 1; display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
            <img src="${cardData.image}" alt="rust" style="max-width: ${imageSize}px; max-height: ${imageSize}px; border-radius: 5px;">
        </div>
  `
    : '';
  const t = `
    <div  class="card-container" style="width: ${width}px; height: ${height}px;   padding: 5px; border: 0.5px solid ${borderColor || bgColor}; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: ${fontFamily};">
        <div style="flex: 0; text-align: center;  font-size: ${fontSize - 2}px; line-height: ${lineHeight};  font-weight: bold; color: ${foreColor}; margin-bottom: 5px;">
            ${cardData.title}
        </div>
        ${imageCode}
        <div id="${cardData.textBox.length > 0 ? cardData.textBox[0].id : ''}" style="flex: 0; text-align: center;  font-size: ${fontSize + 2}px; line-height: ${lineHeight};  font-weight: bold; color: ${foreColor}; margin-bottom: 5px;">
             ${cardData.textBox.length > 0 ? cardData.textBox[0].content : ''}
        </div>
        <div id="${cardData.textBox.length > 1 ? cardData.textBox[1].id : ''}" style="flex: 0; text-align: center;  font-size: ${fontSize}px; line-height: ${lineHeight};  color: ${foreColor};">
             ${cardData.textBox.length > 1 ? cardData.textBox[1].content : ''}
        </div>
         <div class="card-container-bg-mask" style="${backgroundCode} "></>
    </div>
  `;
  const template = Handlebars.compile(t);
  return template({ textBox: cardData.textBox });
};

const template8 = ({
  cardData,
  width,
  height,
  bgColor,
  bgImage,
  foreColor,
  borderColor,
  fontFamily,
  fontSize,
  lineHeight,
}) => {
  const restBox = [];
  cardData.textBox.forEach((m, index) => {
    restBox.push(m.content);
  });
  const backgroundCode =
    bgImage || cardData.image
      ? `background-image: url('${cardData.image || bgImage}'); background-size: cover; ; opacity: 0.4;`
      : `background-color: ${`${bgColor}7F`};   `;
  const t = `
    <div  class="card-container" style="width: ${width}px; height: ${height}px;   padding: 5px; border: 0.5px solid ${borderColor || bgColor}; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: ${fontFamily};">
      <div style="flex: 0; text-align: center;  font-size: ${fontSize + 2}px; line-height: ${lineHeight};  font-weight: bold; color: #4B5320; margin-bottom: 5px;">
         ${cardData.title}
      </div>

     {{#each restBox}}
        <div style="flex: 1; display: flex; align-items: center; justify-content: center;  font-size: ${fontSize}px; line-height: ${lineHeight};  line-height: 1.5; color: ${foreColor}; text-align: center;">
         {{this}}
        </div>
     {{/each}}
      <div class="card-container-bg-mask" style="${backgroundCode} "></>
    </div>
  `;
  const template = Handlebars.compile(t);
  return template({ restBox });
};

const template9 = ({
  cardData,
  width,
  height,
  bgColor,
  bgImage,
  foreColor,
  borderColor,
  fontFamily,
  fontSize,
  lineHeight,
}) => {
  const imageSize = Math.min(width, height) / 2;
  const restBox = [];
  cardData.textBox.forEach((m, index) => {
    restBox.push(m.content);
  });
  const backgroundCode = bgImage
    ? `background-image: url('${bgImage}'); background-size: cover; opacity: 0.4; `
    : `background-color: ${`${bgColor}7F`};   `;

  const imageCode = cardData.image
    ? `
      <div style="flex: 1; display: flex; align-items: center; justify-content: center; margin-bottom: 10px;">
          <img src="${cardData.image}" alt="rust" style="max-width: ${imageSize}px; max-height: ${imageSize}px; border-radius: 5px;">
      </div>
  `
    : '';
  const t = `
    <div  class="card-container" style="width: ${width}px; height: ${height}px;  padding: 5px; border: 0.5px solid ${borderColor || bgColor}; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: ${fontFamily};">

      <div style="flex: 0; text-align: center;  font-size: ${fontSize + 2}px; line-height: ${lineHeight};  font-weight: bold; color: #FFF; margin-bottom: 5px;">
         ${cardData.title}
      </div>
      ${imageCode}
      {{#each restBox}}
        <div style="flex: 1; display: flex; align-items: center; justify-content: center;  font-size: ${fontSize}px; line-height: ${lineHeight};  color: ${foreColor}; text-align: center;">
         {{this}}
        </div>
     {{/each}}
      <div class="card-container-bg-mask" style="${backgroundCode} "></>
    </div>
  `;
  const template = Handlebars.compile(t);
  return template({ restBox });
};

const templateWithImageEmbedded = ({
  cardData,
  width,
  height,
  bgColor,
  bgImage,
  foreColor,
  borderColor,
  fontFamily,
  fontSize,
  lineHeight,
  imageSize,
  left,
}) => {
  const hasContent = cardData.textBox.length > 0;
  const firstContent = stripLeadingAndEndingTags(
    hasContent ? cardData.textBox[0].content : '',
  );
  // const restBox = cardData.textBox.filter((m, index) => index !== 0);
  const restBox = [];
  cardData.textBox.forEach((m, index) => {
    if (index !== 0) restBox.push(m.content);
  });
  const backgroundCode = bgImage
    ? `background-image: url('${bgImage}'); background-size: cover; opacity: 0.4; `
    : `background-color: ${`${bgColor}7F`};   `;
  const imageCode = cardData.image
    ? `
         <img src="${cardData.image}"  style="width: ${imageSize}px; height: auto; ${left ? 'float: left; margin-right: 10px;' : 'float: right; margin-left: 10px;'};  border-radius: 5px;">

  `
    : '';

  const t = `
    <div  class="card-container" style="width: ${width}px; height: ${height}px;  padding: 5px; border: 0.5px solid ${borderColor || bgColor}; border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; font-family: ${fontFamily};">
      <div style="flex: 0; text-align: center;  font-size: ${fontSize + 2}px; line-height: ${lineHeight}; font-weight: bold; color: ${foreColor}; margin-bottom: 10px;">
          ${cardData.title}
      </div>
      <div style="flex: 1; display: flex; flex-direction: row; align-items: center; justify-content: space-between; margin: 5px 5px 5px 5px; width: 100%;">
          <div style="flex: 1;  font-size: ${fontSize - 2}px; line-height: ${lineHeight};  color: #000; margin-right: 5px;">
             ${imageCode}
             ${firstContent}
          </div>
      </div>
     {{#each restBox}}
        <div style="flex: 1; display: flex; align-items: center; justify-content: center;   font-size: ${fontSize}px; line-height: ${lineHeight};  color: ${foreColor}; text-align: center;">
         {{this}}
        </div>
     {{/each}}
      <div class="card-container-bg-mask" style="${backgroundCode} "></>
    </div>
  `;
  const template = Handlebars.compile(t);
  return template({ restBox, hasContent, firstContent });
};

const template10 = ({
  cardData,
  width,
  height,
  bgColor,
  bgImage,
  foreColor,
  borderColor,
  fontFamily,
  fontSize,
  lineHeight,
}) => {
  const imageSize = Math.min(width, height) / 2;
  const left = true;
  return templateWithImageEmbedded({
    cardData,
    width,
    height,
    bgColor,
    bgImage,
    foreColor,
    borderColor,
    fontFamily,
    fontSize,
    lineHeight,
    imageSize,
    left,
  });
};

const template11 = ({
  cardData,
  width,
  height,
  bgColor,
  bgImage,
  foreColor,
  borderColor,
  fontFamily,
  fontSize,
  lineHeight,
}) => {
  const imageSize = Math.min(width, height) / 3;
  const left = true;
  return templateWithImageEmbedded({
    cardData,
    width,
    height,
    bgColor,
    bgImage,
    foreColor,
    borderColor,
    fontFamily,
    fontSize,
    lineHeight,
    imageSize,
    left,
  });
};

const template12 = ({
  cardData,
  width,
  height,
  bgColor,
  bgImage,
  foreColor,
  borderColor,
  fontFamily,
  fontSize,
  lineHeight,
}) => {
  const imageSize = Math.min(width, height) / 2;
  const left = false;
  return templateWithImageEmbedded({
    cardData,
    width,
    height,
    bgColor,
    bgImage,
    foreColor,
    borderColor,
    fontFamily,
    fontSize,
    lineHeight,
    imageSize,
    left,
  });
};

const template13 = ({
  cardData,
  width,
  height,
  bgColor,
  bgImage,
  foreColor,
  borderColor,
  fontFamily,
  fontSize,
  lineHeight,
}) => {
  const imageSize = Math.min(width, height) / 3;
  const left = false;
  return templateWithImageEmbedded({
    cardData,
    width,
    height,
    bgColor,
    bgImage,
    foreColor,
    borderColor,
    fontFamily,
    fontSize,
    lineHeight,
    imageSize,
    left,
  });
};

const templateBgImageWithTextCenter = ({
  cardData,
  width,
  height,
  bgColor,
  bgImage,
  foreColor,
  borderColor,
  fontFamily,
  fontSize,
  lineHeight,
}) => {
  // const restBox = [];
  // cardData.textBox.forEach((m, index) => {
  //   restBox.push(m.content);
  // });
  const backgroundCode =
    bgImage || cardData.image
      ? `background-image: url('${cardData.image || bgImage}'); background-size: cover; `
      : `background-color: ${`${bgColor}7F`};   `;
  const t = `
   <div  class="card-container" style="width: ${width}px; height: ${height}px; padding: 5px; border: 0.5px solid ${borderColor}; border-radius: 10px;   font-family: ${fontFamily};   position: relative; overflow: hidden;">
     <div class="card-container-bg-mask" style="${backgroundCode} "></>
     <div style="position: relative; width: 100%; height: 100%;   display: flex; justify-content: center; align-items: center;" >
      <div style="width: 100%; background-color:  ${`${bgColor}7F`}; padding: 10px; text-align: center;  ">
          <div style="margin: 0;  font-size: ${fontSize}px; line-height: ${lineHeight};  color: ${foreColor};">
          ${cardData.htmlCode}
          </div>
      </div>
    </div>
   </div>
  `;
  return t;
  // const template = Handlebars.compile(t);
  // return template({ restBox });
};

const templateBgImageWithText = ({
  cardData,
  width,
  height,
  bgColor,
  bgImage,
  foreColor,
  borderColor,
  fontFamily,
  fontSize,
  lineHeight,
  position,
}) => {
  if (position === 'center' || !position)
    return templateBgImageWithTextCenter({
      cardData,
      width,
      height,
      bgColor,
      bgImage,
      foreColor,
      borderColor,
      fontFamily,
      fontSize,
      lineHeight,
    });
  let positionStr = '';
  if (position === 'top') positionStr = ' position: absolute; top: 0;';
  else if (position === 'bottom')
    positionStr = ' position: absolute; bottom: 0;';
  // const restBox = [];
  // cardData.textBox.forEach((m, index) => {
  //   restBox.push(m.content);
  // });
  const backgroundCode =
    bgImage || cardData.image
      ? `background-image: url('${cardData.image || bgImage}'); background-size: cover; `
      : `background-color: ${`${bgColor}7F`};   `;
  const t = `
   <div  class="card-container" style="width: ${width}px; height: ${height}px; padding: 5px;  display: flex; flex-direction: column; justify-content: flex-end; font-family: ${fontFamily};   position: relative; overflow: hidden;">
      <div class="card-container-bg-mask" style="${backgroundCode} "></>
     <div style="width: 100%; background-color: ${`${bgColor}7F`};    padding: 10px; text-align: center; ${positionStr}">
       <div style="margin: 0;  font-size: ${fontSize}px; line-height: ${lineHeight};  color: ${foreColor};">
         ${cardData.htmlCode}
        </div>
     </div>

   </div>
  `;
  return t;
  // const template = Handlebars.compile(t);
  // return template({ restBox });
};

const template14 = ({
  cardData,
  width,
  height,
  bgColor,
  bgImage,
  foreColor,
  borderColor,
  fontFamily,
  fontSize,
  lineHeight,
}) => {
  const position = 'top';
  return templateBgImageWithText({
    cardData,
    width,
    height,
    bgColor,
    bgImage,
    foreColor,
    borderColor,
    fontFamily,
    fontSize,
    lineHeight,
    position,
  });
};

const template15 = ({
  cardData,
  width,
  height,
  bgColor,
  bgImage,
  foreColor,
  borderColor,
  fontFamily,
  fontSize,
  lineHeight,
}) => {
  const position = 'bottom';
  return templateBgImageWithText({
    cardData,
    width,
    height,
    bgColor,
    bgImage,
    foreColor,
    borderColor,
    fontFamily,
    fontSize,
    lineHeight,
    position,
  });
};

const template16 = ({
  cardData,
  width,
  height,
  bgColor,
  bgImage,
  foreColor,
  borderColor,
  fontFamily,
  fontSize,
  lineHeight,
}) => {
  const position = 'center';
  return templateBgImageWithText({
    cardData,
    width,
    height,
    bgColor,
    bgImage,
    foreColor,
    borderColor,
    fontFamily,
    fontSize,
    lineHeight,
    position,
  });
};

const cardImageOverlapTemplateId = [1, 2, 3];

const templateFuncs = [
  { id: 0, func: template0 },
  { id: 1, func: template14 },
  { id: 2, func: template15 },
  { id: 3, func: template16 },
  { id: 4, func: template1 },
  { id: 5, func: template2 },
  { id: 6, func: template3 },
  { id: 7, func: template4 },
  { id: 8, func: template5 },
  { id: 9, func: template6 },
  { id: 10, func: template7 },
  { id: 11, func: template8 },
  { id: 12, func: template9 },
  { id: 13, func: template10 },
  { id: 14, func: template11 },
  { id: 15, func: template12 },
  { id: 16, func: template13 },
];

const populateCardHtmlCode = ({
  cardData,
  width,
  height,
  bgColor,
  bgImage,
  foreColor,
  borderColor,
  fontFamily,
  fontSize,
  lineHeight,
  templateId,
  useMiniHeight,
}) => {
  const templateId0 = useMiniHeight ? 0 : templateId;
  const template = templateFuncs.filter((m) => m.id === templateId0)[0];
  if (!template) return '';
  return template.func({
    cardData,
    width,
    height,
    bgColor,
    bgImage,
    foreColor,
    borderColor,
    fontFamily,
    fontSize,
    lineHeight,
    useMiniHeight,
  });
};

export default populateCardHtmlCode;
export {
  templateFuncs,
  cardImageOverlapTemplateId,
  template0,
  template14,
  template15,
  template16,
  template1,
  template2,
  template3,
  template4,
  template5,
  template6,
  template7,
  template8,
  template9,
  template10,
  template11,
  template12,
  template13,
};
