import axios from "axios";
import { load as cheerio_load } from "cheerio";

/**
 * @param {string} query
 * @param {number} topN
 * @param {boolean} useChinaBing - use cn.bing.com (accessible from mainland China)
 */
export default async function scrapeBing(query, topN = 3, useChinaBing = false) {
  const host = useChinaBing ? 'cn.bing.com' : 'www.bing.com';
  const url = `https://${host}/search?q=${encodeURIComponent(query)}`;
  const { data: html } = await axios.get(url, {
   //  headers: { "User-Agent": "Mozilla/5.0" },
  });

  const $ = cheerio_load(html);
  const results = [];

  $(".b_algo").each((index, element) => {
    if (index >= topN) return false; // Limit to topN results
    results.push({
      title: $(element).find("h2").text(),
      link: $(element).find("h2 a").attr("href"),
      snippet: $(element).find(".b_caption p").text(),
    });
  });

  return results;
}

// scrapeBing("How does photosynthesis work?").then(console.log);
