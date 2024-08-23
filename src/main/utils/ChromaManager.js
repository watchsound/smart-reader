import {
  ChromaClient,
  OpenAIEmbeddingFunction,
  GoogleGenerativeAiEmbeddingFunction,
  Collection,
  IEmbeddingFunction,
} from 'chromadb';
import { BrowserWindow, ipcMain } from 'electron';
import pdf from 'pdf-parse/lib/pdf-parse';
import fs from 'fs';

import ensureChromaIsRunning from './chromaUtil';
import aiProviderManager from '../../commons/service/AIProviderManager';
import { AIProvider } from '../../commons/model/DataTypes';
import { splitTextIntoChunks } from '../../commons/utils/CommonLangUtil';
import { getUserIdFromToken } from '../db/dbManager';
import { getBookById } from '../db/BookManager';
import { getMessageById } from '../db/MessageManager';
import { getNoteById } from '../db/NoteJsonManager';

class ChromaManager {
  constructor() {
    if (ChromaManager.instance) {
      return ChromaManager.instance;
    }

    this.embedder = undefined; // IEmbeddingFunction;
    this.collection = undefined; // Collection;
    this.inMemoryVectorDB = undefined; // Collection;
    this.chromaClient = undefined; // ChromaClient;
    ChromaManager.instance = this;
  }

  async setupChroma(store) {
    await ensureChromaIsRunning(store);
    this.chromaClient = new ChromaClient({
      path: store.get('chroma_url') || 'http://localhost:8000',
    });
  }

  async setupVectorDB(store, userId) {
    const apiKeyChatgpt = store.get(`openai_key_${userId}`);
    const apiKeyGemini = store.get(`gemini_key_${userId}`);
    if (
      apiKeyChatgpt &&
      aiProviderManager.currentProviderName === AIProvider.ChatGPT
    )
      this.embedder = new OpenAIEmbeddingFunction({
        openai_api_key: apiKeyChatgpt,
      });
    if (
      apiKeyGemini &&
      aiProviderManager.currentProviderName === AIProvider.Gemini
    )
      this.embedder = new GoogleGenerativeAiEmbeddingFunction({
        googleApiKey: apiKeyGemini,
      });

    if (this.embedder) {
      this.collection = await this.chromaClient.getOrCreateCollection({
        name: 'my_collection',
        embeddingFunction: this.embedder,
      });
      this.inMemoryVectorDB = await this.chromaClient.getOrCreateCollection({
        name: 'my_temp_collection',
        embeddingFunction: this.embedder,
      });
    } else {
      this.collection = await this.chromaClient.getOrCreateCollection({
        name: 'my_collection',
      });
      this.inMemoryVectorDB = await this.chromaClient.getOrCreateCollection({
        name: 'my_temp_collection',
      });
    }
  }

  async addContentToInMemoryVectorDB(content) {
    await this.chromaClient.deleteCollection({ name: 'my_temp_collection' });

    if (this.embedder) {
      this.inMemoryVectorDB = await this.chromaClient.getOrCreateCollection({
        name: 'my_temp_collection',
        embeddingFunction: this.embedder,
      });
    } else {
      this.inMemoryVectorDB = await this.chromaClient.getOrCreateCollection({
        name: 'my_temp_collection',
      });
    }

    const chunks = splitTextIntoChunks(content, 500);
    // chunks.forEach(async (m) => await inMemoryVectorDB.add(m));
    const ids = Array(chunks.length)
      .fill()
      .map((_, i) => i.toString());
    try {
      this.inMemoryVectorDB.add({
        ids,
        documents: chunks,
      });
    } catch (e) {
      console.log(e);
    }
    return true;
  }

  async AddBookmarkToVectorDB(store, bookmark, token) {
    if (!this.collection) return;
    const userId = getUserIdFromToken(token);
    if (userId < 0) return;
    const key = store.get(`useChroma_${userId}`);
    if (!key) return;
    const doc = `${bookmark.title}${bookmark.description}`;
    if (doc.length < 10) return;
    const { id } = bookmark;
    const type = bookmark.sourceType;
    console.log('add bookmark to vector...');
    try {
      this.collection.add({
        ids: [id.toString()],
        metadatas: [
          { source: String(bookmark.sourceKey), type, userId: String(userId) },
        ],
        documents: [doc],
      });
      console.log('add bookmark to vector...done');
    } catch (e) {
      console.log(e);
    }
  }

  async addBookToVecterDB(store, mainWin, sender, book, token) {
    console.log(` addBookToVecterDB ${JSON.stringify(book)}`);
    const userId = getUserIdFromToken(token);
    if (userId < 0) return;
    const key = store.get(`useChroma_${userId}`);
    if (!key) return;
    if (book && book.format === 'pdf') {
      this.addPDFToVecterDB(book.id, book.path, 250, token);
    }
    if (book && book.format === 'epub') {
      console.log(` addBookToVecterDB  in epub`);
      try {
        // onsole(` access main?  ${mainWin?webContents != null}`);
        // const win = sender ? BrowserWindow.fromWebContents(sender) : mainWin;
        // const userId = getUserIdFromToken(token);
        mainWin.webContents.send('process-book-for-vectordb', {
          bookKey: book.id,
          filePath: book.path,
          maxLength: 250,
          userId,
        });
        ipcMain.once('book-for-vectordb-processed', (event, result) => {
          console.log('Book processed:', result);
          if (result && result.length > 0) {
            result.forEach((element) => {
              this.collection.add(element);
            });
          }
        });
      } catch (e) {
        console.log(e);
      }
    }
  }

  async addNodeToVecterDB(store, noteObj, token) {
    if (!this.collection) return;
    const userId = getUserIdFromToken(token);
    if (userId < 0) return;
    const key = store.get(`useChroma_${userId}`);
    if (!key) return;

    let doc = noteObj.title || '';
    if (noteObj.cards) {
      if (noteObj.cards[0]) doc += noteObj.cards[0].text || '';
      if (noteObj.cards[1]) doc += noteObj.cards[1].text || '';
      if (noteObj.cards[2]) doc += noteObj.cards[2].text || '';
    }
    if (doc.length < 10) return;
    const { id } = noteObj;
    const { type } = noteObj;
    console.log('add note to vector...');
    try {
      this.collection.add({
        ids: [id.toString()],
        metadatas: [{ source: 'note', type, userId: String(userId) }],
        documents: [doc],
      });
      console.log('add note to vector...done');
    } catch (e) {
      console.log(e.message ? e.message : e);
    }
  }

  async addPDFToVecterDB(store, bookKey, filePath, maxLength, token) {
    if (!this.collection) return;
    const userId = getUserIdFromToken(token);
    if (userId < 0) return;
    const key = store.get(`useChroma_${userId}`);
    if (!key) return;

    // Variable to track the current page index
    let currentPageIndex = 0;
    // Function to render and parse each page
    function render_page(pageData) {
      currentPageIndex++; // Increment the page index
      const render_options = {
        normalizeWhitespace: false, // Replace all occurrences of whitespace with standard spaces (0x20)
        disableCombineTextItems: false, // Combine same line TextItem's into single line
      };

      return pageData
        .getTextContent(render_options)
        .then(function (textContent) {
          let lastY;
          let text = '';
          for (const item of textContent.items) {
            if (lastY == item.transform[5] || !lastY) {
              text += item.str;
            } else {
              text += `\n${item.str}`;
            }
            lastY = item.transform[5];
          }

          this.collection.add({
            ids: [`${bookKey}|${currentPageIndex}|0`],
            metadatas: [
              {
                source: 'pdf',

                sourceKey: String(bookKey),

                userId: String(userId),
              },
            ],
            documents: [text],
          });
          console.log('add note to vector...done');

          return text;
        });
    }

    // Options for pdf-parse, specifying the custom page render function
    const pdfOptions = {
      pagerender: render_page,
    };

    // Function to parse the PDF
    async function parsePdfByPages(filePath) {
      const dataBuffer = fs.readFileSync(filePath);

      try {
        const data = await pdf(dataBuffer, pdfOptions);
        // Output the parsed text
        console.log(data.text); // `data.text` now contains the text of the entire PDF, page by page
      } catch (error) {
        console.error('Error parsing PDF:', error);
      }
    }
    parsePdfByPages(filePath);
  }

  async getBooksByQuery(store, query, token) {
    const books = [];
    const userId = getUserIdFromToken(token);
    const r = await this.collection.query({
      nResults: 10,
      where: {
        $and: [
          { source: { $eq: 'epub' } },
          { userId: { $eq: String(userId) } },
        ],
      },
      queryTexts: [query],
    });
    if (r && r.ids && r.ids.length > 0) {
      r.ids.forEach((id) => {
        // ids: [`${bookKey}|${cfi}`],
        const pos = id.indexOf('|');
        const newId = pos > 0 ? id.substring(0, pos) : id;
        const b = getBookById(newId);
        if (b) books.push(b);
      });
    }
    const r2 = await this.collection.query({
      nResults: 10,
      where: {
        $and: [{ source: { $eq: 'pdf' } }, { userId: { $eq: String(userId) } }],
      },
      queryTexts: [query],
    });
    if (r2 && r2.ids && r2.ids.length > 0) {
      r2.ids.forEach((id) => {
        //  ids: [`${bookKey}|${pageNum}|${index}`],
        const pos = id.indexOf('|');
        const newId = pos > 0 ? id.substring(0, pos) : id;
        const b = getBookById(newId);
        if (b) books.push(b);
      });
    }
    return books;
  }

  async getBookContentByQuery(store, bookKey, bookType, query, token) {
    try {
      const hits = [];
      if (query.indexOf(' ') > 0 && this.collection) {
        const userId = getUserIdFromToken(token);
        const r = await this.collection.query({
          nResults: 10,
          where: {
            $or: [
              { source: { $eq: bookType } },
              { sourceKey: { $eq: String(bookKey) } },
              { userId: { $eq: String(userId) } },
            ],
          },
          queryTexts: [query],
        });
        if (r && r.ids && r.ids.length > 0) {
          r.ids.forEach((id, index) => {
            console.log(` id :  ${typeof id}  id : ${id}   `);
            const nid = String(id);
            if (bookType === 'epub') {
              //  ids: [`${String(bookKey)}|${cfi}`],
              const pos = nid.indexOf('|');
              hits.push({
                data: {
                  bookKey: nid.substring(0, pos),
                  cfi: nid.substring(pos + 1),
                  excerpt:
                    typeof r.documents[index].length === 'undefined'
                      ? r.documents[index]
                      : r.documents[index][0],
                  type: bookType,
                },
              });
            } else if (bookType === 'pdf') {
              //  ids: [`${bookKey}|${pageNum}|${index}`],
              const pos = nid.indexOf('|');
              const pos2 = nid.indexOf('|', pos + 2);

              hits.push({
                data: {
                  id: nid.substring(0, pos),
                  position: {
                    boundingRect: {
                      x1: 0,
                      y1: 0,
                      x2: 10,
                      y2: 10,
                      width: 10,
                      height: 10,
                      pageNumber: parseInt(nid.substring(pos + 1, pos2)),
                    },
                    rects: [
                      {
                        x1: 0,
                        y1: 0,
                        x2: 10,
                        y2: 10,
                        width: 10,
                        height: 10,
                      },
                    ],
                    pageNumber: parseInt(nid.substring(pos + 1, pos2)),
                  },
                  content: {
                    text:
                      typeof r.documents[index].length === 'undefined'
                        ? r.documents[index]
                        : r.documents[index][0],
                  },
                  type: bookType,
                },
              });
            }
          });
        }
      }
      return hits;
    } catch (e) {
      console.log(e.message ? e.message : e);
      return [];
    }
  }

  async getMessageByQuery(store, query, token) {
    const messages = [];
    const userId = getUserIdFromToken(token);
    const r = await this.collection.query({
      nResults: 10,
      where: {
        $and: [
          { source: { $eq: 'message' } },
          { userId: { $eq: String(userId) } },
        ],
      },
      queryTexts: [query],
    });
    if (r && r.ids && r.ids.length > 0) {
      r.ids.forEach((id) => {
        const b = getMessageById(id, token);
        if (b) messages.push(b);
      });
    }
    return messages;
  }

  async getNotesByQuery(store, query, tag, star, page, limit, token) {
    const notes = [];
    const userId = getUserIdFromToken(token);
    const r = await this.collection.query({
      nResults: 10,
      where: {
        $and: [
          { source: { $eq: 'note' } },
          { userId: { $eq: String(userId) } },
        ],
      },
      queryTexts: [query],
    });
    if (r && r.ids && r.ids.length > 0) {
      r.ids.forEach((id) => {
        const b = getNoteById(id, token);
        if (b) notes.push(b);
      });
    }
    return notes;
  }
}

// Export the singleton instance
const instance = new ChromaManager();
// Object.freeze(instance);

export default instance;



// async function addEbookToVecterDB(bookKey, filePath, token) {
//   if (!filePath) return;
//   const userId = getUserIdFromToken(token);
//   if (userId < 0) return;
//   const book = ePub(filePath);
//   book.ready
//     .then(() => {
//       book.locations.generate(1600); // Optional, for pagination
//       book.spine.each((section) => {
//         section
//           .load(book.load.bind(book))
//           .then((contents) => {
//             const parser = new DOMParser();
//             const doc = parser.parseFromString(contents, 'text/html');
//             const paragraphs = doc.querySelectorAll('p');
//             const pArray = [...paragraphs];
//             let record = '';
//             let cfi = '';
//             for (let i = 0; i < pArray.length; i++) {
//               const c = pArray[i].textContent;
//               if (!record)
//                 cfi = section.cfiFromElement(pArray[i], section.cfiBase);
//               record = `${record} ${c}`;
//               if (record.length < 200) continue;
//               collection.add({
//                 ids: [`${bookKey}|${cfi}`],
//                 metadatas: [{ source: 'epub', sourceKey: bookKey, userId }],
//                 documents: [record],
//               });
//               record = '';
//               cfi = '';
//             }
//           })
//           .catch(Error);
//       });
//     })
//     .catch(Error);
// }
