// src/components/ImageSelector.js
import React, { useState, useEffect } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Button,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { styled } from '@mui/material/styles';

const ImageBox = styled(Box)({
  width: 40,
  height: 71,
  display: 'inline-block',
  margin: 4,
});

function createArrayFromNToM(n, m) {
  return Array.from({ length: m - n + 1 }, (v, i) => n + i);
}
/**
 *  current image is at /assets/card-bg/t-xx-min.jpg and t-xx-min-t-min.jpg
 *  xx : [24, 71]
 */
function ImageSelector({ onImageChange }) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [open, setOpen] = useState(false);
  const [assetsPath, setAssetsPath] = useState('');

  useEffect(() => {
    async function t() {
      const p = await window.electron.ipcRenderer.getAssetRootPath();
      console.log(p);
      setAssetsPath(p);
    }
    t();
  }, []);

  const handleImageChange = (newImage) => {
    // const newImage = event.target.value;
  //  const newImage = event.target.getAttribute('data-value');
   // if (newImage) {
      setSelectedImage(newImage);
      onImageChange(newImage);
  //  }

    setOpen(false);
  };

  const handleImageDelete = () => {
    setSelectedImage(0);
    onImageChange(0);
    setOpen(false);
  };

  return (
    <FormControl fullWidth size="small">
      <InputLabel id="image-selector-label">Select Image</InputLabel>
      <Select
        labelId="image-selector-label"
        value={selectedImage}
        onChange={()=>{}}
        renderValue={(selected) => {
          return selected ? (
            <Box display="flex" alignItems="center">
              <img
                src={`${assetsPath}/card-bg/t-${selected}-min-t-min.jpg`}
                alt="Selected"
                style={{ width: 26, height: 26 }}
              />
            </Box>
          ) : (
            <></>
          );
        }}
        open={open}
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        MenuProps={{
          PaperProps: {
            style: {
              maxHeight: 71 * 6 + 16, // Adjusted to show 3 rows of icons
              width: 450,
            },
          },
        }}
      >
        <Box display="flex" flexWrap="wrap" justifyContent="center">
          <MenuItem key={-1} value={0} style={{ width: 'auto' }}>
            <ImageBox>
              <IconButton aria-label="settings" onClick={handleImageDelete}>
                <DeleteIcon />
              </IconButton>
            </ImageBox>
          </MenuItem>
          {createArrayFromNToM(24, 69).map((imageNum, index) => (
            <MenuItem
              key={index}
              value={imageNum}
              onClick={() => handleImageChange(imageNum)}
              style={{ width: 'auto', paddingLeft: '2px', paddingRight: '2px' }}
            >
              <ImageBox>
                <img
                  src={`${assetsPath}/card-bg/t-${imageNum}-min-t-min.jpg`}
                  alt={`Icon ${index}`}
                  style={{ width: '100%', height: '100%' }}
                />
              </ImageBox>
            </MenuItem>
          ))}
        </Box>
      </Select>
    </FormControl>
  );
}

export default ImageSelector;
