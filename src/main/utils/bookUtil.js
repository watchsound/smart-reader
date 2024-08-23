/* eslint-disable no-console */
/* eslint-disable no-case-declarations */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable no-inner-declarations */
/* eslint-disable promise/catch-or-return */
/* eslint-disable promise/always-return */
import { isElectron } from 'react-device-detect';
import toast from 'react-hot-toast';
import fs, { createReadStream } from 'fs';
import mammoth from 'mammoth';
import crypto from 'crypto';
import os from 'os';
import axios from 'axios';
import { v4 as uuid } from 'uuid';
import path from 'path';
import { Buffer } from 'buffer';
import AdmZip from 'adm-zip';
import fs_extra from 'fs-extra';
import Epub, { Book } from 'epubjs';
import JSON5 from 'json5';
import jsdom from 'jsdom';
import pdf from 'pdf-parse/lib/pdf-parse';

import { dialog } from 'electron';
import { throws } from 'assert';
import BookModel from '../../commons/model/Book';
import { createImage } from '../db/ImageManager';

/**
 * // Example usage:
FileHasher.createMD5('example.txt')
  .then((hash) => {
    console.log(`Hash: ${hash}`);
  })
  .catch((err) => {
    console.error(err);
  });
 */
class BookUtil {
  static getImageExtension(mimeType) {
    switch (mimeType) {
      case 'image/jpeg':
        return 'jpg';
      case 'image/png':
        return 'png';
      case 'image/gif':
        return 'gif';
      default:
        return 'img';
    }
  }

  static async convertHtmlToEpub(title, author, htmlContent, outputPath) {
    const tempDir = path.join(
      global.shared.storageLocation,
      'epub-gen-temp',
      `epub-gen-temp-${uuid()}`,
    );

    // Ensure the temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const options = {
      title: title || 'Converted EPUB',
      author: author || 'Anonymous',
      output: outputPath,
      content: [
        {
          title: 'Chapter 1',
          data: htmlContent,
        },
      ],
      tempDir, // Specify custom temp directory
    };
    const Epub = require('epub-gen');
    new Epub(options).promise
      .then(() => {
        fs.rmdirSync(tempDir);
      })
      .catch((err) => {
        fs.rmdirSync(tempDir);
      });
  }

  static async imageToBase64(filePath) {
    try {
      // Create a complete and valid path to the file
      const absolutePath = path.resolve(filePath);

      // Read the file into a buffer
      console.log(` filePath = ${filePath}`);
      console.log(` filePath = ${filePath}`);
      const data = await fs.promises.readFile(absolutePath);

      // Convert the buffer to a Base64 string
      const base64Image = data.toString('base64');

      // Optionally, prepend a data URI scheme
      const dataUri = `data:image/png;base64,${base64Image}`;

      console.log(dataUri);
      return dataUri; // You might want to return it if you need to use the data URI elsewhere
    } catch (err) {
      console.error('Error reading the file:', err);
      return '';
    }
  }

  // static getPDFCover(file) {
  //   return new Promise((resolve, reject) => {
  //     const fileSize = file.byteLength / 1024 / 1024;
  //     setTimeout(
  //       () => {
  //         resolve('');
  //       },
  //       Math.ceil(fileSize / 10) * 1000,
  //     );
  //     async function t() {
  //       const pdfjsLib = await import('pdfjs-dist');
  //       pdfjsLib
  //         .getDocument({ data: file })
  //         .promise.then((pdfDoc) => {
  //           pdfDoc.getPage(1).then((page) => {
  //             const scale = 1.5;
  //             const viewport = page.getViewport({
  //               scale,
  //             });
  //             const canvas = document.getElementById('the-canvas');
  //             const context = canvas.getContext('2d');
  //             canvas.height =
  //               viewport.height ||
  //               viewport.viewBox[3]; /* viewport.height is NaN */
  //             canvas.width =
  //               viewport.width ||
  //               viewport.viewBox[2]; /* viewport.width is also NaN */
  //             const task = page.render({
  //               canvasContext: context,
  //               viewport,
  //             });
  //             task.promise.then(async () => {
  //               const cover = canvas.toDataURL('image/jpeg');
  //               resolve(cover);
  //             });
  //           });
  //         })
  //         .catch((err) => {
  //           resolve('');
  //         });
  //     }
  //     t();
  //   });
  // }

  static createMD5(filePath) {
    return new Promise((resolve, reject) => {
      const getHash = (content) => {
        const hash = crypto.createHash('md5');
        const data = hash.update(content, 'utf-8');
        const genHash = data.digest('hex');
        return genHash;
      };

      const myReadStream = createReadStream(filePath);
      let rContents = ''; // to hold the read contents;

      myReadStream.on('data', function (chunk) {
        rContents += chunk;
      });

      myReadStream.on('error', function (err) {
        reject(err);
      });

      myReadStream.on('end', function () {
        // Calling the getHash() function to get the hash
        const content = getHash(rContents);
        // console.log(`Content : ${rContents}`);
        console.log(`Hash : ${content}`);
        resolve(content);
      });
    });
  }

  static async importJsonTextFile(mainWindow, isJson) {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
          { name: 'TXT', extensions: ['txt'] },
          { name: 'JSON', extensions: ['json'] },
        ],
      });
      if (result.filePaths) {
        const filePath = result.filePaths[0];
        const data = fs.readFileSync(filePath, 'utf8');
        if (data) {
          return isJson ? JSON5.parse(data) : data;
        }
      }
      return null;
    } catch (err) {
      console.error('Error saving file:', err);
      return null;
    }
  }

  static async handleDocFile(inputPath, dataPath, keyInStorage) {
    const that = this;
    try {
      const extension = 'pdf';
      const libre = require('libreoffice-convert');
      libre.convertAsync = require('util').promisify(libre.convert);

      if (!fs.existsSync(path.join(dataPath, 'book'))) {
        fs.mkdirSync(path.join(dataPath, 'book'), { recursive: true });
      }
      const outputPath = path.join(
        dataPath,
        `book`,
        `${keyInStorage}.${extension}`,
      );
      const docxBuf = fs.readFileSync(inputPath);
      const pdfBuf = await libre.convertAsync(docxBuf, extension, undefined);
      fs.writeFileSync(outputPath, pdfBuf);
      return extension;
    } catch (e) {
      // libreoffice is not installed.
      const imageDir = path.join(
        global.shared.storageLocation,
        'cached-images',
      );

      // Ensure the temp directory exists
      if (!fs.existsSync(imageDir)) {
        fs.mkdirSync(imageDir, { recursive: true });
      }

      try {
        if (!fs.existsSync(path.join(dataPath, 'book'))) {
          fs.mkdirSync(path.join(dataPath, 'book'), { recursive: true });
        }

        const extension = 'epub';
        const outputPath = path.join(
          dataPath,
          `book`,
          `${keyInStorage}.${extension}`,
        );
        console.log(inputPath);
        const options = {
          convertImage: mammoth.images.imgElement((element) => {
            return element.read('base64').then((imageBuffer) => {
              const imageFileName = `${uuid()}.${that.getImageExtension(element.contentType)}`;
              const imageFilePath = path.join(imageDir, imageFileName);
              if (!fs.existsSync(imageDir)) {
                fs.mkdirSync(imageDir, { recursive: true });
              }

              fs.writeFileSync(imageFilePath, imageBuffer, 'base64');
              return {
                src: imageFilePath,
              };
            });
          }),
        };
        // const ab = fs.readFileSync(inputPath);
        const { value } = await mammoth.convertToHtml(
          { path: inputPath },
          options,
        );
        // const { value } = await mammoth.convertToHtml({ arrayBuffer: ab });
        this.convertHtmlToEpub('', '', value, outputPath);
        return extension;
      } catch (error) {
        console.error('Error reading DOCX file:', error);
        return '';
      }
    }
  }

  static async importBookFromFile(mainWindow, libreOfficeInstalled) {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
          { name: 'EPUB', extensions: ['epub'] },
          { name: 'PDF', extensions: ['pdf'] },
          {
            name: 'Word',
            extensions: libreOfficeInstalled ? ['doc', 'docx'] : ['docx'],
          },
          { name: 'R9-Data', extensions: ['r9'] },
        ],
      });

      // console.log(result.canceled);
      console.log(result.filePaths);

      if (result.filePaths) {
        const filePath = result.filePaths[0];
        if (!filePath) return null;
        let extension = filePath.split('.').reverse()[0].toLocaleLowerCase();
        const keyInStorage = uuid();
        let dataPath = await global.shared.store.get('storageLocation');
        dataPath = dataPath || global.shared.storageLocation;

        if (!fs.existsSync(path.join(dataPath, 'book'))) {
          fs.mkdirSync(path.join(dataPath, 'book'), { recursive: true });
        }
        const outPath = path.join(
          dataPath,
          `book`,
          `${keyInStorage}.${extension}`,
        );
        // fs.mkdirSync(path.dirname(outPath), { recursive: true });
        const data = fs.readFileSync(filePath);
        fs.writeFileSync(outPath, data);
        console.log(`File saved successfully! ${outPath}`);

        // convert doc to pdf
        if (extension.startsWith('doc')) {
          const ext = this.handleDocFile(outPath, dataPath, keyInStorage);
          if (ext) extension = ext;
        }
        // unzip file
        let cover = '';
        if (extension === 'r9') {
          const zip = new AdmZip(outPath);
          const outPathZip = path.join(dataPath, `book`, `${keyInStorage}`);
          if (!fs.existsSync(outPathZip)) {
            fs.mkdirSync(outPathZip, { recursive: true });
          }
          zip.extractAllTo(outPathZip);
          const coverPath = path.join(
            dataPath,
            `book`,
            `${keyInStorage}`,
            'r9icon.png',
          );
          cover = await this.imageToBase64(coverPath);
          if (cover) {
            // const imageId = uuid();
            const r = await createImage(cover);
            cover = r.id;
          }
        }

        const book = await BookUtil.createBookModel(
          keyInStorage,
          filePath,
          outPath,
          data,
        );
        if (cover) book.cover = cover;
        return book;
      }
      console.error('No file paths returned');
      return null;
    } catch (err) {
      console.error('Error saving file:', err);
      return null;
    }
  }

  static async importImageBase64FromFile(mainWindow) {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
          { name: 'PNG', extensions: ['png'] },
          { name: 'JPEG', extensions: ['jpeg'] },
          { name: 'JPG', extensions: ['jpg'] },
        ],
      });

      if (result.filePaths) {
        const filePath = result.filePaths[0];
        if (!filePath) return null;
        const cover = await this.imageToBase64(filePath);
        return cover;
      }
      console.error('No file paths returned');
      return null;
    } catch (err) {
      console.error('Error saving file:', err);
      return null;
    }
  }

  static async importBookFromServer(book) {
    try {
      const { serverUrl } = global.shared;
      const response = await axios.get(`${serverUrl}/download/${book.id}`, {
        responseType: 'arraybuffer', // Ensures the data is received as a binary buffer
      });
      // console.log('Status:', response.status);
      // console.log('Headers:', response.headers);
      // console.log('Data:', response.data);
      // console.log('Data:', JSON.stringify(response.data));
      let extension = book.filePath.substring(
        book.filePath.lastIndexOf('.') + 1,
      );

      const keyInStorage = uuid();
      let dataPath = await global.shared.store.get('storageLocation');
      dataPath = dataPath || global.shared.storageLocation;
      if (!fs.existsSync(path.join(dataPath, 'book'))) {
        fs.mkdirSync(path.join(dataPath, 'book'), { recursive: true });
      }

      const outPath = path.join(
        dataPath,
        `book`,
        `${keyInStorage}.${extension}`,
      );

      fs.writeFileSync(outPath, response.data);
      console.log(`File saved successfully! ${outPath}`);

      // convert doc to pdf
      if (extension.startsWith('doc')) {
        const ext = this.handleDocFile(outPath, dataPath, keyInStorage);
        if (ext) extension = ext;
      }

      if (extension === 'r9') {
        const zip = new AdmZip(outPath);
        const outPathZip = path.join(dataPath, `book`, `${keyInStorage}`);
        if (!fs.existsSync(outPathZip)) {
          fs.mkdirSync(outPathZip, { recursive: true });
        }
        zip.extractAllTo(outPathZip);
      }
      // unzip file
      let cover = '';
      if (book.coverImage) {
        // const imageId = uuid();
        const r = await createImage(
          `data:image/jpeg;base64,${book.coverImage}`,
        );
        cover = r.id;
      } else if (extension === 'r9') {
        const coverDir = path.join(dataPath, `book`, `${keyInStorage}`);
        if (!fs.existsSync(coverDir)) {
          fs.mkdirSync(coverDir, { recursive: true });
        }
        const coverPath = path.join(
          dataPath,
          `book`,
          `${keyInStorage}`,
          'r9icon.png',
        );
        cover = await this.imageToBase64(coverPath);
        if (cover) {
          // const imageId = uuid();
          const r = await createImage(cover);
          cover = r.id;
        }
      }
      const createdAt = `${new Date().getTime()}`;
      const size = BookUtil.getFileSize(outPath);
      const newBook = {
        id: -1,
        keyInStorage,
        idFromServer: book.id,
        name: book.name,
        subtitle: '',
        author:
          book.author && book.author.length > 0 ? book.author[0].name : '',
        description: book.description,
        cover,
        format: extension,
        publisher:
          book.publishers && book.publishers.length > 0
            ? book.publishers[0].name
            : '',
        category: '',
        size,
        path: outPath,
        charset: '',
        createdAt,
        favorite: 0,
      };
      return newBook;
    } catch (err) {
      console.error('Error saving file:', err);
      return null;
    }
  }

  static getFileSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const fileSizeInBytes = stats.size;
      console.log('Size in bytes:', fileSizeInBytes);
      const fileSizeInKBytes = fileSizeInBytes / 1024;
      console.log('Size in kb:', fileSizeInKBytes);
      return fileSizeInKBytes;
    } catch (err) {
      console.log(err.message);
      return -1;
    }
  }

  static async createBookModel(keyInStorage, filePath, outPath, data) {
    const md5 = await BookUtil.createMD5(outPath);
    const fileName = path.basename(filePath);
    const extension = fileName.split('.').reverse()[0].toLocaleLowerCase();
    const bookName = fileName.substr(0, fileName.length - extension.length - 1);
    const fileSize = BookUtil.getFileSize(filePath);
    const result = await BookUtil.generateBook(
      keyInStorage,
      bookName,
      extension,
      md5,
      fileSize,
      outPath, // || URL.createObjectURL(file),
      data,
    );
    return result;
  }

  static async addBook(storageLocation, id, buffer) {
    console.log(`in addBook isElectron = ${isElectron}`);
    if (isElectron) {
      // const fs = window.require('fs');
      // const path = window.require('path');
      const dataPath = await global.shared.store.get('storageLocation');
      return new Promise((resolve, reject) => {
        try {
          if (!fs.existsSync(path.join(dataPath, 'book'))) {
            fs.mkdirSync(path.join(dataPath, 'book'));
          }
          fs.writeFileSync(
            path.join(dataPath, 'book', id),
            Buffer.from(buffer),
          );
          resolve();
        } catch (error) {
          reject();
          throw error;
        }
      });
    }
    console.log(`setItem id = ${id}`);
    return global.shared.store.set(id, buffer);
  }

  static async deleteBook(id) {
    if (isElectron) {
      const dataPath = await global.shared.store.get('storageLocation');
      return new Promise((resolve, reject) => {
        try {
          fs_extra.remove(path.join(dataPath, `book`, id), (err) => {
            if (err) throw err;
            resolve();
          });
        } catch (e) {
          reject();
        }
      });
    }
    return global.shared.store.delete(id);
  }

  static isBookExist(id, bookPath = '') {
    return new Promise((resolve, reject) => {
      if (isElectron) {
        //  const fs = window.require('fs');
        //  const path = window.require('path');
        async function t() {
          const dataPath = await global.shared.store.get('storageLocation');
          const abookPath = path.join(dataPath, `book`, id);
          if (
            (bookPath && fs.existsSync(bookPath)) ||
            fs.existsSync(abookPath)
          ) {
            resolve(true);
          } else {
            resolve(false);
          }
        }
        t();
      } else {
        global.shared.store.get(id).then((result) => {
          if (result) {
            resolve(true);
          } else {
            resolve(false);
          }
        });
      }
    });
  }

  static fetchBook(id, isArrayBuffer = false, bookPath = '') {
    if (isElectron) {
      return new Promise((resolve, reject) => {
        async function t() {
          // const fs = window.require('fs');
          // const path = window.require('path');
          const b0 = await global.shared.store.get('storageLocation');
          const abookPath = path.join(b0, `book`, id);
          let data;
          if (bookPath && fs.existsSync(bookPath)) {
            data = fs.readFileSync(bookPath);
          } else if (fs.existsSync(abookPath)) {
            data = fs.readFileSync(abookPath);
          } else {
            resolve(false);
          }

          const blobTemp = new Blob([data]);
          const fileTemp = new File([blobTemp], 'data', {
            lastModified: new Date().getTime(),
            type: blobTemp.type,
          });
          if (isArrayBuffer) {
            resolve(new Uint8Array(data).buffer);
          } else {
            resolve(fileTemp);
          }
        }
        t();
      });
    }
    return global.shared.store.get(id);
  }

  static FetchAllBooks(Books) {
    return Books.map((item) => {
      return this.fetchBook(item.id, true, item.path);
    });
  }

  static getBookUrl(book) {
    const ref = book.format.toLowerCase();
    return `/${ref}/${book.id}`;
  }

  static getPDFUrl(book) {
    if (isElectron) {
      // const path = window.require('path');
      // const { ipcRenderer } = window.require('electron');
      global.shared.store.set('pdfPath', book.path);
      const dirname = window.electron.ipcRenderer.sendSync('dirname', 'ping');
      const pdfLocation =
        document.URL.indexOf('localhost') > -1
          ? 'http://localhost:3000/'
          : `file://${path.join(
              dirname,
              './build',
              'lib',
              'pdf',
              'web',
              'viewer.html',
            )}`;
      const url = `${
        window.navigator.platform.indexOf('Win') > -1
          ? 'lib/pdf/web/'
          : 'lib\\pdf\\web\\'
      }viewer.html?file=${book.id}`;
      return document.URL.indexOf('localhost') > -1
        ? pdfLocation + url
        : `${pdfLocation}?file=${book.id}`;
    }
    return `./lib/pdf/web/viewer.html?file=${book.id}`;
  }

  static async generateBook(
    keyInStorage,
    bookName,
    extension,
    md5,
    size,
    path,
    file_content,
  ) {
    async function pdfHandle() {
      if (extension !== 'pdf') return null;
      const dataBuffer = fs.readFileSync(path);
      const r = await pdf(dataBuffer);
      return r;
      // cover = await that.getPDFCover(file_content);
      // if (cover.indexOf('image') === -1) {
      //   cover = '';
      // }
    }
    const pdfMeta = await pdfHandle();

    return new Promise((resolve, reject) => {
      let cover = '';
      let name;
      let author;
      let publisher;
      let description;
      let charset;
      [name, author, description, publisher, charset] = [
        bookName,
        'Unknown Author',
        '',
        '',
        '',
      ];
      let metadata;
      let rendition;
      const that = this;

      switch (extension) {
        case 'pdf':
          if (pdfMeta && pdfMeta.info) {
            name = pdfMeta.info.Title ? pdfMeta.info.Title : bookName;
            author = pdfMeta.info.Author
              ? pdfMeta.info.Author
              : 'Unknown Author';
            publisher =
              pdfMeta.info && pdfMeta.info.Producer
                ? pdfMeta.info.Producer
                : '';
            description = '';
            cover = '';
          }

          break;
        case 'epub':
          // const jsdom = require('jsdom');
          const dom = new jsdom.JSDOM(file_content);
          name = dom.window.document.querySelector('dc\\:title')
            ? dom.window.document.querySelector('dc\\:title').textContent
            : bookName;
          author = dom.window.document.querySelector('dc\\:creator')
            ? dom.window.document.querySelector('dc\\:creator').textContent
            : 'Unknown Author';
          publisher = dom.window.document.querySelector('dc\\:publisher')
            ? dom.window.document.querySelector('dc\\:publisher').textContent
            : '';
          description = dom.window.document.querySelector('dc\\:description')
            ? dom.window.document.querySelector('dc\\:description').textContent
            : '';
          cover = dom.window.document.querySelector('dc\\:cover')
            ? dom.window.document.querySelector('dc\\:cover').textContent
            : '';

          if (cover.indexOf('image') === -1) {
            cover = '';
          }
          break;
        default:
          break;
      }
      const format = extension; // .toUpperCase();
      const createdAt = `${new Date().getTime()}`;
      resolve(
        new BookModel(
          -1,
          keyInStorage ?? uuid(),
          -1,
          bookName,
          name,
          author,
          description,
          cover,
          format,
          publisher,
          '',
          size,
          path,
          charset,
          createdAt,
          -1,
        ),
      );
    });
  }
}
export default BookUtil;
