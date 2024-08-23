// /* eslint-disable prettier/prettier */
// import React from 'react';
// import Box from '@mui/material/Box';
// import Button from '@mui/material/Button';
// import Typography from '@mui/material/Typography';
// import Modal from '@mui/material/Modal';
// import { Impress, Step } from 'react-impressjs';
// import 'react-impressjs/styles/react-impressjs.css';
// import customStorage from '../../store/customStorage';

// const generatePosition = () => {
//   // Generate x, y, z values within a practical range
//   const x = Math.random() * 1000; // x value between 0 and 1000
//   const y = Math.random() * 1000; // y value between 0 and 1000
//   const z = Math.random() * 500; // z value between 0 and 500

//   // Generate rotateX, rotateY, rotateZ values as multiples of 50
//   const rotateX = Math.floor(Math.random() * 7) * 50; // 0, 50, 100, 150, 200, 250, 300
//   const rotateY = Math.floor(Math.random() * 7) * 50;
//   const rotateZ = Math.floor(Math.random() * 7) * 50;

//   // Generate scale value from [1, 2, 3]
//   const scale = [1, 2, 3][Math.floor(Math.random() * 3)];

//   return { x, y, z, rotateX, rotateY, rotateZ, scale };
// };


// const style = {
//   position: 'absolute',
//   top: '50%',
//   left: '50%',
//   transform: 'translate(-50%, -50%)',
//   width: 'min(600px, 70%)',
//   bgcolor: 'background.paper',
//   border: '2px solid #000',
//   boxShadow: 24,
//   p: 4,
// };

// function Impressjs({ paragraph, closeHandler }) {
//   const [sentences, setSentences] = React.useState([]);
//   // const [open, setOpen] = React.useState(false);
//   React.useEffect(() => {
//     if (!paragraph) return;
//     async function t() {
//       const s = await customStorage.sentenceTokenizer(paragraph);
//       console.log(s);
//       setSentences(s || []);
//     }
//     t();
//   }, [paragraph]);

//   React.useEffect(() => {
//      const handleHashChange = () => {
//       const url = new URL(window.location);
//       if (!url.hash.startsWith('#/step-')) {
//         window.history.replaceState(null, '', '#/step-1');
//       }
//     };

//     // Set initial hash if not already set
//     if (!window.location.hash) {
//       window.history.replaceState(null, '', '#/step-1');
//     }

//     window.addEventListener('hashchange', handleHashChange);

//     return () => {
//       window.removeEventListener('hashchange', handleHashChange);
//     };
//   }, []);

//   const handleClose = () => {
//     // setOpen(false);
//     if (closeHandler) closeHandler();
//   }

//   return (
//     <Modal
//         open
//         onClose={handleClose}
//         aria-labelledby="Presentation"
//       >
//         <Box sx={style}>
//         {sentences.length > 0 && (
//           <Impress progress>
//               {sentences.map((content, index) => {
//                 const positionData = generatePosition();
//                 return (
//                   <Step key={index} id={index} data={{positionData}} duration={3000}>
//                     {content}
//                   </Step>
//                 );
//               })}
//             </Impress>
//         )}

//     </Box>
//     </Modal>
//   );
// }

// export default Impressjs;
