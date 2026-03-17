import React from 'react';
import { Box, Typography, Grid, Paper } from '@mui/material';

function ImageTextComponent({ text1, text2, image1, image2 }) {
  const imageStyle = {
    width: '100%', // Make image fill the width of the container
    height: '150px', // Fixed height of 150px
    objectFit: 'cover', // Ensures image is cropped (if needed) to fit the container's dimensions while maintaining its aspect ratio
  };

  return (
    <Box sx={{ padding: 2 }}>
      <Typography variant="body1" sx={{ marginBottom: 2 }}>
        {text1}
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <Paper elevation={3}>
            <img src={image1} alt="Moon Image 1" style={imageStyle} />
          </Paper>
        </Grid>
        {image2 && (
          <Grid item xs={12} sm={6}>
            <Paper elevation={3}>
              <img src={image2} alt="Moon Image 2" style={imageStyle} />
            </Paper>
          </Grid>
        )}
      </Grid>
      <Typography variant="body1" sx={{ marginTop: 2 }}>
        {text2}
      </Typography>
    </Box>
  );
}

export default ImageTextComponent;
