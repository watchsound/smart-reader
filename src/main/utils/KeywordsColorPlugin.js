// /* eslint-disable prettier/prettier */
// import { Token } from 'markdown-it';
// import { StudyMode } from '../../commons/model/DataTypes';
import { v4 as uuid } from 'uuid';
import { StudyMode } from '../../commons/model/DataTypes';
import { stemSentence } from '../../commons/utils/nlp/nlpUtil';
/**
 * data structure:
 * 'word_colors' ==>  { levels: { [name] : id } ,  colors: { [id]: color },  words: { [id]: [word]} }
 * @param {*} md
 * @param {*} options {store}
 */
function KeywordsColorPlugin(md, options) {
  const { store, uuid2changed } = options;
  let keywords = [];

  const refreshKeywords = () => {
    const m = store.get('study_mode') || StudyMode.General;
    keywords = store.get(`keywords_${m}`) || [];
  };

  md.core.ruler.push('bold_keywords', (state) => {
    refreshKeywords();
    if (keywords.length === 0) return;

    for (let idx = 0; idx < state.tokens.length; idx++) {
      const token = state.tokens[idx];

      if (token.type === 'inline' && token.children) {
        for (let i = 0; i < token.children.length; i++) {
          const child = token.children[i];
          if (child.type === 'text') {
            const { content } = child;
            const stem2word = stemSentence(content);
            keywords.forEach((keyword) => {
              const word = stem2word[keyword];
              if (!word) return;
              const regex = new RegExp(
                `(?:^|[^a-zA-Z0-9_])(${word})(?:[^a-zA-Z0-9_]|$)`,
                'gi',
              );
              // const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
              if (regex.test(content)) {
                const uid = uuid();
                uuid2changed.set(uid, `<strong> ${word} </strong>`);
                child.content = content.replace(regex, uid);
              }
            });
          }
        }
      }
    }
  });
}

export default KeywordsColorPlugin;

// function KeywordsColorPlugin(md, options) {
//   const { store } = options;

//   const { levels, colors, words } = store.get('word_colors') || {
//     levels: null,
//     colors: null,
//     words: null,
//   };

//   // Token replacing function
//   const highlightKeywordTokens = (tokens, idx) => {
//     const token = tokens[idx];
//     const { content } = token;

//     if (!colors || !words) return;

//     const levelIds = Object.keys(words);

//     levelIds.forEach((levelId) => {
//       const wordList = words[levelId];
//       wordList.forEach((keyword) => {
//         const regex = new RegExp(`\\b${keyword}\\b`, 'g');
//         if (regex.test(token.content)) {
//           token.type = 'html_inline'; // Using inline HTML
//           token.content = `<span style="color: red;">${keyword}</span>`;

//           // Replace the original content with highlighted version
//           const beforeKeyword = content.slice(0, content.indexOf(keyword));
//           const afterKeyword = content.slice(
//             content.indexOf(keyword) + keyword.length,
//           );

//           // Handling text before keyword
//           if (beforeKeyword) {
//             tokens.splice(idx, 0, new Token('text', '', 0));
//             tokens[idx].content = beforeKeyword;
//           }

//           // Add the styled keyword
//           tokens[idx + 1] = new  Token('html_inline', '', 0);
//           tokens[idx + 1].content =
//             `<span style="color: red;">${keyword}</span>`;

//           // Handling text after keyword
//           if (afterKeyword) {
//             tokens.splice(idx + 2, 0, new  Token('text', '', 0));
//             tokens[idx + 2].content = afterKeyword;
//           }
//         }
//       });
//     });
//   };

//   // Hook into 'inline' rule
//   md.core.ruler.push('highlight_red_keywords', (state) => {
//     const mode = store.get('study_mode');
//     if (mode !== StudyMode.Language) return;
//     state.tokens.forEach((blockToken) => {
//       if (blockToken.type === 'inline' && blockToken.children) {
//         blockToken.children.forEach((token, idx) => {
//           if (token.type === 'text') {
//             highlightKeywordTokens(blockToken.children, idx);
//           }
//         });
//       }
//     });
//   });
// }

// export default KeywordsColorPlugin;
