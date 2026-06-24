import axios from 'axios';
import { JSDOM } from 'jsdom';
// import cheerio from 'cheerio';
import { Buffer } from 'buffer';
import puppeteer from 'puppeteer-core';
import findChrome from 'chrome-finder';

export async function fetchPageHeadless(url) {
  if (!url || !/^https?:\/\//i.test(url)) {
    console.error('fetchPageHeadless: invalid URL', url);
    return '';
  }
  const chromePath = findChrome();
  console.log(` chrompath = ${chromePath}`);
  const browser = await puppeteer.launch({
    executablePath: chromePath, // Specify path to Electron's Chromium
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--ignore-certificate-errors', // Add this line
      '--ignore-ssl-errors', // Add this line
    ],
    ignoreDefaultArgs: ['--disable-extensions'],
    headless: true,
    dumpio: true,
  });
  const page = await browser.newPage();

  try {
    // Set user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    );

    // Navigate to the URL
    // This means the navigation is considered complete when there are no more than 2 ongoing network connections for at least 500ms.
    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    } catch (e) {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      // Page may still be mid–JS redirect after domcontentloaded; let it settle.
      await page
        .waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 })
        .catch(() => {});
    }

    // Check for CAPTCHA — skip gracefully if a navigation destroyed the context.
    try {
      const isCaptcha = await page.$('#captcha');
      if (isCaptcha) {
        console.log('CAPTCHA detected. Unable to scrape.');
        return '';
      }
    } catch (_e) {
      // Execution context was destroyed by a client-side navigation; skip check.
    }

    // Get the page content as a string
    const pageContent = await page.content();
    return pageContent;
  } catch (error) {
    console.error('Error occurred:', error);
    return '';
  } finally {
    await browser.close();
  }
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
