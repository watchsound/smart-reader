import React from 'react';
import { Box, Typography } from '@mui/material';

export default function AlignmentDisplay({
  alignment,
  label1 = 'Origin',
  label2 = 'Mine',
  maxWordsPerLine = 10,
}) {
  // Function to chunk the alignment array into rows
  const chunkAlignment = (alignment, size) => {
    const chunked = [];
    for (let i = 0; i < alignment.length; i += size) {
      chunked.push(alignment.slice(i, i + size));
    }
    return chunked;
  };

  const alignmentRows = chunkAlignment(alignment, maxWordsPerLine);

  return (
    <Box display="flex" flexDirection="column" alignItems="left">
      {alignmentRows.map((row, rowIndex) => (
        <Box
          key={rowIndex}
          display="flex"
          flexDirection="column"
          marginBottom="16px"
        >
          <Box display="flex">
            <Typography
              key="0"
              style={{
                padding: '4px 8px',
                backgroundColor: '#4caf50',
                color: 'white',
                border: '1px solid black',
                minWidth: '100px',
                textAlign: 'center',
              }}
            >
              {label1}
            </Typography>
            {row.map((item, index) => (
              <Typography
                key={`word1-${index}`}
                style={{
                  padding: '4px 8px',
                  backgroundColor: item.match ? '#4caf50' : '#f44336',
                  color: 'white',
                  border: '1px solid black',
                  minWidth: '32px',
                  textAlign: 'center',
                }}
              >
                {item.word1 || '-'}
              </Typography>
            ))}
          </Box>
          <Box display="flex">
            <Typography
              key="0"
              style={{
                padding: '4px 8px',
                backgroundColor: '#4caf50',
                color: 'white',
                border: '1px solid black',
                minWidth: '100px',
                textAlign: 'center',
              }}
            >
              {label2}
            </Typography>
            {row.map((item, index) => (
              <Typography
                key={`word2-${index}`}
                style={{
                  padding: '4px 8px',
                  backgroundColor: item.match ? '#4caf50' : '#2196f3',
                  color: 'white',
                  border: '1px solid black',
                  minWidth: '32px',
                  textAlign: 'center',
                }}
              >
                {item.word2 || '-'}
              </Typography>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
