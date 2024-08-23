/* eslint-disable prettier/prettier */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Pagination,
  CardActions,
  Alert,
  Snackbar,
  Container,
  Divider,
} from '@mui/material';
import SmallButton from '../../components/Button/SmallButton';
import customStorage from '../../store/customStorage';

function BookListInServer() {
  const [books, setBooks] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, ] = useState(10);
    const [totalPages, setTotalPages] = useState(0);
    const [open, setOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState('success');

    useEffect(() => {
        const fetchBooks = async () => {
            try {
                const serverUrl = await customStorage.getServerUrl();
                const response = await axios.get(`${serverUrl}/api/books/list?page=${page}&size=${pageSize}`);
                console.log(JSON.stringify(response))
                setBooks(response.data.books || []);
                setTotalPages( response.data.totalPages);
            } catch (error) {
                console.error('Failed to fetch books', error);
            }
        };
        fetchBooks();
    }, [page, pageSize]);

  const handleChangePage = (event, value) => {
    setPage(value);
  };
  const showMessage = (message, severity = 'info') => {
    setAlertMessage(message);
    setAlertSeverity(severity);
    setOpen(true);
  };
  const downloadBook = async (bookFromServer) => {
    if (!bookFromServer) return;
    const alreadyDownloaded = await customStorage.getBookByIdFromServer(bookFromServer.id);
    if (alreadyDownloaded) return;
    const localBook = await customStorage.importBookFromServer(bookFromServer);
    if( localBook ) showMessage("Book is downloaded")
    else showMessage("Book download failed!")
  }

  return (
    <Container maxWidth="lg">
      <Grid container spacing={2} alignItems="stretch">
        {books.map((book, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card style={{ width: '100%' }}>
            { book.coverImage && (
              <CardMedia
                component="img"
                height="140"
                image={`data:image/jpeg;base64,${book.coverImage}`}
                alt="Book Cover"
              />
            )}

              <CardContent>
                <Typography gutterBottom variant="h5" component="div">
                  {book.name || ''}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {book.authors&& book.authors.length>0? book.authors[0].name : ''}
                </Typography>
                <Typography variant="body1">{book.description}</Typography>
              </CardContent>
              <CardActions>
                <SmallButton size="small" onClick={()=>downloadBook(book)}>Download</SmallButton>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
       <Divider />
      <Pagination
        count={totalPages}
        page={page}
        size="small"
        onChange={handleChangePage}
        sx={{ margin: '10px', justifyContent: 'center', display: 'flex' }}
         variant="outlined"
        color="secondary"
      />
       <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={() => setOpen(false)}
      >
        <Alert
          onClose={() => setOpen(false)}
          severity={alertSeverity}
          sx={{ width: '100%' }}
        >
          {alertMessage}
        </Alert>
        </Snackbar>
    </Container>
  );
}

export default BookListInServer;
