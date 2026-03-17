import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { LocalFireDepartment } from '@mui/icons-material'; // Imported the icon

function InfoCard({ title, subtitle, content }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        p: 2,
        border: '1px solid #ddd',
        borderRadius: 2,
        boxShadow: 1,
        maxWidth: 600,
        backgroundColor: '#f9f9f9',
      }}
    >
      <IconButton sx={{ mr: 2 }}>
        <LocalFireDepartment sx={{ fontSize: 40, color: '#6200ea' }} />
      </IconButton>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#6200ea' }}>
          {title}
        </Typography>
        <Typography
          variant="body2"
          color="textSecondary"
          sx={{ fontStyle: 'italic' }}
        >
          {subtitle}
        </Typography>
        <Typography variant="body1" sx={{ mt: 1 }}>
          {content}
        </Typography>
      </Box>
    </Box>
  );
}

export default InfoCard;
