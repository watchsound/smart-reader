// src/App.js
import React, { useState, useEffect } from 'react';
import { Container, Grid, Box, CardContent, Card } from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';

import FontSelector from '../FontSelector';
import ColorMultiplePicker from '../ColorMultiplePicker';
import populateCardHtmlCode, { templateFuncs } from './card-templates';
import decomposeHTML from './CardSettingUtil';
import { parseMarkdownToHtmlNoCallback } from '../note/NoteUtil';
import ImageSelector from '../ImageSelector';
import FontSizeAndSpacingSelector from '../FontSizeAndSpacingSelector';
import { getImage } from '../../api/booksApi';
import customStorage from '../../store/customStorage';

/**
 *cardData
{
  image: xxx,
  bgImage: xxx,
  bgColor: xxx,
  foreColor: xxx,
  borderColor: xxx,
  fontFamily: xxx,
  fontSize: xx,
  lineHeight: xx,
  templateId: xxx,
  text: xxx,
}

localCardData: //used to populate template
{
  image: xxx,
  title: xxx,
  textBox: [
    { id: '', content: 'xxx'},
    { id: '', content: 'xxx'}
  ]
}

 */
function CardSettingPanel({
  cardData,
  cardTitle,
  width,
  height,
  selectionCallback,
}) {
  const [fontFamily, setFontFamily] = useState('Arial');
  const [colors, setColors] = useState(['#000000', '#FFFFFF', '#000000']);
  const [bgImage, setBgImage] = useState(0);
  const [imageSrc, setImageSrc] = useState('');
  const [localCardData, setLocalCardData] = useState(null);
  const [templateCodes, setTemplateCodes] = useState([]);
  const [assetsPath, setAssetsPath] = useState('');
  const [fontSize, setFontSize] = useState(16);
  const [lineHeight, setLineHeight] = useState(1.3);
  const [selected, setSelected] = useState(-1);

  const updateTemplateUI = (
    localCardData,
    fontFamily,
    fontSize,
    lineHeight,
    bgImage,
    colors,
  ) => {
    const tc = [];
    const bgImageSrc = bgImage
      ? `${assetsPath}/card-bg/t-${bgImage}-min.jpg`
      : '';
    const imageUrl = bgImage ? `file://${bgImageSrc.replace(/\\/g, '/')}` : '';
    templateFuncs.forEach((f) => {
      tc.push(
        populateCardHtmlCode({
          cardData: localCardData,
          width,
          height,
          bgColor: colors[1] ?? '#FFFFFF',
          bgImage: imageUrl,
          foreColor: colors[2] ?? '#000000',
          borderColor: colors[0] ?? '#000000',
          fontFamily,
          fontSize,
          lineHeight,
          templateId: f.id,
        }),
      );
    });
    setTemplateCodes(tc);
  };

  useEffect(() => {
    const hasTitle = !!cardTitle;
    async function t() {
      const defaultColors = await customStorage.getNoteColorSetting();
      const cs = [
        cardData.borderColor ?? defaultColors[0],
        cardData.bgColor ?? defaultColors[1],
        cardData.foreColor ?? defaultColors[2],
      ];
      setColors(cs);
      let defaultFontFamily = cardData.fontFamily;
      if (!cardData.fontFamily)
        defaultFontFamily = await customStorage.getFontFamily();
      setFontFamily(defaultFontFamily);
      let defaultBgImage = cardData.bgImage;
      if (!cardData.bgImage)
        defaultBgImage = await customStorage.getNoteBgImage();
      setBgImage(defaultBgImage);
      const aPath = await window.electron.ipcRenderer.getAssetRootPath();
      setAssetsPath(aPath);
      const imgSrc =
        typeof cardData.image === 'string' &&
        cardData.image.startsWith('data:image/png;base64')
          ? cardData.image
          : await getImage(cardData.image);
      setImageSrc(imgSrc || '');
      const text = await parseMarkdownToHtmlNoCallback(cardData.text);
      const { title, chunks } = decomposeHTML(text, !hasTitle);
      const d = [];
      chunks.forEach((m, index) => d.push({ id: index, content: m }));
      const ld = {
        title: cardTitle ?? title,
        image: imgSrc,
        textBox: d,
        htmlCode: text,
      };
      setLocalCardData(ld);
      updateTemplateUI(
        ld,
        defaultFontFamily,
        fontSize,
        lineHeight,
        defaultBgImage,
        cs,
      );
    }
    t();
  }, [cardData, width, height]);

  const templateSelected = (templateIndex) => {
    setSelected(templateIndex);
    if (selectionCallback)
      selectionCallback({
        ...cardData,
        templateId: templateIndex,
        borderColor: colors[0],
        bgColor: colors[1],
        foreColor: colors[2],
        bgImage,
        fontFamily,
      });
  };
  const onImageChange = (imageIndex) => {
    setBgImage(imageIndex);
    updateTemplateUI(
      localCardData,
      fontFamily,
      fontSize,
      lineHeight,
      imageIndex,
      colors,
    );
  };
  const onColorChange = (colors) => {
    setColors(colors);
    updateTemplateUI(
      localCardData,
      fontFamily,
      fontSize,
      lineHeight,
      bgImage,
      colors,
    );
  };
  const onFontChange = (font) => {
    setFontFamily(font);
    updateTemplateUI(
      localCardData,
      font,
      fontSize,
      lineHeight,
      bgImage,
      colors,
    );
  };
  const onSpacingChange = (lineHeight) => {
    setLineHeight(lineHeight);
    updateTemplateUI(
      localCardData,
      fontFamily,
      fontSize,
      lineHeight,
      bgImage,
      colors,
    );
  };
  const onFontSizeChange = (fontSize) => {
    setFontSize(fontSize);
    updateTemplateUI(
      localCardData,
      fontFamily,
      fontSize,
      lineHeight,
      bgImage,
      colors,
    );
  };

  return (
    <Container style={{ padding: 20 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={3}>
          <FontSelector onFontChange={onFontChange} />
        </Grid>
        <Grid item xs={12} sm={3}>
          <ColorMultiplePicker onColorChange={onColorChange} />
        </Grid>
        <Grid item xs={12} sm={3}>
          <FontSizeAndSpacingSelector
            onFontSizeChange={onFontSizeChange}
            onSpacingChange={onSpacingChange}
          />
        </Grid>
        <Grid item xs={12} sm={3}>
          <ImageSelector onImageChange={onImageChange} />
        </Grid>
      </Grid>
      <Box
        display="flex"
        flexWrap="wrap"
        justifyContent="flex-start"
        style={{ marginTop: 20 }}
      >
        {templateCodes.map((code, index) => (
          <Box
            key={index}
            width={width} // Fixed width for each card
            height={height} // Fixed height for each card
            margin={1}
            onClick={() => templateSelected(index)}
            style={{
              flex: `1 1 ${width}px`,
              maxWidth: width,
              position: 'relative',
            }}
          >
            {selected === index && (
              <BookmarkIcon
                sx={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  color: '#913831',
                }}
              />
            )}
            <Card>
              <CardContent
                sx={{
                  margin: '2px',
                  overflowY: 'auto',
                  maxWidth: `${width + 25}px`,
                  maxHeight: `${height + 25}px`,
                }}
              >
                <div
                  className="note__body"
                  dangerouslySetInnerHTML={{ __html: code }}
                />
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>
    </Container>
  );
}

export default CardSettingPanel;
