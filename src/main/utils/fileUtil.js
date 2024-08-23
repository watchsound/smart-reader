// const fetch = require('node-fetch');
const cheerio = require('cheerio');
// const https = require('https');
const { net } = require('electron');

async function fetchData(url) {
  return new Promise((resolve, reject) => {
    const request = net.request(url);

    request.on('response', (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        resolve(data);
      });

      response.on('error', (error) => {
        reject(error);
      });
    });

    request.end();
  });
}
async function fetchFavicon(faviconUrl) {
  return new Promise((resolve, reject) => {
    const request = net.request(faviconUrl);

    let chunks = [];

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        chunks.push(chunk);
      });

      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });

      response.on('error', (error) => {
        reject(error);
      });
    });

    request.end();
  });
}

// Create an agent to ignore SSL certificate errors
// const agent = new https.Agent({
//   rejectUnauthorized: false,
// });

export async function getFaviconBase64(url) {
  try {
    console.log(` url = ${url}`);
    // const response = await fetch(url, {
    //   agent,
    // });
    // const text = await response.text();
    const text = await fetchData(url);

    console.log(` text before cheerio load `);
    const $ = cheerio.load(text);

    // Find the favicon link
    const link = $("link[rel*='icon']").attr('href');
    if (!link) {
      throw new Error('No favicon found');
    }

    // Get the favicon URL
    let faviconUrl = link;
    if (!faviconUrl.startsWith('http')) {
      // Handle relative URLs
      const baseUrl = new URL(url).origin;
      faviconUrl = new URL(faviconUrl, baseUrl).href;
    }
    console.log(` faviconUrl = ${faviconUrl} `);
    // Fetch the favicon image
    // const faviconResponse = await fetch(faviconUrl);
    // const buffer = await faviconResponse.buffer();
    const buffer = await fetchFavicon(faviconUrl);
    const base64data = buffer.toString('base64');

    return `data:image/x-icon;base64,${base64data}`;
  } catch (error) {
    console.error('Error fetching favicon:', error);
    return '';
  }
}

export async function getFaviconBase64_inWeb(url) {
  try {
    // Fetch the HTML content of the URL
    // const response = await fetch(url);
    // const text = await response.text();
    const text = await fetchData(url);

    // Create a DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');

    // Find the favicon link
    const link = doc.querySelector("link[rel*='icon']");
    if (!link) {
      throw new Error('No favicon found');
    }

    // Get the favicon URL
    let faviconUrl = link.href;
    if (!faviconUrl.startsWith('http')) {
      // Handle relative URLs
      const baseUrl = new URL(url).origin;
      faviconUrl = new URL(faviconUrl, baseUrl).href;
    }

    // Fetch the favicon image
    // const faviconResponse = await fetch(faviconUrl);
    // const blob = await faviconResponse.blob();
    const blob = await fetchFavicon(faviconUrl);

    // Convert the blob to a base64 string
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    return new Promise((resolve, reject) => {
      reader.onloadend = () => {
        const base64data = reader.result;
        resolve(base64data);
      };
      reader.onerror = reject;
    });
  } catch (error) {
    console.error('Error fetching favicon:', error);
    return null;
  }
}
