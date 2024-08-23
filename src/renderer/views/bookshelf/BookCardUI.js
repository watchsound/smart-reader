/* eslint-disable radix */
/* eslint-disable camelcase */
import { useState, useEffect } from 'react';

import { styled } from '@mui/material/styles';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardMedia from '@mui/material/CardMedia';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import MoveUpIcon from '@mui/icons-material/MoveUp';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { red } from '@mui/material/colors';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import MoreVertIcon from '@mui/icons-material/MoreVert';

import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';

import { NavLink } from 'react-router-dom';
import { useGetBookByIdQuery } from '../../store/api/bookApiSlice';
import { updateBook } from '../../api/booksApi';

const cardWidth = 240;

function BookCardUI({ selectedBookKey, closeCallback, bookShelfs, handleBookShelfChange }) {
  const [selectedBook, setSelectedBook] = useState(null);
  const { data: result } = useGetBookByIdQuery(selectedBookKey);

  // const [image, setImage] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  // const [timestamp, setTimestamp] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const handleMenuOpen = (event) => {
    event.preventDefault();
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = (event) => {
    event.preventDefault();
    setAnchorEl(null);
  };
  const handleMenuClose2 = (event) => {
    event.preventDefault();
    setAnchorEl(null);
    if (closeCallback) closeCallback(event);
  };

  useEffect(() => {
    if (!result) return;
    const { book, image } = result;
    if (!book) return;
    if (image) setImageSrc(image);
    setSelectedBook(book);
    // const t = parseInt(book.timestamp);
    // console.log(` timestamp ${new Date(t)}`);
    // const time = moment(new Date(t)).format('LLL');
    // setTimestamp(time);
  }, [result]);

  function toggleFavorite(e) {
    if (!selectedBook) return;
    e.preventDefault();
    const { favorite } = selectedBook;
    setSelectedBook({ ...selectedBook, favorite: favorite === 0 ? 1 : 0 });
    // updateBook({ ...selectedBook, favorite: !favorite });
    updateBook({
      id: selectedBook.id,
      field: 'favorite',
      value: favorite === 0 ? 1 : 0,
    });
  }

  if (selectedBook == null)
    return (
      <Typography variant="body2" color="text.secondary">
        EMPTY
      </Typography>
    );
  return (
    <NavLink
      key={selectedBook.id}
      to={
        selectedBook.format === 'zip' || selectedBook.format === 'r9'
          ? `/browser/${selectedBook.id}`
          : `/reading/${selectedBook.id}`
      }
      style={{ textDecoration: 'none' }}
    >
      <Card key={selectedBook.id} sx={{ maxWidth: { cardWidth } }}>
        <CardHeader
          avatar={
            <Avatar sx={{ bgcolor: red[500] }} aria-label="recipe">
              {selectedBook.name.charAt(0).toUpperCase()}
            </Avatar>
          }
          title={selectedBook.name}
          subheader={`${selectedBook.subtitle} ${selectedBook.author}`}
          action={
            <>
              <IconButton
                size="small"
                onClick={(e) => toggleFavorite(e)}
                aria-label="add to favorites"
              >
                <FavoriteIcon
                  fontSize="small"
                  color={selectedBook.favorite === 1 ? 'primary' : 'disabled'}
                />
              </IconButton>
              {closeCallback && (
                <IconButton aria-label="settings" onClick={handleMenuClose2}>
                  <MoreVertIcon />
                </IconButton>
              )}

              {bookShelfs && (
                <IconButton aria-label="settings" onClick={handleMenuOpen}>
                  <MoreVertIcon />
                </IconButton>
              )}
              {bookShelfs && (
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleMenuClose}
                  transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                  anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                >
                  {bookShelfs.map((bookShelf) => (
                    <MenuItem
                      key={bookShelf.id}
                      onClick={() => {
                        handleMenuClose();
                        handleBookShelfChange(selectedBook, bookShelf);
                      }}
                    >
                      <ListItemIcon>
                        <MoveUpIcon />
                      </ListItemIcon>
                      <ListItemText> {bookShelf.name} </ListItemText>
                    </MenuItem>
                  ))}
                </Menu>
              )}
            </>
          }
        />
        {imageSrc && (
          <CardMedia component="img" height="194" image={imageSrc} />
        )}
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            {selectedBook.description}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {`${selectedBook.category} ${selectedBook.publisher} ${selectedBook.createdAt}`}
          </Typography>
        </CardContent>
        <CardActions disableSpacing />
      </Card>
    </NavLink>
  );
}

export default BookCardUI;
