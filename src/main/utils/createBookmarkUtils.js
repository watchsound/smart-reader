/* eslint-disable prettier/prettier */
import { v4 as uuid } from 'uuid';
import puppeteer from 'puppeteer-core';
import path from 'path';
import fs  from 'fs';
import findChrome from 'chrome-finder';

import fetchMetadata, {
  fetchTextContent,
  convertUrlToBase64,
} from './webParserUtil';
import getSummaryChatHistoryPrompt, {
  getUserMessageForCategory,
} from '../../commons/utils/AIPrompts';
import { createBookmark, getBookmarksBySourceKey } from '../db/BookmarkManager';
import { createImage } from '../db/ImageManager';
import {
  printBookmarkGroupStructure,
  getBookmarkGroupByName,
  createBookmarkGroup,
} from '../db/BookmarkGroupManager';
import { getFaviconBase64 } from './fileUtil';
import { instanceInMain as aiProviderManager } from '../../commons/service/AIProviderManager';


async function savePDF4URL(id, url) {
  try {
    const dataPath = await global.shared.store.get('storageLocation');
    console.log(`dataPath = ${dataPath}`);
    if (!fs.existsSync(path.join(dataPath, 'pdf4url'))) {
      fs.mkdirSync(path.join(dataPath, 'pdf4url'), { recursive: true });
    }
    const savedPath = path.join(dataPath, 'pdf4url', id.toString());
    const chromePath = findChrome();
    console.log(` chrompath = ${chromePath}`)
    const browser = await puppeteer.launch({
      executablePath: chromePath, // Specify path to Electron's Chromium
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--ignore-certificate-errors', // Add this line
        '--ignore-ssl-errors',         // Add this line
      ],
      ignoreDefaultArgs: ['--disable-extensions'],
      headless: true,
      dumpio: true,
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.pdf({ path: savedPath, format: 'A4' });
    await browser.close();
    return 1;
  } catch (e) {
    console.log(e);
    return -1;
  }
}


async function fromUrlToBase64(imageUrl) {
  try {
    const result = await convertUrlToBase64(imageUrl);
    // const anImageId = uuid();
    if (result) {
      const r = await createImage( result  );
      return r.id;
    }
  } catch (error) {
    console.error('Error converting image:', error);
  }
  return '';
}

async function createUrlDescription( url) {
  const favicon = await getFaviconBase64(url);
  const metaData = await fetchMetadata(url);
  if (favicon) metaData.favicon = favicon;
  else if (metaData.image) metaData.favicon = await convertUrlToBase64(metaData.image);
  console.log(`favicon = ${metaData.favicon}`)
  if (!metaData.description) {
    const content = await fetchTextContent(url, 200);
    if (content) {
      const prompt  = getSummaryChatHistoryPrompt(content, []);
      let r2 = await aiProviderManager.sendChatMessage(prompt, '', {}, true);
      if (!r2) r2 = { title: '', summary: '', keywords: '' };
      if (r2 && r2.title) {
        if (!metaData.title) {
          metaData.title = r2.title;
        }
        metaData.description = r2.summary;
      } else {
        if (!metaData.title) {
          metaData.title = content.slice(0, 10);
        }
        metaData.description = content;
      }
    }
  }
  return metaData;
}
/**
 *
 * @param {*} url
 * @param {*} token
 * @returns null if exist or can not create
 */
async function createBookmarkUtils(url,  token) {
  const r = getBookmarksBySourceKey(url, 'url', token);
  if (r.length > 0) return null;

  const metaData = await fetchMetadata(url);
  let anImageId = '';
  if (metaData.image) {
    anImageId = await fromUrlToBase64(metaData.image);
    if (anImageId) {
      metaData.imageId = anImageId;
    }
  }

  if (!metaData.description) {
    const content = await fetchTextContent(url, 200);
    if (content) {
      const prompt  = getSummaryChatHistoryPrompt(content, []);
      let r2 = await aiProviderManager.sendChatMessage(prompt, '', {}, true);
      if (!r2) r2 = { title: '', summary: '', keywords: '' };
      if (r2 && r2.title) {
        if (!metaData.title) {
          metaData.title = r2.title;
        }
        metaData.description = r2.summary;
      } else {
        if (!metaData.title) {
          metaData.title = content.slice(0, 10);
        }
        metaData.description = content;
      }
    }
  }

  if (!anImageId) {
    // const key = global.shared.store.get('openai_image');
    if (aiProviderManager.currentProvider.isFullSupported()) {
      const imageUrl = aiProviderManager.generateImage(
        `${metaData.title} ${metaData.description}`,
      );
      if (imageUrl) {
        anImageId = await fromUrlToBase64(imageUrl);
        if (anImageId) {
          metaData.imageId = anImageId;
        }
      }
    }
  }
  // setTitle(metaData.title);
  // setDescription(metaData.description);
  const { title } = metaData;
  const { description } = metaData;
  if (!title && !description) return null;
  const groupStructure = printBookmarkGroupStructure('-', token);
  // setExistingCategoryStr(structure);
  let newBookmark = null;
  try {
    const prompt = getUserMessageForCategory(groupStructure,  `${title} ${description}`)
    let cat = await aiProviderManager.generateContent(prompt);
    cat = cat.replaceAll('-', '');
    let category = getBookmarkGroupByName(cat, token);
    if (!category) {
      category = createBookmarkGroup(null, cat, token);
    }
    newBookmark = {
      title: title || '',
      description: description || '',
      sourceType: 'url',
      sourceKey: url,
      cfi: '',
      percentage: 0,
      usedTimes: 0,
      star: 0,
      image: anImageId || '',
      groupId: category ? category.id : -1,
    };
    const bm = createBookmark(newBookmark, token);
    if (bm && typeof bm.id !== 'undefined') savePDF4URL(bm.id, url);
    return bm;
  } catch (error) {
    console.log(error);
    return null;
  }
}

export default createBookmarkUtils;
export {
  savePDF4URL,
  createUrlDescription
};
