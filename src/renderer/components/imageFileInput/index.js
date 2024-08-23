// FileInput.js
import React from 'react';
import { styled } from '@mui/material/styles';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
// import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ImageSearchIcon from '@mui/icons-material/ImageSearch';

const SmallButton = styled(Button)({
  padding: '1px 1px',
  margin: '1px 1px',
  boxShadow: 'none',
  textTransform: 'none',
  width: '32px',
  maxWidth: '32px',
  maxHeight: '32px',
  minWidth: '32px',
  minHeight: '32px',
});

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

function ImageFileInput({ onChange }) {
  const handleChange = (event) => {
    const file = event.target.files[0];
    onChange(file);
  };

  return (
    <SmallButton
      component="label"
      role={undefined}
      tabIndex={-1}
      startIcon={<ImageSearchIcon />}
    >
      <VisuallyHiddenInput
        type="file"
        accept="image/*"
        onChange={handleChange}
      />
    </SmallButton>
  );

  // return <input type="file" accept="image/*" onChange={handleChange} />;
}

export default ImageFileInput;
