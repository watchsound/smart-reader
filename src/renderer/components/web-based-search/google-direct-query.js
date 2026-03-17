import axios from "axios";
import { load as cheerio_load } from "cheerio";

/**
 * Scrape Google search results.
 * @param {string} query - Search query.
 * @param {number} topN - Number of results to fetch.
 * @returns {Promise<Array>} - Array of search results (title, link, snippet).
 */
export default async function scrapeGoogle(query, topN = 3) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

  try {
    // Fetch HTML from Google Search
    const { data: html } = await axios.get(url, {
      // headers: {
      //   "User-Agent":
      //     "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      // },
    });

    // Load HTML with Cheerio
    const $ = cheerio_load(html);
    const results = [];

    // Parse results
    $(".tF2Cxc").each((index, element) => {
      if (index >= topN) return false; // Limit to topN results
      const title = $(element).find("h3").text();
      const link = $(element).find("a").attr("href");
      // Snippet extraction with fallback logic
      let snippet;

      // Try the known class for snippets
      snippet = $(element).find(".VwiC3b").text().trim();

      // Fallback to parent container logic
      if (!snippet) {
        snippet = $(element).find("div").last().text().trim(); // Last <div> inside parent
      }

      // Fallback using a general regex for class names
      if (!snippet) {
        snippet = $(element)
          .find("[class*='Vwi'], [class*='snippet']")
          .text()
          .trim();
      }

      // If still no snippet found, set default
      if (!snippet) {
        snippet = "";
      }

      results.push({ title, link, snippet });
    });

    return results;
  } catch (error) {
    console.error("Error scraping Google:", error.message);
    return [];
  }
}

// Example usage
// scrapeGoogle("How does photosynthesis work?", 5).then(console.log);
