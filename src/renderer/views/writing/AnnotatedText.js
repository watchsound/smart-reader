/* eslint-disable prettier/prettier */
import React, { useState } from 'react';
import { CardContent, Divider, Paper, Typography } from '@mui/material';

function AnnotatedText({fullText}) {
//   const fullText = `Microwave ovens ${is}[0] generally more ${costlier}[1] than common ovens.
// Microwaves are very convenient.
// [0]. should be are
// [1]. should be costly`;

  const [highlighted, setHighlighted] = useState(null);

  // Parse the text to separate content and annotations
  const parseTextAndAnnotations = (text) => {
    const annotationPattern = /^\[\d{1,2}\]\s.*$/gm; // Matches annotations at the start of lines
    const annotations = text.match(annotationPattern) || [];
    const mainText = text.replace(annotationPattern, '').trim();

    // Clean and extract meaningful parts from annotations
    const cleanedAnnotations = annotations.map(line => {
      const firstSpaceIndex = line.indexOf(' ');
      return line.substring(firstSpaceIndex + 1).trim();
    });

    return { mainText, annotations: cleanedAnnotations };
  };
  const { mainText, annotations } = parseTextAndAnnotations(fullText);

  // Function to parse and display main text with interactive words
  const displayText = () => {
    const regex = /\${(.*?)}\[(\d+)\]/g; // Regex to match words and annotation indices
    const result = [];
    let lastIndex = 0;

    mainText.replace(regex, (match, p1, p2, offset) => {
      // Push preceding text
      result.push(
        <span key={offset}>{mainText.slice(lastIndex, offset)}</span>,
      );
      // Push highlighted word
      result.push(
        <span
          key={p1 + p2}
          style={{
            color: highlighted === p2 ? 'red' : 'blue',
            cursor: 'pointer',
          }}
          onClick={() => setHighlighted(p2)}
        >
          {p1}
        </span>,
      );
      lastIndex = offset + match.length;
    });

    // Push remaining text
    result.push(<span key="last">{mainText.slice(lastIndex)}</span>);
    return result;
  };

  return (
    <Paper sx={{ width: '100%', margin: '4px', padding: '4px' }}>
      <Typography variant="body1" sx={{ margin: '5px' }}>{displayText()}</Typography>
      <Divider />
      {annotations.map((note, index) => (
        <CardContent>
          <Typography
            key={index}
            variant="body2"
            style={{ background: highlighted === `${index}` ? 'yellow' : 'none' }}
          >
            [{index}] {note}
          </Typography>
        </CardContent>
      ))}
    </Paper>
  );
}

export default AnnotatedText;
