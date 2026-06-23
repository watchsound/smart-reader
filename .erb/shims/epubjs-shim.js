/**
 * Shim that guarantees `import Epub from 'epubjs'` resolves to the callable
 * ePub function. Works around an interop bug between react-reader's compiled
 * `(0, epubjs.default)(url, ...)` call site and whatever webpack/DLL produces
 * for the epubjs module in this build.
 *
 * Webpack alias: epubjs$ → this file
 */
const ePub = require('epubjs/src/epub').default;
const Book = require('epubjs/src/book').default;
const EpubCFI = require('epubjs/src/epubcfi').default;
const Rendition = require('epubjs/src/rendition').default;
const Contents = require('epubjs/src/contents').default;
const Layout = require('epubjs/src/layout').default;

if (typeof ePub !== 'function') {
  throw new Error(
    '[epubjs-shim] ePub is not a function — epubjs/src/epub.default resolved to ' +
      typeof ePub,
  );
}

module.exports = ePub;
module.exports.default = ePub;
module.exports.Book = Book;
module.exports.EpubCFI = EpubCFI;
module.exports.Rendition = Rendition;
module.exports.Contents = Contents;
module.exports.Layout = Layout;
