// src/components/cardsetting/CardSettingPanel.js
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Tooltip,
  Chip,
} from '@mui/material';
import { styled, useTheme, alpha } from '@mui/material/styles';

// Icons
import BookmarkIcon from '@mui/icons-material/Bookmark';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TextFormatIcon from '@mui/icons-material/TextFormat';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import FormatSizeIcon from '@mui/icons-material/FormatSize';
import ImageIcon from '@mui/icons-material/Image';
import GridViewIcon from '@mui/icons-material/GridView';

import FontSelector from '../FontSelector';
import ColorMultiplePicker from '../ColorMultiplePicker';
import populateCardHtmlCode, { templateFuncs } from './card-templates';
import decomposeHTML from './CardSettingUtil';
import { parseMarkdownToHtmlNoCallback } from '../note/NoteUtil';
import ImageSelector from '../ImageSelector';
import FontSizeAndSpacingSelector from '../FontSizeAndSpacingSelector';
import { getImage } from '../../api/booksApi';
import customStorage from '../../store/customStorage';

// Styled components
const SettingSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: '12px',
  backgroundColor: alpha(theme.palette.background.paper, 0.8),
  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
  transition: 'all 0.2s ease',
  '&:hover': {
    borderColor: alpha(theme.palette.primary.main, 0.2),
  },
}));

const SectionLabel = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(1.5),
}));

const TemplateCard = styled(Card)(({ theme, selected }) => ({
  cursor: 'pointer',
  position: 'relative',
  borderRadius: '12px',
  border: selected
    ? `2px solid ${theme.palette.primary.main}`
    : `1px solid ${alpha(theme.palette.divider, 0.15)}`,
  boxShadow: selected
    ? `0 4px 20px ${alpha(theme.palette.primary.main, 0.25)}`
    : 'none',
  transition: 'all 0.2s ease-in-out',
  overflow: 'hidden',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: `0 8px 24px ${alpha(theme.palette.text.primary, 0.1)}`,
    borderColor: selected
      ? theme.palette.primary.main
      : alpha(theme.palette.primary.main, 0.4),
  },
}));

function CardSettingPanel({
  cardData,
  cardTitle,
  width,
  height,
  selectionCallback,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

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
    <Box sx={{ p: 3 }}>
      {/* Settings Row */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 2,
          mb: 3,
        }}
      >
        {/* Font Setting */}
        <SettingSection>
          <SectionLabel>
            <TextFormatIcon
              sx={{ fontSize: 18, color: theme.palette.primary.main }}
            />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              Font Family
            </Typography>
          </SectionLabel>
          <FontSelector onFontChange={onFontChange} />
        </SettingSection>

        {/* Colors Setting */}
        <SettingSection>
          <SectionLabel>
            <FormatColorFillIcon
              sx={{ fontSize: 18, color: theme.palette.warning.main }}
            />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              Colors
            </Typography>
          </SectionLabel>
          <ColorMultiplePicker onColorChange={onColorChange} />
        </SettingSection>

        {/* Font Size & Spacing */}
        <SettingSection>
          <SectionLabel>
            <FormatSizeIcon
              sx={{ fontSize: 18, color: theme.palette.info.main }}
            />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              Size & Spacing
            </Typography>
          </SectionLabel>
          <FontSizeAndSpacingSelector
            onFontSizeChange={onFontSizeChange}
            onSpacingChange={onSpacingChange}
          />
        </SettingSection>

        {/* Background Image */}
        <SettingSection>
          <SectionLabel>
            <ImageIcon
              sx={{ fontSize: 18, color: theme.palette.success.main }}
            />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              Background Image
            </Typography>
          </SectionLabel>
          <ImageSelector onImageChange={onImageChange} />
        </SettingSection>
      </Box>

      {/* Templates Section */}
      <Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            mb: 2,
          }}
        >
          <GridViewIcon
            sx={{ fontSize: 20, color: theme.palette.primary.main }}
          />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Choose Layout Template
          </Typography>
          <Chip
            label={`${templateCodes.length} templates`}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.7rem',
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
            }}
          />
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${width}px, 1fr))`,
            gap: 2,
            maxHeight: '400px',
            overflowY: 'auto',
            p: 1,
            '&::-webkit-scrollbar': {
              width: 8,
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: alpha(theme.palette.text.primary, 0.2),
              borderRadius: 4,
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: alpha(theme.palette.text.primary, 0.05),
              borderRadius: 4,
            },
          }}
        >
          {templateCodes.map((code, index) => (
            <Tooltip
              key={index}
              title={`Template ${index + 1}${selected === index ? ' (Selected)' : ''}`}
              placement="top"
              arrow
            >
              <TemplateCard
                selected={selected === index}
                onClick={() => templateSelected(index)}
              >
                {/* Selected indicator */}
                {selected === index && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 10,
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      bgcolor: theme.palette.primary.main,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.4)}`,
                    }}
                  >
                    <CheckCircleIcon
                      sx={{ fontSize: 16, color: '#fff' }}
                    />
                  </Box>
                )}

                <CardContent
                  sx={{
                    p: '8px !important',
                    '&:last-child': { pb: '8px !important' },
                  }}
                >
                  <Box
                    sx={{
                      maxWidth: `${width + 10}px`,
                      maxHeight: `${height + 10}px`,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      className="note__body"
                      dangerouslySetInnerHTML={{ __html: code }}
                    />
                  </Box>
                </CardContent>
              </TemplateCard>
            </Tooltip>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

export default CardSettingPanel;
