import { mapToPredefinedColor } from '../../../commons/utils/CommonLangUtil';
/**
 *   {
          id: el.id,
          text: el.innerHtml,
          top: absoluteTop,
          left: absoluteLeft,
          el,
        };
 * */
export const getWord2Positions = (tokens) => {
  const positions = {};
  tokens.forEach((word) => {
    const key = word.text;
    if (!positions[key]) {
      positions[key] = [];
    }
    positions[key].push(word);
  });
  return positions;
};

/**
 *   dependenciesNLP: [
    { from: 1, to: 0, label: 'nsubj:pass' },
    { from: 1, to: 2, label: 'aux:pass' },
    { from: 2, to: 4, label: 'obl' },
    { from: 4, to: 3, label: 'case' },
    { from: 4, to: 5, label: 'punct' }
  ]
 */
const createAnimationOrder0 = (
  dependenciesNLP,
  result,
  usedFlag,
  curToIndex,
) => {
  if (usedFlag.includes(curToIndex)) return;
  usedFlag.push(curToIndex);
  function getFromToByTo(to) {
    return dependenciesNLP.filter((item) => item.to === to);
  }
  function getFromToByFrom(from) {
    return dependenciesNLP.filter((item) => item.from === from);
  }
  const r = getFromToByTo(curToIndex);
  if (r.length > 0) {
    result.push(r);
    r.forEach((item) => {
      createAnimationOrder0(dependenciesNLP, result, usedFlag, item.from);
    });
  }
};
/**
 *
 * @param {*} dependenciesNLP
 * @returns an array, each item in array is itself array of node ids
 */
export const createAnimationOrder = (dependenciesNLP) => {
  const result = [];
  const rootId = -1;
  const usedFlag = [];
  createAnimationOrder0(dependenciesNLP, result, usedFlag, rootId);
  return result;
};

/**
 *    tokensNLP: [
    { text: 'Mary', tag: 'NNP' },
    { text: 'was', tag: 'VBD' },
    { text: 'born', tag: 'VBN' },
    { text: 'in', tag: 'IN' },
    { text: 'Paris', tag: 'NNP' },
    { text: '.', tag: '.' }
  ],
  dependenciesNLP: [
    { from: 1, to: 0, label: 'nsubj:pass' },
    { from: 1, to: 2, label: 'aux:pass' },
    { from: 2, to: 4, label: 'obl' },
    { from: 4, to: 3, label: 'case' },
    { from: 4, to: 5, label: 'punct' }
  ]
 */
export const createSentenceAnimation = (
  parentLoc,
  tokens,
  tokensNLP,
  dependenciesNLP,
  coreferences,
  entryEffect,
  onFinishCallback,
) => {
  const animationOrders = createAnimationOrder(dependenciesNLP);
  if (animationOrders.length === 0) return;
  function getTokenById(id) {
    return id === -1 ? null : tokens[id - 1];
    // const r = tokens.filter((token) => token.id === id);
    // return r.length > 0 ? r[0] : null;
  }
  function getCorefColor(index) {
    for (let i = 0; i < coreferences.length; i++) {
      if (coreferences[i].indexOf(index) >= 0)
        return mapToPredefinedColor(`id_${i}`);
    }
    return null;
  }
  if (animationOrders[0].length === 1) {
    const first = animationOrders.shift();
    animationOrders[0].push(...first);
  }

  tokens.forEach((word, index) => {
    word.el.style.opacity = 0.01;
  });

  animationOrders.forEach((itemList, index1) => {
    setTimeout(() => {
      itemList.forEach((item, index2) => {
        const t = getTokenById(item.from);
        if (t) {
          t.el.classList.add(entryEffect);
          const c = getCorefColor(item.from);
          if (c) {
            t.el.style.backgroundColor = c;
          }
        }
      });
    }, index1 * 1200);
  });
};

export const createParagraphTransition = (
  parentLocFrom,
  tokensFrom,
  parentLocTo,
  tokensTo,
  onFinishCallback,
) => {
  // const tokensToCopy = [...tokensTo];
  let flag = true;
  const positions1 = getWord2Positions(tokensFrom);
  const positions2 = getWord2Positions(tokensTo);

  const difY = parentLocTo.top - parentLocFrom.top;
  const difX = parentLocTo.left - parentLocFrom.left;

  const fromPosKeys = Object.keys(positions1);
  fromPosKeys.forEach((key, posIndex) => {
    if (positions2[key]) {
      positions1[key].forEach((word1, index) => {
        const word2 = positions2[key][index];
        if (word2) {
          // const word2Pos = tokensToCopy.indexOf(word2);
          // if (word2Pos > -1) {
          //   // only splice array when item is found
          //   tokensToCopy.splice(word2Pos, 1); // 2nd parameter means remove one item only
          // }

          const deltaX = word2.left - word1.left + difX;
          const deltaY = word2.top - word1.top + difY;

          requestAnimationFrame(() => {
            word1.el.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            // word2.el.classList.add('hidden');

            word1.el.addEventListener('transitionend', () => {
              word1.el.style.transform = '';
              //  word2.el.classList.remove('hidden');
              if (flag && onFinishCallback) {
                flag = false;
                onFinishCallback();
              }
            });
          });
        }
      });
    }
    // if (posIndex === fromPosKeys.length - 1) {
    //   tokensToCopy.forEach((w) => {
    //     w.el.classList.remove('hidden');
    //   });
    //   if (onFinishCallback) onFinishCallback();
    // }
  });
};

/**
 * // Example usage:
const inputHtml = `
<div>
    This is a <b>test</b> with some $$a^2 + b^2 = c^2$$ math.
    <p>Another paragraph.</p>
</div>`;

const outputHtml = wrapWordsInHtml(inputHtml);
console.log(outputHtml);
 */
export function wrapWordsInHtml(html, className) {
  // Regex to match HTML tags, MathJax content, and HTML entities
  const tagOrMathJaxOrEntityRegex = /(<[^>]+>)|(\$\$[^$]*\$\$)|(&[a-zA-Z0-9]+;)/g;

  // Split the input HTML content by the regex to separate tags, entities, and text content
  const parts = html.split(tagOrMathJaxOrEntityRegex);

  // Initialize a counter for span ids
  let spanIdCounter = 0;

  // Function to wrap words with <span> and add id
  function wrapText(text) {
    return text.replace(/(\b\w+\b|[.,;?!])/g, function (match) {
      return `<span id="_xid_${spanIdCounter++}" class="${className}">${match}</span>`;
    });
  }

  // Process each part, wrapping words only in text parts
  const result = parts
    .map((part) => {
      if (!part) return '';
      if (part.match(tagOrMathJaxOrEntityRegex)) {
        // If part is an HTML tag, MathJax content, or HTML entity, return as is
        return part;
      }
      // If part is text content, wrap words with <span> and add id
      return wrapText(part);
    })
    .join('');

  return result;
}


export function wrapTokensToHtml(tokens, className) {
  // Initialize a counter for span ids
  let spanIdCounter = 0;

  // Function to wrap words with <span> and add id
  function wrapToken(token) {
    spanIdCounter += spanIdCounter;
    if (typeof token.id === 'undefined')
      return `<span id="_xid_${spanIdCounter}" class="${className}">${token.text}</span>`;
    return `<span id="_xid_${token.index}" class="${className}">${token.text}</span>`;
  }
  const result = tokens
    .map((part) => {
      if (!part) return '';
      return wrapToken(part);
    })
    .join(' ');

  return result;
}
