/* eslint-disable no-use-before-define */
import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import Accordion from '@mui/material/Accordion';
import AccordionActions from '@mui/material/AccordionActions';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { useSelector, useDispatch } from 'react-redux';
import TextField from '@mui/material/TextField';

import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  Typography,
} from '@mui/material';
import BookUI from './BookUI';
import ImportFileAsBook from '../../components/ImportFileAsBook';
// import customStorage from '../store/customStorage';
import { getBooksByQuery } from '../../api/booksApi';
import customStorage from '../../store/customStorage';

import { createBookshelf } from '../../api/bookshelfApi';
import { bookshelfAdded } from '../../store/reducers/bookshelfSlice';
import SmallButton from '../../components/Button/SmallButton';
import RenameBookshelfModal from './RenameBookshelfModal';
import DeleteBookshelfModal from './DeleteBookshelfModal';
import BookSpineUI from './BookSpineUI';
import BookCardUI from './BookCardUI';
import { mapToPredefinedColor } from '../../../commons/utils/CommonLangUtil';
import InputButton from '../../components/Button/InputButton';

function BookshelfView() {
  // states
  const [books, setBooks] = useState([]);
  const [bookShelfs, setBookShelfs] = useState([]);
  const [curBookshelf, setCurBookshelf] = useState(null);
  const [openRenameModel, setOpenRenameModel] = useState(false);
  const [openDeleteModel, setOpenDeleteModel] = useState(false);
  const [showBookCover, setShowBookCover] = useState(false);
  const [booksInBookshelf, setBooksInBookshelf] = useState({});
  const dispatch = useDispatch();

  const importFileCallback = (book) => {
    if (!book) return;
    setBooks([...books, book]);
    calculateBooksInBookshelf([...books, book]);
  };

  const bookshelfList = useSelector((state) => state.bookshelf.bookshelfList);

  useEffect(() => {
    setBookShelfs(bookshelfList);
  }, [bookshelfList]);

  const calculateBooksInBookshelf = (books) => {
    const bs2books = {};
    books.map((book) => {
      const bsid = book.bookshelfId;
      if (!bs2books[bsid]) {
        bs2books[bsid] = 1;
      } else {
        bs2books[bsid] += 1;
      }
    });
    setBooksInBookshelf(bs2books);
  };

  useEffect(() => {
    async function fetchData() {
      const data = await getBooksByQuery();
      data.sort((a, b) => a.bookshelf_id - b.bookshelf_id);
      setBooks(data);
      const bs = await customStorage.getAllBookshelf();
      setBookShelfs(bs);
      calculateBooksInBookshelf(data);
    }
    fetchData();
  }, []);

  const handleBookCoverCheckboxChange = () => {
    setShowBookCover(!showBookCover);
  };

  const renameBookshelf = async (bookshelf) => {
    setCurBookshelf(bookshelf);
    setOpenRenameModel(true);
  };
  const deleteBookshelf = async (bookshelf) => {
    setCurBookshelf(bookshelf);
    setOpenDeleteModel(true);
  };

  const handleSpineClick = (book) => {};

  const getBookConciseDesc = (book) => {
    if (book.author && book.author !== 'Unknown Author') return book.author;
    if (book.subtitle) return book.subtitle;
    if (book.description) return book.description.substring(0, 20);
    if (book.publisher) return book.publisher;
    return '';
  };

  const handleBookShelfChange = async (book, bookshelf) => {
    const r = await customStorage.changeBookshelf(book.id, bookshelf.id);
    if (r > 0) {
      const b = { ...book, bookshelfId: bookshelf.id };
      setBooks([...books, b]);
      calculateBooksInBookshelf([...books, b]);
    }
  };
  // saving data to local storage
  // useEffect(() => {
  //   saveNotes(books);
  // }, [books]);

  return (
    <div className="texture-wood-2">
      <div className="header texture-wood-2">
        <Grid container justifyContent="space-between" alignItems="center">
          <Grid item>
            <ImportFileAsBook importFileCallback={importFileCallback} />
          </Grid>

          <Grid item>
            <Grid container alignItems="center" spacing={2}>
              <Grid item>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={showBookCover}
                      onChange={handleBookCoverCheckboxChange}
                      className="texture-wood-4"
                      style={{
                        color: '#1769aa',
                      }}
                    />
                  }
                  label={
                    <Typography
                      variant="h8"
                      className="texture-wood-4"
                      style={{
                        padding: '4px',
                        color: 'white',
                        backgroundColor: '#1769aa',
                        borderRadius: '2px',
                        boxShadow: '2px 2px 5px rgba(0,0,0,0.3)',
                      }}
                    >
                      Show Book Cover
                    </Typography>
                  }
                  sx={{ height: '32px', marginTop: '1px' }}
                />
              </Grid>
              <Grid item>
                <InputButton
                  label="Create New BookShelf"
                  className="texture-wood-4"
                  onSave={async (text) => {
                    if (!text) return;
                    const ns = await createBookshelf(text);
                    dispatch(bookshelfAdded(ns));
                  }}
                  sx={{ height: '35px', marginTop: '5px' }}
                />
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </div>
      <div>
        {bookShelfs.map((bookShelf) => (
          <Accordion key={bookShelf.id}>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              aria-controls="panel1-content"
              id="panel1-header"
              key={bookShelf.id}
              className="texture-wood-1"
              sx={{
                // backgroundColor: mapToPredefinedColor(bookShelf.name), // '#8B4513', // Brown color to resemble a book spine
                // color: '#fff',
                padding: '2px',
                margin: '2px 1px',
                //  borderRadius: '2px',
                //  boxShadow: '2px 2px 5px rgba(0,0,0,0.3)', // Optional shadow for a 3D effect
                textAlign: 'center',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              <Typography
                className="texture-wood-4"
                sx={{
                  backgroundColor: mapToPredefinedColor(bookShelf.name), // '#8B4513', // Brown color to resemble a book spine
                  color: '#fff',
                  padding: '8px',
                  margin: '8px 2px',
                  borderRadius: '2px',
                  boxShadow: '2px 2px 5px rgba(0,0,0,0.3)', // Optional shadow for a 3D effect
                  textAlign: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                {bookShelf.name}
              </Typography>
              {booksInBookshelf[bookShelf.id] && (
                <Typography
                  className="texture-wood-2"
                  sx={{
                    backgroundColor: mapToPredefinedColor(bookShelf.name), // '#8B4513', // Brown color to resemble a book spine
                    color: '#fff',
                    padding: '8px',
                    margin: '8px 2px',
                    borderRadius: '2px',
                    boxShadow: '2px 2px 5px rgba(0,0,0,0.3)', // Optional shadow for a 3D effect
                    textAlign: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  [{booksInBookshelf[bookShelf.id] || 0} books]
                </Typography>
              )}
            </AccordionSummary>
            <AccordionDetails>
              {showBookCover && (
                <div className="notes texture-wood-1">
                  {books.map(
                    (book) =>
                      book.bookshelfId === bookShelf.id && (
                        <NavLink
                          key={book.id}
                          to={
                            book.format === 'zip' || book.format === 'r9'
                              ? `/browser/${book.id}`
                              : `/reading/${book.id}`
                          }
                          style={{ textDecoration: 'none' }}
                        >
                          <BookCardUI
                            key={book.id}
                            selectedBookKey={book.id}
                            bookShelfs={bookShelfs}
                            handleBookShelfChange={handleBookShelfChange}
                          />
                        </NavLink>
                      ),
                  )}
                </div>
              )}
              {!showBookCover && (
                <Box
                  className="texture-wood-1"
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0px',
                    padding: '16px',
                    border: '1px solid #ccc',
                    borderRadius: '8px',
                    backgroundColor: '#f5f5f5',
                    position: 'relative',
                    maxWidth: '100%',
                    height: 'auto',
                  }}
                >
                  {books.map(
                    (book) =>
                      book.bookshelfId === bookShelf.id && (
                        <BookSpineUI
                          key={book.id}
                          id={book.id}
                          title={book.name}
                          author={getBookConciseDesc(book)}
                          starred={!!book.favorite}
                          onClick={() => handleSpineClick(book)}
                        />
                      ),
                  )}
                </Box>
              )}
            </AccordionDetails>
            <AccordionActions>
              <Tooltip title="Rename Bookshelf">
                <IconButton
                  aria-label="settings"
                  onClick={() => renameBookshelf(bookShelf)}
                >
                  <DriveFileRenameOutlineIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete Bookshelf">
                <IconButton
                  aria-label="settings"
                  onClick={() => deleteBookshelf(bookShelf)}
                >
                  <DeleteForeverIcon />
                </IconButton>
              </Tooltip>
            </AccordionActions>
          </Accordion>
        ))}
        <Accordion key="-1">
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="panel1-content"
            id="panel1-header"
            key="-1"
            className="texture-wood-1"
            sx={{
              //  backgroundColor: mapToPredefinedColor('Miscellaneous'), // '#8B4513', // Brown color to resemble a book spine
              //  color: '#fff',
              padding: '2px',
              margin: '2px 1px',
              //   borderRadius: '2px',
              //   boxShadow: '2px 2px 5px rgba(0,0,0,0.3)', // Optional shadow for a 3D effect
              textAlign: 'center',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <Typography
              className="texture-wood-4"
              sx={{
                backgroundColor: mapToPredefinedColor('Miscellaneous'), // '#8B4513', // Brown color to resemble a book spine
                color: '#fff',
                padding: '8px',
                margin: '8px 2px',
                borderRadius: '2px',
                boxShadow: '2px 2px 5px rgba(0,0,0,0.3)', // Optional shadow for a 3D effect
                textAlign: 'center',
                cursor: 'pointer',
                position: 'relative',
              }}
            >
              Miscellaneous
            </Typography>
            {booksInBookshelf[-1] && (
              <Typography
                className="texture-wood-2"
                sx={{
                  backgroundColor: mapToPredefinedColor('Miscellaneous'), // '#8B4513', // Brown color to resemble a book spine
                  color: '#fff',
                  padding: '8px',
                  margin: '8px 2px',
                  borderRadius: '2px',
                  boxShadow: '2px 2px 5px rgba(0,0,0,0.3)', // Optional shadow for a 3D effect
                  textAlign: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                [{booksInBookshelf[-1] || 0} books]
              </Typography>
            )}
          </AccordionSummary>
          <AccordionDetails>
            {showBookCover && (
              <div className="notes  texture-wood-1 ">
                {books.map(
                  (book) =>
                    book.bookshelfId === -1 && (
                      <NavLink
                        key={book.id}
                        to={
                          book.format === 'zip' || book.format === 'r9'
                            ? `/browser/${book.id}`
                            : `/reading/${book.id}`
                        }
                        style={{ textDecoration: 'none' }}
                      >
                        <BookCardUI
                          key={book.id}
                          selectedBookKey={book.id}
                          bookShelfs={bookShelfs}
                          handleBookShelfChange={handleBookShelfChange}
                        />
                      </NavLink>
                    ),
                )}
              </div>
            )}
            {!showBookCover && (
              <Box
                className="texture-wood-1"
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0px',
                  padding: '16px',
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                  backgroundColor: '#f5f5f5',
                  position: 'relative',
                  maxWidth: '100%',
                  height: 'auto',
                }}
              >
                {books.map(
                  (book) =>
                    book.bookshelfId === -1 && (
                      <BookSpineUI
                        key={book.id}
                        id={book.id}
                        title={book.name}
                        author={getBookConciseDesc(book)}
                        starred={!!book.favorite}
                        onClick={() => handleSpineClick(book)}
                      />
                    ),
                )}
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
        {curBookshelf && (
          <RenameBookshelfModal
            open={openRenameModel}
            bookshelf={curBookshelf}
            callback={setOpenRenameModel}
          />
        )}
        {curBookshelf && (
          <DeleteBookshelfModal
            open={openDeleteModel}
            bookshelf={curBookshelf}
            callback={setOpenDeleteModel}
          />
        )}
      </div>
    </div>
  );
}

export default BookshelfView;
