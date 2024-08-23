// import React, { useState } from 'react';
// import { Box } from '@mui/material';
// import { CSSTransition } from 'react-transition-group';
// import BookSpineUI from './BookSpineUI';
// import BookCardUI from './BookCardUI';
// import './book.styles.css'; // Add your styles here

// function BookUI({ book, bookShelfs, handleBookShelfChange }) {
//   const [showCard, setShowCard] = useState(false);

//   const handleSpineClick = () => {
//     setShowCard(true);
//   };

//   // const handleCloseCard = () => {
//   //   setShowCard(false);
//   // };
//   const getBookConciseDesc = () => {
//     if (book.author && book.author !== 'Unknown Author') return book.author;
//     if (book.subtitle) return book.subtitle;
//     if (book.description) return book.description.substring(0, 20);
//     if (book.publisher) return book.publisher;
//     return '';
//   };

//   return (
//     <Box key={book.id} sx={{ position: 'relative' }}>
//       {!showCard && (
//         <BookSpineUI
//           key={book.id}
//           title={book.name}
//           author={getBookConciseDesc(book)}
//           onClick={() => handleSpineClick(book)}
//         />
//       )}

//       {showCard && (
//         <CSSTransition
//           in={showCard}
//           timeout={1300}
//           classNames="book-card"
//           unmountOnExit
//         >
//           <Box
//             sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
//           >
//             <BookCardUI
//               selectedBookKey={book.id}
//               bookShelfs={bookShelfs}
//               handleBookShelfChange={handleBookShelfChange}
//             />
//           </Box>
//         </CSSTransition>
//       )}
//     </Box>
//   );
// }

// export default BookUI;
