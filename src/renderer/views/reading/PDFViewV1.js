// /* eslint-disable radix */
// /* eslint-disable react/no-unstable-nested-components */
// /* eslint-disable prettier/prettier */
// import React, { useState, useEffect } from 'react';

// import {
//   PdfLoader,
//   PdfHighlighter,
//   Highlight,
//   Popup,
//   AreaHighlight,
// } from 'react-pdf-highlighter-extended-x2';
// import { useSelector, useDispatch } from 'react-redux';
// import isEqual from 'is-equal';
// import watch from 'redux-watch';

// import {
//   getBookNotes,
//   saveBookNote,
//   updateBook,
//   createImage,
// } from '../../api/booksApi';

// import {
//   notesQueried,
//   noteAdded,
//   annotationsQueried,
//   annotationAdded,
//   searchTextInBookResultHandled,
// } from '../../store/reducers/readerSlice';

// import { noteJson2pdfJson, pdfJson2noteJson } from '../../../commons/utils/noteUtil';

// import { Spinner } from './Spinner';
// import CreatePDFAnnotationDialog from './CreatePDFAnnotationDialog';
// import './PDFView.css';

// const getNextId = () => parseInt(String(Math.random()).slice(2).substring(0,8));

// const parseIdFromHash = () => {
//   return parseInt(document.location.hash.slice("#highlight-".length));
// };


// const resetHash = () => {
//   document.location.hash = '';
// };

// // : { comment: { text: string; emoji: string } }
// function HighlightPopup({ comment }) {
//   return comment.text ? (
//     <div className="Highlight__popup">
//       {comment.emoji} {comment.text}
//     </div>
//   ) : null;
// }

// function HighlightComponent({ highlight, isScrolledTo }) {
//   return (
//     <Highlight
//       isScrolledTo={isScrolledTo}
//       position={highlight.position}
//       comment={highlight.comment}
//     />
//   );
// }

// // Component to handle area highlights
// function AreaHighlightComponent({ highlight, isScrolledTo, viewportToScaled, screenshot, updateHighlight }) {
//   return (
//     <AreaHighlight
//       isScrolledTo={isScrolledTo}
//       highlight={highlight}
//       onChange={(boundingRect) => {
//         updateHighlight(
//           highlight.id,
//           { boundingRect: viewportToScaled(boundingRect) },
//           { image: screenshot(boundingRect) },
//         );
//       }}
//     />
//   );
// }

// // Popup component to manage highlight interactions
// function PopupComponent({ highlight, setTip, hideTip, component, index }) {
//   return (
//     <Popup
//       popupContent={<HighlightPopup {...highlight} />}
//       onMouseOver={() => setTip(highlight, () => <HighlightPopup {...highlight} />)}
//       onMouseOut={hideTip}
//       key={index}
//       children={component}
//     />
//   );
// }

// function PDFView({ bookPath, curBook, curNote }) {
//   const [url, setUrl] = useState('');
//   const [highlights, setHighlights] = useState([]);

//   const dispatch = useDispatch();

//   const getHighlightById = (id) => {
//     return highlights.find((highlight) => highlight.id === id);
//   };

//   const scrollToHighlightFromHash = (scrollViewerTo) => {
//     const highlight = getHighlightById(parseIdFromHash());
//     if (highlight) {
//       if ( scrollViewerTo )  scrollViewerTo(highlight);
//     }
//   };

//   const updateHash = (highlight) => {
//     document.location.hash = `highlight-${highlight.id}`;
//   };

//   useEffect(() => {
//     window.addEventListener('hashchange', scrollToHighlightFromHash, false);
//     return () =>
//       window.removeEventListener(
//         'hashchange',
//         scrollToHighlightFromHash,
//         false,
//       );
//   }, []);

//   useEffect(() => {
//     if( !bookPath ||!curBook) return;
//     setUrl(bookPath);
//     async function t() {
//       const bookNotes = await getBookNotes(curBook.id);
//       dispatch(notesQueried(bookNotes || []));
//       if (bookNotes) {
//         const hs = [];
//         bookNotes.forEach((note) => {
//           hs.push( noteJson2pdfJson(note) );
//         });
//         setHighlights(hs);
//       }
//     };
//     t();
//   }, [bookPath, curBook]);

//   const addHighlightByNote = (note) => {
//     if (!note) return;
//     console.log('Saving highlight', note);
//     setHighlights([ noteJson2pdfJson(note) , ...highlights]);
//   };

//   const updateHighlight = (highlightId, position, content) => {
//     console.log('Updating highlight', highlightId, position, content);
//     setHighlights(
//       highlights.map((h) => {
//         if (h.id === highlightId) {
//           return {
//             ...h,
//             position: { ...h.position, ...position },
//             content: { ...h.content, ...content },
//           };
//         }
//         return h;
//       }),
//     );
//   };

//   return (
//     <div className="PDFView" style={{ display: 'flex', height: '100vh' }}>
//       <PdfLoader url={url} beforeLoad={<Spinner />}>
//         {pdfDocument => (
//           <PdfHighlighter
//             pdfDocument={pdfDocument}
//             enableAreaSelection={event => event.altKey}
//             onScrollChange={resetHash}
//             scrollRef={scrollToHighlightFromHash}
//             onSelectionFinished={(position, content, hideTipAndSelection, transformSelection) => (
//               <CreatePDFAnnotationDialog
//                 bookId={curBook.id}
//                 selectedContent={content}
//                 position={position}
//                 onOpen={transformSelection}
//                 onConfirm={ note => {
//                   addHighlightByNote(note);
//                   hideTipAndSelection();
//                 }}
//               />
//             )}
//             highlightTransform={(highlight, index, setTip, hideTip, viewportToScaled, screenshot, isScrolledTo) => {
//               const isTextHighlight = !(highlight.content && highlight.content.image);
//               const component = isTextHighlight ?
//                 <HighlightComponent highlight={highlight} isScrolledTo={isScrolledTo} /> :
//                 <AreaHighlightComponent
//                   highlight={highlight}
//                   isScrolledTo={isScrolledTo}
//                   viewportToScaled={viewportToScaled}
//                   screenshot={screenshot}
//                   updateHighlight={updateHighlight}
//                 />;
//               return (
//                 <PopupComponent
//                   highlight={highlight}
//                   setTip={setTip}
//                   hideTip={hideTip}
//                   component={component}
//                   index={index}
//                 />
//               );
//             }}
//             highlights={highlights}
//           />
//         )}
//       </PdfLoader>
//     </div>
//   );
// }

// export default PDFView;
