// import puppeteer from 'puppeteer-core';

// export default async function scrapeGoogle(query, topN = 10) {
//   const browser = await puppeteer.launch({ headless: true });
//   const page = await browser.newPage();

//   try {
//     // Set user agent
//     await page.setUserAgent(
//       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
//     );

//     // Navigate to Google Search
//     const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
//     await page.goto(url, { waitUntil: 'networkidle2' });

//     // Check for CAPTCHA
//     const isCaptcha = await page.$('#captcha');
//     if (isCaptcha) {
//       console.log('CAPTCHA detected. Unable to scrape.');
//       return [];
//     }

//     // Wait for search results
//     await page.waitForSelector('.tF2Cxc', { timeout: 60000 });

//     const results = await page.evaluate(() => {
//       return Array.from(document.querySelectorAll('.tF2Cxc')).map((result) => {
//         // Extract title
//         const title = result.querySelector('h3')?.innerText || 'No title found';

//         // Extract link
//         const link = result.querySelector('a')?.href || 'No link found';

//         // Extract snippet with fallback logic
//         let snippet;

//         // Try the known class for snippets
//         snippet = result.querySelector('.VwiC3b')?.innerText?.trim();

//         // Fallback to the last <div> within the parent container
//         if (!snippet) {
//           const lastDiv = result.querySelector('div:last-of-type');
//           snippet = lastDiv?.innerText?.trim();
//         }

//         // Fallback using a regex pattern for dynamic classes
//         if (!snippet) {
//           const regexClassElement = Array.from(
//             result.querySelectorAll('div'),
//           ).find(
//             (div) =>
//               div.className.includes('Vwi') ||
//               div.className.includes('snippet'),
//           );
//           snippet = regexClassElement?.innerText?.trim();
//         }

//         // Default fallback
//         if (!snippet) {
//           snippet = 'No snippet available';
//         }

//         return { title, link, snippet };
//       });
//     });

//     return results.slice(0, topN); // Limit to top N results
//   } catch (error) {
//     console.error('Error scraping Google:', error.message);
//     return [];
//   } finally {
//     await browser.close();
//   }
// }

// // Example usage
// // scrapeGoogle("How does photosynthesis work?", 5).then(console.log);
