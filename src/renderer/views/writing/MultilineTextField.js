/* eslint-disable prettier/prettier */
import React, { useState, useEffect } from 'react';
import { TextField, Paper, Box } from '@mui/material';
import { styled } from '@mui/system';

const StyledPaper = styled(Paper)({
  padding: 16,
  marginTop: 16,
  width: '100%',
});

const StyledTextField = styled(TextField)({
  width: '100%',
  minHeight: 100, // Example minHeight
  maxHeight: 300, // Example maxHeight
  overflow: 'auto',
});
function MultilineTextField({ initialText, placeholder, onTextChange }) {
  const [text, setText] = useState(initialText);

  const handleChange = (event) => {
    const newText = event.target.value;
    setText(newText);
    if (onTextChange) {
      onTextChange(newText);
    }
  };

  useEffect(() => {
    setText(initialText);
  }, [initialText]);

  return (
    <StyledPaper elevation={3}>
      <Box>
        <StyledTextField
          multiline
          minRows={4}
          maxRows={10}
          variant="outlined"
          value={text}
          onChange={handleChange}
          placeholder={placeholder}
        />
      </Box>
    </StyledPaper>
  );
}

export default MultilineTextField;
