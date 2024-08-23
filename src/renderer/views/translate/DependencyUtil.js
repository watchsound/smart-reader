import { mapToPredefinedColor } from '../../../commons/utils/CommonLangUtil';

/**
 *  jsonData:
 *  "tokens": [
    {
      "text": "I",
      "pos": "PRP",
      "ner": "O",
      "dependency": "nsubj",
      "index": 1,
      "head": "like"
    },
    {
      "text": "like",
      "pos": "VBP",
      "ner": "O",
      "dependency": "ROOT",
      "index": 2,
      "head": "ROOT"
    },
 *
 *
 *  return data :
 *
 * {
  tokens: [
    { text: 'Mary', tag: 'NNP' },
    { text: 'was', tag: 'VBD' },
    { text: 'born', tag: 'VBN' },
    { text: 'in', tag: 'IN' },
    { text: 'Paris', tag: 'NNP' },
    { text: '.', tag: '.' }
  ],
  dependencies: [
    { from: 1, to: 0, label: 'nsubj:pass' },
    { from: 1, to: 2, label: 'aux:pass' },
    { from: 2, to: 4, label: 'obl' },
    { from: 4, to: 3, label: 'case' },
    { from: 4, to: 5, label: 'punct' }
  ]
}
 *
 */
export const getTokenAndDependencies = (jsonData) => {
  const tokens = [];
  function findIndex(text) {
    const item = jsonData.tokens.filter((item) => item.text === text);
    return item && item.length > 0 ? item[0].index : -1;
  }
  jsonData.tokens.forEach((item) => {
    tokens.push({
      index: item.index,
      text: item.text,
      tag: item.pos,
      color: mapToPredefinedColor(item.pos),
    });
  });
  const dependencies = [];
  jsonData.tokens.forEach((item) => {
    dependencies.push({
      from: item.index,
      to: findIndex(item.head),
      label: item.dependency,
    });
  });
  const coreferences = [];
  jsonData.coreferences.forEach((references) => {
    const refIndex = [];
    coreferences.push(refIndex);
    references.mentions.forEach((mention) => {
      for (let i = mention.start_index; i <= mention.end_index; i++) {
        refIndex.push(i);
      }
    });
  });
  return { t: tokens, d: dependencies, cf: coreferences };
};

export const xx = (jsonData) => {};
