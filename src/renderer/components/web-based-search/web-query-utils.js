/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
import axios from 'axios';
import { load as cheerio_load } from 'cheerio';
// import { Ollama } from 'ollama';
import { instanceInRender as aiProviderManager } from '../../../commons/service/AIProviderManager';
import spineApi from '../../api/spineApi';

import {
  parseJsonFromLLM,
  stripNumberAndDot,
  getClassificationPrompt,
  JSON_SYSTEM_PROMPT,
  queryOllamaWithReturnJson,
} from './utils.js';
import customStorage from '../../store/customStorage';

// Alternative authoritative sources accessible from mainland China
export const site_categories_cn = [
  {
    category: 'General Knowledge and Education',
    sites: ['baike.baidu.com', 'baike.sogou.com', 'baike.wiki'],
  },
  {
    category: 'Science and Technology',
    sites: ['guokr.com', 'zhihu.com'],
  },
  {
    category: 'Health and Medicine',
    sites: ['39.net', 'dxy.cn'],
  },
  {
    category: 'History and Culture',
    sites: ['cctv.com', 'kaogu.cn'],
  },
  {
    category: 'Environment and Nature',
    sites: ['cenews.com.cn', 'nea.gov.cn'],
  },
  {
    category: 'Finance and Economics',
    sites: ['eastmoney.com', 'xueqiu.com'],
  },
  {
    category: 'Technology and Innovation',
    sites: ['36kr.com', 'sspai.com'],
  },
  {
    category: 'Mathematics and Programming',
    sites: ['csdn.net', 'juejin.cn'],
  },
];

export const site_categories = [
  {
    category: 'General Knowledge and Education',
    sites: [
      'wikipedia.org',
      'britannica.com',
      'scienceabc.com',
      //   "howstuffworks.com",
      //   "khanacademy.org",
    ],
  },
  {
    category: 'Science and Technology',
    sites: [
      'nationalgeographic.com',
      'livescience.com',
      //   "royalsociety.org",
    ],
  },
  {
    category: 'Health and Medicine',
    sites: ['mayoclinic.org', 'webmd.com', 'nih.gov'],
  },
  {
    category: 'History and Culture',
    sites: ['history.com', 'si.edu', 'worldhistory.org'],
  },
  {
    category: 'Environment and Nature',
    sites: ['worldwildlife.org', 'usgs.gov', 'climate.gov'],
  },
  {
    category: 'Finance and Economics',
    sites: ['investopedia.com', 'thebalance.com'],
  },
  {
    category: 'Technology and Innovation',
    sites: ['techcrunch.com', 'arstechnica.com', 'wired.com'],
  },
  {
    category: 'Mathematics and Programming',
    sites: ['stackoverflow.com', 'wolframalpha.com', 'brilliant.org'],
  },
];

// Example usage
// const googleResults = [
//   {
//     title: "Google Result 1",
//     link: "http://example.com/1",
//     snippet: "This is a snippet from Google.",
//   },
//   { title: "Google Result 2", link: "http://example.com/2", snippet: "" }, // Invalid
// ];

// const bingResults = [
//   {
//     title: "Bing Result 1",
//     link: "http://example.com/1",
//     snippet: "Duplicate snippet from Bing.",
//   }, // Duplicate
//   {
//     title: "Bing Result 2",
//     link: "http://example.com/3",
//     snippet: "This is a snippet from Bing.",
//   },
// ];

// const mergedResults = mergeSearchResults(googleResults, bingResults);
// console.log(mergedResults);

export function mergeSearchResults(googleResults, bingResults) {
  // Combine both arrays
  const combinedResults = [...googleResults, ...bingResults];

  // Remove invalid records (empty snippets) and duplicate links
  const uniqueResults = combinedResults
    .filter((result) => result.snippet && result.snippet.trim() !== '') // Remove invalid records
    .reduce((acc, current) => {
      // Check for duplicate links
      if (!acc.some((item) => item.link === current.link)) {
        acc.push(current);
      }
      return acc;
    }, []);

  return uniqueResults;
}

export async function semanticMatchWithOllama(query, searchResults, topN) {
  // Construct query_prompt
  const query_prompt = `
User Query: "${query}"

Here are some descriptions from search results:
${searchResults
  .map(
    (result, index) =>
      `${index + 1}. Title: ${result.title}\nSnippet: ${result.snippet}`,
  )
  .join('\n')}

Please identify and rank the most relevant results based on semantic similarity to the user's query.
Provide a relevance score for each result and return the top ${topN} most relevant ones.
`;

  // Query Ollama with the constructed prompt
  const response = await spineApi.generateContent(query_prompt, { label: 'web-search' });

  // Parse the response
  const parsedResponse = JSON.parse(response); // Assuming response is structured
  return parsedResponse.slice(0, topN); // Return the top N results
}

/**
 * Fetch web content and extract plain text.
 * @param {Array} urls - Array of URLs to fetch.
 * @returns {Promise<Array>} - Array of extracted plain texts.
 */
export async function fetchAndExtractTextFromURL(urls) {
  const results = [];

  for (const url of urls) {
    try {
      // const { data: html } = await axios.get(url, {
      //   // headers: {
      //   //   'User-Agent':
      //   //     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      //   // },
      // });
      const html = await customStorage.fetchPageHeadless(url);
      if (html) {
        const $ = cheerio_load(html);

        // Remove script and style tags
        $('script, style').remove();

        // Extract visible text
        const text = $('body').text().replace(/\s+/g, ' ').trim();

        results.push({ url, text });
      }
    } catch (error) {
      console.error(`Error fetching URL ${url}:`, error.message);
      results.push({ url, text: 'Failed to fetch content' });
    }
  }

  return results;
}

export async function fetchAndExtractTextFromCache(url2html) {
  const results = [];

  for (const key in url2html) {
    try {
      const html = url2html[key];
      const $ = cheerio_load(html);
      // Remove script and style tags
      $('script, style').remove();

      // Extract visible text
      const text = $('body').text().replace(/\s+/g, ' ').trim();

      results.push({ url: key, text });
    } catch (error) {
      console.error(`Error fetching URL ${url}:`, error.message);
      results.push({ url: key, text: 'Failed to fetch content' });
    }
  }

  return results;
}

/**
 * Construct a prompt for Ollama with the user query and web content.
 * @param {string} userQuery - Original user query.
 * @param {Array} webContents - Array of web content with URLs and text.
 * @returns {string} - Generated prompt.
 */
export function constructContextPrompt(userQuery, webContents) {
  let prompt = `You are an AI assistant with extensive knowledge about various topics. Using your own understanding and the following additional web content as complementary resources, answer the user query in detail..\n\n`;
  prompt += `User Query: "${userQuery}"\n\n`;
  prompt += `Here are the web contents extracted from various sources:\n`;

  webContents.forEach((content, index) => {
    prompt += `Source ${index + 1} (URL: ${
      content.url
    }):\n${content.text.slice(0, 1000)}\n\n`; // Limit text for brevity
  });

  prompt += `\nBased on your knowledge and the provided web content, to answer user's query: ${userQuery}, provide a comprehensive response in the following JSON format::\n`;
  prompt += `{
  "summary": "A concise summary of the topic.",
  "sections": [
    { "title": "Section Title 1", "detail": "Detailed explanation of this section." },
    { "title": "Section Title 2", "detail": "Detailed explanation of this section." },
    { "title": "Section Title 3", "detail": "Detailed explanation of this section." },
  ]
}
  \n\n
  you should create at least three sections, each section should be logically related to answer the user query: ${userQuery}.
  "detail" should be a detailed explanation of the section, contains at least 60 words.

 ##  ${JSON_SYSTEM_PROMPT}.
`;

  return prompt;
}

/// ////////////////////////////////////////////////
async function processQuery(userQuery, matchedResults) {
  // Step 1: Fetch and extract text from URLs
  const urls = matchedResults.map((result) => result.link);
  const webContents = await fetchAndExtractTextFromURL(urls);
  console.log(`webContent = ${JSON.stringify(webContents)}`);

  // Step 2: Construct prompt for Ollama
  const prompt = constructContextPrompt(userQuery, webContents);
  console.log(`prompt = ${prompt}`);
  // Step 3: Query Ollama with the constructed prompt
  const ollamaResponse = await queryOllamaWithReturnJson(prompt);

  return ollamaResponse;
}

/**
 * Determine the query category and return matched domains.
 * @param {string} userQuery - The user's query.
 * @returns {Promise<{category: string, sites: string[]}>} - Matched category and domains.
 */
export async function getMatchedCategoryAndDomains(userQuery, categories = site_categories) {
  try {
    // Construct the prompt for the LLM
    const prompt = `You are a category classifier. Determine which category the following query belongs to. Here are the available categories:\n
${categories
  .map((cat, index) => `${index + 1}. ${cat.category}`)
  .join('\n')}\n
Query: "${userQuery}"\n
Return only category name.`;

    // Query the LLM
    const response = await spineApi.generateContent(prompt, { label: 'web-search' });

    console.log(`response = ${JSON.stringify(response)}`);
    let matchedCategory = response.trim();
    console.log(`matchedCategory = ${matchedCategory}`);
    matchedCategory = stripNumberAndDot(matchedCategory);
    // Find the category and domains
    const matched = categories.find(
      (cat) => cat.category === matchedCategory,
    );

    if (matched) {
      return { category: matched.category, sites: matched.sites };
    }
    throw new Error(
      'Category not matched. Check the query or the categories list.',
    );
  } catch (error) {
    console.error('Error determining category:', error.message);
    return { category: null, sites: [] };
  }
}

export async function getClassificationForUI(userQuery, context) {
  try {
    // Construct the prompt for the LLM
    const prompt = getClassificationPrompt(userQuery, context);
    // Query the LLM
    const response = await queryOllamaWithReturnJson(prompt);
    return response;
  } catch (error) {
    console.error('Error determining getClassificationForUI:', error.message);
    return { classification: '', reason: '' };
  }
}

// Example usage
// const userQuery = "What is photosynthesis?";
// const matchedResults = [
//   {
//     title: "Photosynthesis - Wikipedia",
//     link: "https://en.wikipedia.org/wiki/Photosynthesis",
//   },
//   {
//     title: "How Plants Make Food | Science ABC",
//     link: "https://www.scienceabc.com/nature/how-and-why-do-plants-make-fruits-vegetables.html",
//   },
// ];

// processQuery(userQuery, matchedResults).then((response) =>
// console.log(response)
// );

// Test getMatchedCategoryAndDomains
//  const ollama = new Ollama({ host: "http://127.0.0.1:11434" });
//  (async () => {
//    const userQuery = "How do plants perform photosynthesis?";
//    const result = await getMatchedCategoryAndDomains(userQuery, ollama);

//    console.log(result);
//    // Example Output:
//    // { category: "Science and Technology", sites: ["nasa.gov", "nationalgeographic.com", "sciencedirect.com", "livescience.com", "royalsociety.org"] }
//  })();
