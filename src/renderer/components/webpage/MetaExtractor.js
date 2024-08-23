// /* eslint-disable promise/always-return */
// import axios from 'axios';
// import cheerio from 'cheerio';

// /**
//  * // Replace 'https://example.com' with the URL you want to fetch metadata from
// // fetchMetadata('https://example.com').then(metadata => {
// //     console.log('Metadata:', metadata);
// // });
//  * @param {*} url
//  * @returns
//  */
// async function fetchMetadata(url) {
//   try {
//     const response = await axios.get(url);
//     const html = response.data;
//     const $ = cheerio.load(html);

//     const metaTags = {
//       title: $('meta[property="og:title"]').attr('content'),
//       description: $('meta[property="og:description"]').attr('content'),
//       image: $('meta[property="og:image"]').attr('content'),
//       url: $('meta[property="og:url"]').attr('content'),
//       type: $('meta[property="og:type"]').attr('content'),
//       favicon: '',
//     };

//     return metaTags;
//   } catch (error) {
//     console.error('Error fetching metadata:', error);
//     return { title: '', description: '', image: '', url: '', type: '' };
//   }
// }

// export async function fetchTextContent(url, textLength) {
//   let doc;
//   try {
//     // Fetching the URL content
//     const response = await fetch(url);
//     if (!response.ok) {
//       // throw new Error('Network response was not ok.');
//       return '';
//     }

//     // Getting the text from the response
//     const html = await response.text();

//     // Parsing the HTML content to a Document object
//     const parser = new DOMParser();
//     doc = parser.parseFromString(html, 'text/html');
//     // if (isWiki) {
//     let content = doc.querySelector('.mw-body-content');

//     if (content) return content.textContent.trim().slice(0, textLength);
//     // }
//     // Attempt to find the main content using common selectors
//     content = doc.querySelector(
//       'article, .article, #main, .content, main, section[role="main"]',
//     );
//     // Fallback to checking large blocks of text
//     if (!content) {
//       let maxTextLength = 0;
//       document.querySelectorAll('div, section').forEach((node) => {
//         const tLength = node.textContent.trim().length;
//         if (
//           tLength > maxTextLength &&
//           node.querySelectorAll('a').length / tLength < 0.1
//         ) {
//           // Low link density
//           content = node;
//           maxTextLength = tLength;
//         }
//       });
//     }
//     return content ? content.textContent.trim().slice(0, textLength) : '';
//   } catch (error) {
//     console.error('Failed to fetch page: ', error);
//     if (doc) return (doc.body.textContent || '').trim().slice(0, textLength);
//   }
//   return '';
// }

// /**
//  * // Usage in an async function
// async function handleConversion(url) {
//   try {
//     const result = await convertUrlToBase64(url);
//     console.log(result); // You can handle the base64 string here
//   } catch (error) {
//     console.error('Error converting image:', error);
//   }
// }
//  */
// export const convertUrlToBase64 = (url) => {
//   return new Promise((resolve, reject) => {
//     fetch(url)
//       .then((response) => {
//         if (response.ok) return response.blob();
//         throw new Error('Network response was not ok.');
//       })
//       .then((blob) => {
//         const reader = new FileReader();
//         reader.onloadend = () => {
//           resolve(reader.result);
//         };
//         reader.onerror = reject;
//         reader.readAsDataURL(blob);
//       })
//       .catch((error) => reject(error));
//   });
// };

// export default fetchMetadata;
