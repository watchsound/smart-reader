// /* eslint-disable prettier/prettier */
// import { Token } from 'markdown-it';
// import { StudyMode } from '../../commons/model/DataTypes';
import { v4 as uuid } from 'uuid';
import { StudyMode } from '../../commons/model/DataTypes';

/**
 * data structure:
 * 'word_colors' ==>  { levels: { [name] : id } ,  colors: { [id]: color },  words: { [id]: [word]} }
 * @param {*} md
 * @param {*} options {store}
 */
function WordFrequencyColorPlugin(md, options) {
  const { store, uuid2changed } = options;

  const { levels, colors, words } = store.get('word_colors') || {
    levels: null,
    colors: null,
    words: null,
  };

  md.core.ruler.push('color_keywords', (state) => {
    // uuid2changed.clear();
    const mode = store.get('study_mode');
    if (mode !== StudyMode.Language || !colors || !words) return;

    const levelIds = Object.keys(words);

    for (let idx = 0; idx < state.tokens.length; idx++) {
      const token = state.tokens[idx];

      if (token.type === 'inline' && token.children) {
        for (let i = 0; i < token.children.length; i++) {
          const child = token.children[i];
          if (child.type === 'text') {
            const { content } = child;
            levelIds.forEach((levelId) => {
              const wordList = words[levelId];
              const color = colors[levelId];
              wordList.forEach((keyword) => {
                const regex = new RegExp(
                  `(?:^|[^a-zA-Z0-9_])(${keyword})(?:[^a-zA-Z0-9_]|$)`,
                  'gi',
                );
                if (regex.test(content)) {
                  const uid = uuid();
                  uuid2changed.set(
                    uid,
                    `<span style="color:${color}"> ${keyword} </span>`,
                  );
                  child.content = content.replace(regex, uid);
                }
              });
            });
          }
        }
      }
    }
  });
}

export default WordFrequencyColorPlugin;
