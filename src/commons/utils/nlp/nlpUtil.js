import natural from 'natural';

/**
 * // Example usage
const sentence = "The quick brown foxes were jumping over the lazy dogs";
const result = stemSentence(sentence);
console.log(result); // Output: { the: 'the', quick: 'quick', brown: 'brown', fox: 'foxes', were: 'were', jump: 'jumping', over: 'over', the: 'the', lazi: 'lazy', dog: 'dogs' }

 * @param {*} sentence
 * @returns
 */
export const stemSentence = (sentence) => {
  // Initialize the tokenizer and stemmer
  const tokenizer = new natural.WordTokenizer();
  const stemmer = natural.PorterStemmer;

  // Tokenize the sentence
  const tokens = tokenizer.tokenize(sentence);

  // Create a map of {stem -> original word}
  const stemMap = {};
  tokens.forEach((word) => {
    const stemmedWord = stemmer.stem(word);
    stemMap[stemmedWord] = word;
  });

  return stemMap;
};
