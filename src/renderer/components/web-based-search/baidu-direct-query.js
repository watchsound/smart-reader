import axios from 'axios';
import { load as cheerio_load } from 'cheerio';

/**
 * Scrape Baidu search results. Used as the primary search engine for mainland China.
 * @param {string} query - Search query.
 * @param {number} topN - Number of results to return.
 * @returns {Promise<Array>} - Array of {title, link, snippet}.
 */
export default async function scrapeBaidu(query, topN = 3) {
  const url = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}&rn=10`;

  try {
    const { data: html } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
    });

    const $ = cheerio_load(html);
    const results = [];

    // Baidu result containers carry the canonical URL in the `mu` attribute
    $('[class^="result"]').each((index, element) => {
      if (results.length >= topN) return false;

      const title = $(element).find('h3').text().trim();
      // Prefer the mu attribute (actual destination URL) over Baidu's redirect href.
      // Baidu Scholar results use "http://fakeurl.baidu.com/xueshu" as a mu placeholder
      // — skip any link that isn't a real resolvable origin.
      const muAttr = $(element).attr('mu') || '';
      const hrefAttr = $(element).find('h3 a').attr('href') || '';
      const rawLink = muAttr || hrefAttr;
      const isFake = !rawLink ||
        rawLink.includes('fakeurl') ||
        rawLink.startsWith('/');
      const link = isFake ? '' : rawLink;

      const snippet =
        $(element).find('.c-abstract').text().trim() ||
        $(element).find('[class*="abstract"]').text().trim() ||
        $(element).find('[class*="content"]').first().text().trim();

      if (title && link) {
        results.push({ title, link, snippet });
      }
    });

    return results;
  } catch (error) {
    console.error('Error scraping Baidu:', error.message);
    return [];
  }
}
