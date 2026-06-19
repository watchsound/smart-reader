import React, { useState, useEffect } from 'react';
import { TextField, Box, InputBase } from '@mui/material';
import { styled, useTheme, alpha } from '@mui/material/styles';

const StyledContainer = styled(Box, {
  shouldForwardProp: (prop) => !['colors', 'minimal'].includes(prop),
})(({ theme, colors, minimal }) => ({
  backgroundColor: minimal ? 'transparent' : theme.palette.background.paper,
  borderRadius: minimal ? 8 : 16,
  border: minimal ? 'none' : `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  overflow: 'hidden',
  transition: 'all 0.2s ease',
  '&:focus-within': minimal
    ? {}
    : {
        borderColor: alpha(colors?.accent || theme.palette.primary.main, 0.5),
        boxShadow: `0 0 0 3px ${alpha(colors?.accent || theme.palette.primary.main, 0.1)}`,
      },
}));

const StyledInputBase = styled(InputBase)(({ theme, colors }) => ({
  width: '100%',
  padding: theme.spacing(2),
  fontSize: '1rem',
  lineHeight: 1.8,
  '& .MuiInputBase-input': {
    padding: 0,
    '&::placeholder': {
      color: theme.palette.text.disabled,
      opacity: 1,
    },
  },
}));

const CharacterCount = styled(Box)(({ theme, colors }) => ({
  padding: theme.spacing(1, 2),
  display: 'flex',
  justifyContent: 'flex-end',
  borderTop: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
}));

function MultilineTextField({
  initialText,
  placeholder,
  onTextChange,
  colors,
  minimal = false,
}) {
  const theme = useTheme();
  const [text, setText] = useState(initialText || '');

  const handleChange = (event) => {
    const newText = event.target.value;
    setText(newText);
    if (onTextChange) {
      onTextChange(newText);
    }
  };

  useEffect(() => {
    setText(initialText || '');
  }, [initialText]);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <StyledContainer colors={colors} minimal={minimal}>
      <StyledInputBase
        multiline
        minRows={minimal ? 3 : 5}
        maxRows={12}
        value={text}
        onChange={handleChange}
        placeholder={placeholder}
        colors={colors}
        sx={{
          bgcolor: minimal
            ? alpha(theme.palette.background.default, 0.5)
            : 'transparent',
          borderRadius: minimal ? 2 : 0,
        }}
      />
      {!minimal && text && (
        <CharacterCount colors={colors}>
          <Box
            component="span"
            sx={{
              fontSize: '0.75rem',
              color: theme.palette.text.disabled,
            }}
          >
            {wordCount} word{wordCount !== 1 ? 's' : ''} · {text.length} characters
          </Box>
        </CharacterCount>
      )}
    </StyledContainer>
  );
}

export default MultilineTextField;
