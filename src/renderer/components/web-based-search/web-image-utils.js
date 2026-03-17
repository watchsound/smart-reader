import axios from 'axios';
import { load as cheerio_load } from 'cheerio';
// import { Ollama } from "ollama";
// import parse from "json-parse-even-better-errors";
import { instanceInRender as aiProviderManager } from '../../../commons/service/AIProviderManager';

import {
  parseJsonFromLLM,
  JSON_SYSTEM_PROMPT,
  getMatchImagesToSectionsPrompt,
  queryOllamaWithReturnJson,
} from './utils.js';
import customStorage from '../../store/customStorage';

// Fetch HTML content of a web page
export async function fetchPage(url) {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(` fetchPage url = ${url}`);
    console.error(`Error fetching the page: ${error.message}`);
    return null;
  }
}
export async function fetchPageHeadless(url) {
   return customStorage.fetchPageHeadless(url);
}

// Extract images from metadata
export function extractImagesFromMetadata(html) {
  const $ = cheerio_load(html);
  const metadataImages = [];

  // Check Open Graph protocol
  const ogImage = $('meta[property="og:image"]').attr('content');
  if (ogImage) {
    metadataImages.push({ src: ogImage, type: 'og:image' });
  }

  // Check Twitter Cards
  const twitterImage = $('meta[name="twitter:image"]').attr('content');
  if (twitterImage) {
    metadataImages.push({ src: twitterImage, type: 'twitter:image' });
  }

  // Check favicon or related link
  const icon =
    $('link[rel="icon"]').attr('href') ||
    $('link[rel="shortcut icon"]').attr('href');
  if (icon) {
    metadataImages.push({ src: icon, type: 'icon' });
  }

  return metadataImages;
}

// Extract prominent images from the main page content
export function extractProminentImages(html) {
  const $ = cheerio_load(html);
  const prominentImages = [];

  // Define meaningful image size threshold
  const MIN_WIDTH = 300;
  const MIN_HEIGHT = 300;

  // Locate images within <article>, <main>, or <section>
  $('article img, main img, section img').each((index, img) => {
    const src = $(img).attr('src');
    const alt = $(img).attr('alt') || '';
    const title = $(img).attr('title') || '';
    const width = parseInt($(img).attr('width')) || 0;
    const height = parseInt($(img).attr('height')) || 0;

    const priority =
      width >= MIN_WIDTH && height >= MIN_HEIGHT ? 'high' : 'low';

    prominentImages.push({
      src,
      alt,
      title,
      width,
      height,
      priority,
    });
  });
  return prominentImages;
}

// Extract images and their metadata from the HTML
export function extractFallbackImages(html) {
  const $ = cheerio_load(html);
  const images = [];
  const MIN_WIDTH = 300;
  const MIN_HEIGHT = 300;
  $('img').each((index, img) => {
    const src = $(img).attr('src');
    const alt = $(img).attr('alt') || '';
    const title = $(img).attr('title') || '';
    const width = $(img).attr('width') || 0;
    const height = $(img).attr('height') || 0;

    if (src) {
      const priority =
        width >= MIN_WIDTH && height >= MIN_HEIGHT ? 'fallback' : 'low';
      images.push({
        src,
        alt,
        title,
        width: parseInt(width) || null,
        height: parseInt(height) || null,
        priority,
      });
    }
  });

  return images;
}

// Combine high-priority and fallback images, removing duplicates and sorting by priority
export function combineImages(highPriorityImages, fallbackImages) {
  const combined = [...highPriorityImages, ...fallbackImages];

  // Deduplicate based on src
  const uniqueImages = [];
  const seenUrls = new Set();

  combined.forEach((image) => {
    if (!seenUrls.has(image.src)) {
      uniqueImages.push(image);
      seenUrls.add(image.src);
    }
  });

  // Sort images by priority: high > fallback > low
  uniqueImages.sort((a, b) => {
    const priorityOrder = { high: 3, fallback: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

  return uniqueImages;
}

// Decompose the page into sections using ChatOllama
export async function decomposeContent(html) {
  const query = `
    Decompose the following HTML content into sections.
    Each section should have a title and a summary.
    Return the result as JSON, adhering to the following schema:

[
  {
    "title": "string",
    "summary": "string"
  },
  {
    "title": "string",
    "summary": "string"
  },
  // ... more sections
]

  `;

  try {
    const response = await aiProviderManager.sendChatMessage([
      { role: 'system', content: JSON_SYSTEM_PROMPT },
      { role: 'user', content: query + html },
    ]);
    console.log(`response = ${JSON.stringify(response)}`);
    //  return JSON.parse(response.message);
    const { content } = response.message;
    const r = await parseJsonFromLLM(content);
    if (r) return r;
  } catch (error) {
    console.error(`Error with LLM decomposition: ${error.message}`);
  }
  return [];
}

// Match images to sections using LLM for semantic matching
export async function matchImagesToSections(images, sections) {
  const query = getMatchImagesToSectionsPrompt(sections, images);
  console.log(' matchImagesToSections query = ' + query);
  const r = queryOllamaWithReturnJson(query);
  if (r) return r;
  return sections; //sections.map((section) => ({ ...section, images: [] }));
}

export function getSurroundingText(imgElement) {
  // Find the closest container with potential textual context
  let container = imgElement.closest('p, div, span');

  if (!container) return ''; // If no container found, return empty string

  // Get all child nodes of the container
  const childNodes = Array.from(container.childNodes);

  // Filter only visible and text-related nodes
  const visibleTextNodes = childNodes.filter((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      // For text nodes, check if their parent element is visible
      const parent = node.parentElement;
      if (parent) {
        const style = window.getComputedStyle(parent);
        return (
          style && style.display !== 'none' && style.visibility !== 'hidden'
        );
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // For element nodes, ensure they are visible
      const style = window.getComputedStyle(node);
      return style && style.display !== 'none' && style.visibility !== 'hidden';
    }
    return false;
  });

  // Extract and combine text content
  return visibleTextNodes.map((node) => node.textContent.trim()).join(' ');
}

function getSurroundingTextByCheerio($, imgElement) {
  // Find the closest parent container with text, e.g., a paragraph, div, or span
  const container = imgElement.closest('p, div, span');

  if (!container.length) return ''; // If no container is found, return an empty string

  // Extract text content from the container, ignoring non-text nodes like style/script
  return container
    .contents() // Get child nodes
    .filter(
      (_, node) =>
        node.type === 'text' ||
        (node.type === 'tag' &&
          node.name !== 'style' &&
          node.name !== 'script'),
    ) // Filter relevant nodes
    .map((_, node) => $(node).text().trim()) // Extract text content and trim whitespace
    .get() // Convert to array
    .join(' '); // Join all text fragments
}

export async function extractImageInfo(html) {
  // Step 2: Extract images
  const metadataImages = extractImagesFromMetadata(html) || [];
  const prominentImages = extractProminentImages(html) || [];
  const fallbackImages = extractFallbackImages(html) || [];
  const mergedImage = combineImages(prominentImages, fallbackImages) || [];

  const $ = cheerio_load(html);
  const combinedImages = mergedImage.map((image) => {
    const imgElement = $(`img[src='${image.src}']`);
    // const surroundingText = imgElement.closest('p, div, span').text().trim();
    const surroundingText = getSurroundingTextByCheerio($, imgElement);
    return {
      src: image.src,
      alt: image.alt,
      title: image.title,
      width: image.width,
      height: image.height,
      priority: image.priority,
      context: surroundingText || '',
    };
  });

  return { combinedImages, metadataImages };
}

export async function assignImageToSectionsFromHtmlPage(
  html,
  combinedImages,
  ollama,
) {
  const sections = await decomposeContent(html);
  console.log(typeof sections);
  console.log(`sections = ${sections}`);

  let sectionsWithImages = [];
  if (combinedImages.length > 0) {
    sectionsWithImages = await matchImagesToSections(combinedImages, sections);
  }
  return sectionsWithImages;
}
