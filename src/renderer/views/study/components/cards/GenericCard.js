/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/prop-types */
/**
 * GenericCard — fallback for domains without a specialty card, and the
 * behavior-identical replacement for the original StudyCard rendering.
 *
 * Renders item.front on the front and item.back on the back, with the
 * same dynamic font sizing the previous StudyCard used.
 */

import React from 'react';
import { Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CardShell from './CardShell';

// Preserved from the original StudyCard.js.
function getContentFontSize(text, isLong = false) {
  if (!text) return '1.5rem';
  const len = text.length;
  if (isLong) {
    if (len <= 50) return '1.1rem';
    if (len <= 100) return '1rem';
    if (len <= 200) return '0.95rem';
    return '0.9rem';
  }
  if (len <= 20) return '2rem';
  if (len <= 40) return '1.6rem';
  if (len <= 60) return '1.3rem';
  if (len <= 100) return '1.1rem';
  return '1rem';
}

function GenericCard(props) {
  const { item } = props;
  const theme = useTheme();

  const questionBody = (
    <Typography
      sx={{
        fontWeight: 700,
        fontSize: getContentFontSize(item?.front),
        color: theme.palette.text.primary,
        textAlign: 'center',
        lineHeight: 1.4,
        wordBreak: 'break-word',
      }}
    >
      {item?.front}
    </Typography>
  );

  const answerBody = (
    <Typography
      sx={{
        color: theme.palette.text.primary,
        fontSize: getContentFontSize(item?.back, true),
        lineHeight: 1.7,
      }}
    >
      {item?.back}
    </Typography>
  );

  return (
    <CardShell {...props} questionBody={questionBody} answerBody={answerBody} />
  );
}

export default GenericCard;
