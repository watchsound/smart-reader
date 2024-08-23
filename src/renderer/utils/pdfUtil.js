// // export const getHighlightCoords = () => {
// //   const pageArea = document.getElementById('page-area');
// //   if (!pageArea) return null;
// //   const iframe = pageArea.getElementsByTagName('iframe')[0];
// //   if (!iframe) return null;
// //   const iWin = iframe.contentWindow || iframe.contentDocument?.defaultView;
// //   const pageIndex = iWin.PDFViewerApplication.pdfViewer.currentPageNumber - 1;
// //   const page = iWin.PDFViewerApplication.pdfViewer.getPageView(pageIndex);
// //   const pageRect = page.canvas.getClientRects()[0];
// //   const selectionRects = iWin.getSelection()
// //     ? iWin.getSelection().getRangeAt(0).getClientRects()
// //     : [];
// //   const { viewport } = page;
// //   const tempRect = [];
// //   for (let i = 0; i < selectionRects.length; i++) {
// //     if (i === 0) {
// //       tempRect.push({
// //         bottom: selectionRects[i].bottom,
// //         top: selectionRects[i].top,
// //         left: selectionRects[i].left,
// //         right: selectionRects[i].right,
// //       });
// //     } else if (
// //       Math.abs(
// //         tempRect[tempRect.length - 1].bottom - selectionRects[i].bottom,
// //       ) < 5
// //     ) {
// //       if (tempRect[tempRect.length - 1].left > selectionRects[i].left) {
// //         tempRect[tempRect.length - 1].left = selectionRects[i].left;
// //       }
// //       if (tempRect[tempRect.length - 1].right < selectionRects[i].right) {
// //         tempRect[tempRect.length - 1].right = selectionRects[i].right;
// //       }
// //     } else {
// //       tempRect.push({
// //         bottom: selectionRects[i].bottom,
// //         top: selectionRects[i].top,
// //         left: selectionRects[i].left,
// //         right: selectionRects[i].right,
// //       });
// //     }
// //   }
// //   const selected = tempRect.map(function (r) {
// //     return viewport
// //       .convertToPdfPoint(r.left - pageRect.x, r.top - pageRect.y)
// //       .concat(
// //         viewport.convertToPdfPoint(r.right - pageRect.x, r.bottom - pageRect.y),
// //       );
// //   });
// //   return { page: pageIndex, coords: selected };
// // };

// export const getPDFCover = (file) => {
//   return new Promise((resolve, reject) => {
//     const fileSize = file.byteLength / 1024 / 1024;
//     setTimeout(
//       () => {
//         resolve('');
//       },
//       Math.ceil(fileSize / 10) * 1000,
//     );
//     const pdfjsLib = window['pdfjs-dist/build/pdf'];
//     pdfjsLib
//       .getDocument({ data: file })
//       .promise.then((pdfDoc) => {
//         pdfDoc.getPage(1).then((page) => {
//           const scale = 1.5;
//           const viewport = page.getViewport({
//             scale,
//           });
//           const canvas = document.getElementById('the-canvas');
//           const context = canvas.getContext('2d');
//           canvas.height =
//             viewport.height || viewport.viewBox[3]; /* viewport.height is NaN */
//           canvas.width =
//             viewport.width ||
//             viewport.viewBox[2]; /* viewport.width is also NaN */
//           const task = page.render({
//             canvasContext: context,
//             viewport,
//           });
//           task.promise.then(async () => {
//             const cover = canvas.toDataURL('image/jpeg');
//             resolve(cover);
//           });
//         });
//       })
//       .catch((err) => {
//         resolve('');
//       });
//   });
// };
