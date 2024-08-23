import React, { useState, useEffect } from 'react';
import { Typography, Box, Fade, Paper } from '@mui/material';
import { styled } from '@mui/system';

const StyledPaper = styled(Paper)({
  padding: 16,
  marginTop: 16,
  width: '100%',
});
const HiddenWord = styled('span')({
  cursor: 'pointer',
  textDecoration: 'underline',
  display: 'inline-block',
  width: 'auto',
});

const RevealedWord = styled('span')({
  display: 'inline-block',
});

function ParagraphWithHiddenWords({ inputText }) {
  const parseText = (text) => {
    const regex = /\${(.*?)}/g;
    let match;
    const words = [];
    let lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      words.push(text.substring(lastIndex, match.index));
      words.push({ word: match[1], revealed: false });
      lastIndex = regex.lastIndex;
    }
    words.push(text.substring(lastIndex));

    return words;
  };

  const [words, setWords] = useState([]);

  useEffect(() => {
    if (!inputText) return;
    setWords(parseText(inputText));
  }, [inputText]);

  const handleRevealWord = (index) => {
    setWords(
      words.map((item, idx) =>
        idx === index ? { ...item, revealed: true } : item,
      ),
    );
  };

  return (
    <StyledPaper elevation={3}>
      <Box>
        <Typography>
          {words.map((item, index) =>
            typeof item === 'string' ? (
              item
            ) : (
              <Box
                key={index}
                component="span"
                onClick={() => !item.revealed && handleRevealWord(index)}
                style={{ display: 'inline-block' }}
              >
                <Fade in={item.revealed} timeout={{ enter: 500, exit: 500 }}>
                  <Box component="span">
                    {item.revealed ? (
                      <RevealedWord>{item.word}</RevealedWord>
                    ) : (
                      <HiddenWord>{'_'.repeat(item.word.length)}</HiddenWord>
                    )}
                  </Box>
                </Fade>
              </Box>
            ),
          )}
        </Typography>
      </Box>
    </StyledPaper>
  );
}

export default ParagraphWithHiddenWords;
