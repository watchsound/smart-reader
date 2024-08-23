import axios from 'axios';
import { JSDOM } from 'jsdom';
// import cheerio from 'cheerio';
import { Buffer } from 'buffer';

export function cleanString(str) {
  if (!str) return str;
  // Replace newlines with nothing (remove them)
  let result = str.replace(/[\r\n]+/g, '');
  // Replace consecutive whitespace with a single space
  result = result.replace(/\s{2,}/g, ' ');
  return result;
}

export async function fetchTextContent(url, textLength) {
  try {
    // Fetching the URL content
    const response = await axios.get(url);
    if (response.status !== 200) {
      return '';
    }

    // Getting the text from the response and parsing the HTML content to a Document object
    const dom = new JSDOM(response.data);
    const doc = dom.window.document;

    // Attempt to find the main content using common selectors
    let content =
      doc.querySelector('.mw-body-content') ||
      doc.querySelector(
        'article, .article, #main, .content, main, section[role="main"]',
      );

    // Fallback to checking large blocks of text if no common selectors match
    if (!content) {
      let maxTextLength = 0;
      doc.querySelectorAll('div, section').forEach((node) => {
        const tLength = node.textContent.trim().length;
        if (
          tLength > maxTextLength &&
          node.querySelectorAll('a').length / tLength < 0.1
        ) {
          // Low link density indicates significant text content
          content = node;
          maxTextLength = tLength;
        }
      });
    }

    return content
      ? cleanString(content.textContent.trim()).slice(0, textLength)
      : '';
  } catch (error) {
    console.error('Failed to fetch page: ', error);
    return '';
  }
}

export const convertUrlToBase64 = async (url) => {
  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer', // This tells axios to fetch the data as a binary buffer
    });

    if (response.status === 200) {
      // Convert the Buffer to base64
      const base64 = Buffer.from(response.data, 'binary').toString('base64');
      return `data:${response.headers['content-type']};base64,${base64}`;
    }
    throw new Error('Network response was not ok.');
  } catch (error) {
    console.error('Error converting to base64:', error);
    throw error; // Rethrow to maintain the error state upstream
  }
};

async function fetchMetadata(url) {
  try {
    console.log(`url = ${url}`);
    const response = await axios.get(url);
    const html = response.data;
    console.log(`html returned `);
    const cheerio = require('cheerio');
    const $ = cheerio.load(html);

    const metaTags = {
      title: $('meta[property="og:title"]').attr('content'),
      description: $('meta[property="og:description"]').attr('content'),
      image: $('meta[property="og:image"]').attr('content'),
      url: $('meta[property="og:url"]').attr('content'),
      type: $('meta[property="og:type"]').attr('content'),
      favicon: '',
    };

    return metaTags;
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return {
      title: '',
      description: '',
      image: '',
      url: '',
      type: '',
      favicon: '',
    };
  }
}

export default fetchMetadata;
