import React from 'react';
import { Avatar, Box, Menu, Typography } from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import BookCardUI from './BookCardUI';
import { mapToPredefinedColor } from '../../../commons/utils/CommonLangUtil';

function BookSpineUI({ id, title, author, starred, onClick }) {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const handleMenuOpen = (event) => {
    event.preventDefault();
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = (event) => {
    event.preventDefault();
    setAnchorEl(null);
  };

  return (
    <Box
      sx={{
        minWidth: '38px',
        maxWidth: '54px',
        height: '200px',
        backgroundColor: mapToPredefinedColor(title || author), // '#8B4513', // Brown color to resemble a book spine
        color: '#fff', // White text color
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        padding: '8px',
        margin: '8px 2px',
        borderRadius: '2px',
        boxShadow: '2px 2px 5px rgba(0,0,0,0.3)', // Optional shadow for a 3D effect
        textAlign: 'center',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      <Avatar
        onClick={handleMenuOpen}
        sx={{ width: 32, height: 32, bgcolor: '#d32f2f', mb: 1 }}
      >
        {title.charAt(0).toUpperCase()}
      </Avatar>
      <Typography
        variant="body2"
        component="div"
        onClick={handleMenuOpen}
        style={{
          position: 'absolute',
          writingMode: 'vertical-lr',
          marginLeft: '2px',
          marginTop: '40px',
        }}
      >
        {title}
      </Typography>
      <Typography
        variant="caption"
        component="div"
        onClick={handleMenuOpen}
        style={{
          position: 'absolute',
          writingMode: 'vertical-lr',
          marginLeft: '24px',
          marginTop: '40px',
        }}
      >
        {author}
      </Typography>
      {starred && (
        <BookmarkIcon
          onClick={handleMenuOpen}
          sx={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            color: '#ffeb3b',
          }}
        />
      )}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {anchorEl && (
          <BookCardUI selectedBookKey={id} closeCallback={handleMenuClose} />
        )}
      </Menu>
    </Box>
  );
}

export default BookSpineUI;
