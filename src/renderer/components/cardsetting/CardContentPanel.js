/* eslint-disable prefer-destructuring */
// src/components/Card.js
import React, { useState, useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

import populateCardHtmlCode, {
  cardImageOverlapTemplateId,
} from './card-templates';
import customStorage from '../../store/customStorage';
import { parseMarkdownToHtmlNoCallback } from '../note/NoteUtil';
import decomposeHTML from './CardSettingUtil';
import RichTextCard from '../richtext/RichTextCard';

/**
 *
 * @param {*} cardData : original data from note.cards
 * @param {*}  title :  it is shared across cards.
 * @param {*}   imageSrc:  cardData stores imageId, we already map to base64 string
 * @param {*}   width
 * @param {*}   height
 * @returns
 */
function CardContentPanel({
  cardData,
  cardTitle,
  imageSrc,
  width,
  height,
  useMiniHeight,
  entryEffect,
  emphasisEffect,
}) {
  // const [fontFamily, setFontFamily] = useState('Arial');
  // const [colors, setColors] = useState(['#000000', '#FFFFFF', '#000000']);
  // const [bgImage, setBgImage] = useState(0);
  // const [imageSrc, setImageSrc] = useState('');
  // const [localCardData, setLocalCardData] = useState(null);
  const [htmlCode, setHtmlCode] = useState('');
  const [assetsPath, setAssetsPath] = useState('');
  const [fontSize, setFontSize] = useState(16);
  const [lineHeight, setLineHeight] = useState(1.3);
  const containerRef = useRef(null);

  const updateTemplateUI = (
    localCardData,
    fontFamily,
    fontSize,
    lineHeight,
    bgImage,
    colors,
    aPath,
  ) => {
    const tc = [];
    const bgImageSrc = bgImage
      ? `${aPath}/card-bg/t-${bgImage}-min.jpg`
      : '';
    const imageUrl = bgImage ? `file://${bgImageSrc.replace(/\\/g, '/')}` : '';
    let templateId = cardData.templateId || 0;
    if (templateId === 0 && imageSrc) {
      templateId = cardImageOverlapTemplateId[0];
    }
    setHtmlCode(
      populateCardHtmlCode({
        cardData: localCardData,
        width,
        height,
        bgColor: colors[1] ?? '#FFFFFF',
        bgImage: imageUrl,
        foreColor: colors[2] ?? '#000000',
        borderColor: colors[0] ?? '#000000A0',
        fontFamily,
        fontSize,
        lineHeight,
        templateId,
        useMiniHeight,
      }),
    );
  };

  useEffect(() => {
    if (!cardData) return;
    setFontSize(cardData.fontSize || 16);
    setLineHeight(cardData.lineHeight || 1.3);
    async function t() {
      const defaultColors = await customStorage.getNoteColorSetting();
      const cs = [
        cardData.borderColor ?? defaultColors[0],
        cardData.bgColor ?? defaultColors[1],
        cardData.foreColor ?? defaultColors[2],
      ];
      // setColors(cs);
      let defaultFontFamily = cardData.fontFamily;
      if (!cardData.fontFamily)
        defaultFontFamily = await customStorage.getFontFamily();
      //  setFontFamily(defaultFontFamily);
      let defaultBgImage = cardData.bgImage;
      if (!cardData.bgImage)
        defaultBgImage = await customStorage.getNoteBgImage();
      // setBgImage(defaultBgImage);
      const aPath = await window.electron.ipcRenderer.getAssetRootPath();
      setAssetsPath(aPath);
      const hasTitle = !!cardTitle;
      // Use html field if available (from rich editor), otherwise parse markdown from text
      let text;
      if (cardData.html && cardData.html.trim() !== '' && cardData.html !== '<p></p>') {
        // Rich editor content - already HTML, but may need KaTeX rendering for math
        text = cardData.html;
      } else {
        // Markdown content - parse to HTML
        text = await parseMarkdownToHtmlNoCallback(cardData.text);
      }
      const { title, chunks } = decomposeHTML(text, !hasTitle);
      const d = [];
      chunks.forEach((m, index) => d.push({ id: index, content: m }));
      const ld = {
        title: cardTitle ?? title,
        image: imageSrc || '',
        textBox: d,
        htmlCode: text,
      };
      //  setLocalCardData(ld);
      updateTemplateUI(
        ld,
        defaultFontFamily,
        fontSize,
        lineHeight,
        defaultBgImage,
        cs,
        aPath,
      );
    }
    t();
  }, [cardData, cardTitle, imageSrc, width, height]);

  // Render KaTeX for any math expressions in the HTML (from rich editor)
  useEffect(() => {
    if (!containerRef.current || !htmlCode) return;

    // Find all elements with data-mathjax attribute and render them
    const mathElements = containerRef.current.querySelectorAll('[data-mathjax]');
    mathElements.forEach((el) => {
      const content = el.getAttribute('data-content');
      const isInline = el.getAttribute('data-inline') !== 'false';
      if (content) {
        try {
          katex.render(content, el, {
            displayMode: !isInline,
            throwOnError: false,
            errorColor: '#ff9800',
            trust: true,
          });
        } catch (err) {
          console.error('KaTeX rendering error:', err);
          el.textContent = isInline ? `$${content}$` : `$$${content}$$`;
        }
      }
    });
  }, [htmlCode]);

  if (!useMiniHeight && (entryEffect !== '' || emphasisEffect !== ''))
    return (
      <RichTextCard
        input={htmlCode}
        isHtml
        tokenCallback={() => {}}
        showToken
        entryEffect={entryEffect}
        emphasisEffect={emphasisEffect}
      />
    );
  return (
    <div
      ref={containerRef}
      className="note__body"
      dangerouslySetInnerHTML={{ __html: htmlCode }}
    />
  );
}

export default CardContentPanel;
