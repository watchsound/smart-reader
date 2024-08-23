import Markdownit from 'markdown-it';
import katex from 'katex';
import tm from 'markdown-it-texmath';
import markdowncolor from 'markdown-it-color';
import hljs from 'highlight.js';

import KeywordsColorPlugin from './KeywordsColorPlugin';
import WordFrequencyColorPlugin from './WordFrequencyColorPlugin';

class MarkdownManager {
  constructor(store) {
    if (MarkdownManager.instance) {
      return MarkdownManager.instance;
    }

    this.uuid2changed = new Map();
    this.md = new Markdownit({
      html: true,
      // linkify: true,
      // typographer: true,
      // breaks: true,
      quotes: '“”‘’',
      highlight(str, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return `<pre class="hljs"><code>${
              hljs.highlight(lang, str, true).value
            }</code></pre>`;
          } catch (__) {}
        }
        return `<pre class="hljs"><code>${this.md.utils.escapeHtml(str)}</code></pre>`;
      },
    });
    MarkdownManager.instance = this;
  }

  setupMarkdown(store) {
    this.md.use(markdowncolor, { inline: true });
    // md.use(KeywordsLinkPlugin, {
    //   store,
    // });
    this.md.use(KeywordsColorPlugin, {
      store,
      uuid2changed: this.uuid2changed,
    });
    this.md.use(WordFrequencyColorPlugin, {
      store,
      uuid2changed: this.uuid2changed,
    });

    this.md.use(tm, {
      engine: katex, // require('katex'),
      delimiters: ['dollars', 'brackets', 'beg_end', 'julia', 'gitlab'],
      katexOptions: { macros: { '\\RR': '\\mathbb{R}' } },
    });
  }

  markdown2html(marks) {
    this.uuid2changed.clear();
    let r = this.md.render(marks);
    this.uuid2changed.forEach((value, key, map) => {
      r = r.replace(new RegExp(key, 'g'), value);
    });
    return r;
  }
}

// Export the singleton instance
const instance = new MarkdownManager();
// Object.freeze(instance);

export default instance;



// md.linkify.add('@', {
//   validate: function (text, pos, self) {
//     const tail = text.slice(pos);

//     if (!self.re.twitter) {
//       self.re.twitter =  new RegExp(
//         '^([a-zA-Z0-9_]){1,15}(?!_)(?=$|' + self.re.src_ZPCc + ')'
//       );
//     }
//     if (self.re.twitter.test(tail)) {
//       // Linkifier allows punctuation chars before prefix,
//       // but we additionally disable `@` ("@@mention" is invalid)
//       if (pos >= 2 && tail[pos - 2] === '@') {
//         return false;
//       }
//       return tail.match(self.re.twitter)[0].length;
//     }
//     return 0;
//   },
//   normalize: function (match) {
//     match.url = 'https://twitter.com/' + match.url.replace(/^@/, '');
//   }
// });
