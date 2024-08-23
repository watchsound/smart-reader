// import { useEffect, useState, useMemo } from 'react';
// import { v4 as uuid } from 'uuid';
// import Box from '@mui/material/Box';

// import IconButton from '@mui/material/IconButton';
// import TextField from '@mui/material/TextField';
// import AddCardOutlinedIcon from '@mui/icons-material/AddCardOutlined';
// import Dialog from '@mui/material/Dialog';
// import DialogTitle from '@mui/material/DialogTitle';
// import DialogContent from '@mui/material/DialogContent';
// import DialogActions from '@mui/material/DialogActions';
// import Card from '@mui/material/Card';
// import CardActions from '@mui/material/CardActions';
// import CardContent from '@mui/material/CardContent';
// import CardMedia from '@mui/material/CardMedia';

// import { useDispatch } from 'react-redux';
// import Alert from '@mui/material/Alert';
// import Snackbar from '@mui/material/Snackbar';
// import Tooltip from '@mui/material/Tooltip';
// import OpenAI from 'openai';

// import customStorage from '../../store/customStorage';
// import SmallButton from '../Button/SmallButton';

// import fetchMetadata, {
//   convertUrlToBase64,
//   fetchTextContent,
// } from './MetaExtractor';
// import { isEmpty } from '../../../commons/utils/commonUtil';
// import { createImage } from '../../api/booksApi';
// import callChatGptForSummary, {
//   callChatGPT4Group,
//   callChatGPT4Image,
// } from '../../../commons/utils/openaiUtil';

// /**
//  *
//  * @param param0
//  * @returns
//  */
// function CreateBookmarkModal({ url, openDialog, dialogHandle }) {
//   const [opened, setOpened] = useState(false);
//   const [submitting, setSubmitting] = useState(false);
//   const [apiKey, setApiKey] = useState('');
//   const [alert, setAlert] = useState(false);
//   const [alertContent, setAlertContent] = useState('');

//   const [description, setDescription] = useState('');
//   const [title, setTitle] = useState('');
//   const [imageId, setImageId] = useState('');
//   const [base64, setBase64] = useState('');
//   const [existingCategoryStr, setExistingCategoryStr] = useState('');
//   const dispatch = useDispatch();

//   const openai = useMemo(() => {
//     return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
//   }, [apiKey]);

//   useEffect(() => {
//     async function t() {
//       const id = await window.electron.ipcRenderer.getOpenAiApiKey();
//       setApiKey(id);
//     }
//     t();
//   }, []);

//   useEffect(() => {
//     if (openDialog) setOpened(true);
//   }, [openDialog]);

//   const fromUrlToBase64 = async (imageUrl) => {
//     try {
//       const result = await convertUrlToBase64(imageUrl);
//       const anImageId = uuid();
//       if (result) {
//         createImage({ id: anImageId, image: result });
//         setImageId(anImageId);
//         setBase64(result);
//         return anImageId;
//       }
//     } catch (error) {
//       console.error('Error converting image:', error);
//       return -1;
//     }
//   };

//   useEffect(() => {
//     async function fetchCode() {
//       if (!url) return;
//       const metaData = await fetchMetadata(url);
//       let anImageId = '';
//       if (metaData.image) {
//         anImageId = await fromUrlToBase64(metaData.image);
//         if (anImageId) {
//           metaData.imageId = anImageId;
//         }
//       }

//       if (!metaData.description) {
//         const content = await fetchTextContent(url, 200);
//         if (content) {
//           const r = callChatGptForSummary(openai, content, []);
//           if (r.title) {
//             if (!metaData.title) {
//               metaData.title = r.title;
//             }
//             metaData.description = r.summary;
//           } else {
//             if (!metaData.title) {
//               metaData.title = content.slice(0, 10);
//             }
//             metaData.description = content;
//           }
//         }
//       }

//       if (!anImageId) {
//         const imageUrl = callChatGPT4Image(
//           openai,
//           `${metaData.title} ${metaData.description}`,
//         );
//         if (imageUrl) {
//           anImageId = await fromUrlToBase64(imageUrl);
//           if (anImageId) {
//             metaData.imageId = anImageId;
//           }
//         }
//       }
//       setTitle(metaData.title);
//       setDescription(metaData.description);
//       const structure = await customStorage.printBookmarkGroupStructure('-');
//       setExistingCategoryStr(structure);
//     }
//     if (url && openDialog) fetchCode();
//   }, [url, openDialog]);

//   return (
//     <>
//       <Snackbar
//         open={alert}
//         autoHideDuration={6000}
//         onClose={() => setAlert(false)}
//       >
//         <Alert severity="error">{alertContent}</Alert>
//       </Snackbar>
//       <Dialog
//         open={opened}
//         onClose={() => {
//           setOpened(false);
//           if (dialogHandle) dialogHandle(null);
//         }}
//         aria-labelledby="custom-modal-title"
//         maxWidth="sm"
//         fullWidth
//       >
//         <DialogTitle id="custom-modal-title">Create Bookmark</DialogTitle>
//         <DialogContent>
//           {base64 && (
//             <Card sx={{ maxWidth: 345 }}>
//               <CardMedia component="img" height="140" image={base64} />
//             </Card>
//           )}
//           <Box
//             sx={{
//               display: 'flex',
//               flexDirection: 'column',
//               gap: 2, // Adjust the space between rows
//             }}
//           >
//             <TextField
//               label="Title"
//               value={title}
//               variant="outlined"
//               sx={{ marginBottom: '5px' }}
//               onChange={(event) => setTitle(event.currentTarget.value)}
//               data-autofocus
//             />
//             <TextField
//               placeholder="Description"
//               multiline
//               rows={4} //
//               value={description}
//               sx={{ marginBottom: '5px' }}
//               onChange={(event) => setDescription(event.currentTarget.value)}
//             />
//           </Box>
//         </DialogContent>
//         <DialogActions>
//           <SmallButton
//             onClick={async (event) => {
//               let newBookmark = null;
//               try {
//                 if (!title && !description) return;
//                 setSubmitting(true);
//                 event.preventDefault();
//                 let cat = await callChatGPT4Group(
//                   openai,
//                   existingCategoryStr,
//                   `${title} ${description}`,
//                 );
//                 cat = cat.replaceAll('-', '');
//                 let category = await customStorage.getBookmarkGroupByName(cat);
//                 if (!category) {
//                   category = await customStorage.createBookmarkGroup(null, cat);
//                 }
//                 newBookmark = {
//                   title: title || '',
//                   description: description || '',
//                   sourceType: 'url',
//                   sourceKey: url,
//                   cfi: '',
//                   percentage: 0,
//                   usedTimes: 0,
//                   star: 0,
//                   image: imageId || '',
//                   groupId: category ? category.id : -1,
//                 };
//                 const bm = await customStorage.createBookmark(newBookmark);
//                 await customStorage.savePDF4URL(bm.id, url);
//               } catch (error) {
//                 if (
//                   error.toJSON &&
//                   error.toJSON().message === 'Network Error'
//                 ) {
//                   setAlertContent('No internet connection.');
//                   setAlert(true);
//                 }
//                 const message = error.response?.data?.error?.message;
//                 if (message) {
//                   setAlertContent(message);
//                   setAlert(true);
//                 }
//               } finally {
//                 setSubmitting(false);
//                 setOpened(false);
//                 if (dialogHandle) dialogHandle(newBookmark);
//               }
//             }}
//           >
//             Create Bookmark
//           </SmallButton>
//           <SmallButton
//             onClick={(event) => {
//               setOpened(false);
//               if (dialogHandle) dialogHandle(null);
//             }}
//           >
//             Close
//           </SmallButton>
//         </DialogActions>
//       </Dialog>
//     </>
//   );
// }

// export default CreateBookmarkModal;
