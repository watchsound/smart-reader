import { mapToPredefinedColor } from '../../../commons/utils/CommonLangUtil';

/**
 *
 * input data is from:
 *  {
  "data": [
    {
      "original-sentence": "it were very hot.",
      "correct-sentence": "It was very hot.",
      "Explanation": [
        {
          "type": "Subject-Verb Agreement",
          "original": "were",
          "start-pos": 3,
          "end-pos": 7,
          "corrected": "was",
          "explain": "The subject 'it' is singular, so the verb should also be singular. 'Were' is used with plural subjects, while 'was' is used with singular subjects."
        },
      ]
    }
  ]
}

output data is :
  {
    start: 0,
    end: 14,
    tag: "tagA",
    color: "rgb(179, 245, 66)",
  },

 */
export const getGrammarOriginalToAnnotation = (jsonData) => {
  const annotations = [];
  let globalPos = 1;
  jsonData.data.forEach((item, index) => {
    item.explanations.forEach((item2, index2) => {
      const annotation = {
        id: `${index}-${index2}`,
        color: mapToPredefinedColor(item2.type),
        end: parseInt(item2['end-pos-in-original'], 10) + globalPos,
        start: parseInt(item2['start-pos-in-original'], 10) + globalPos,
      };
      annotations.push(annotation);
    });
    globalPos += item['original-sentence'].length + 1;
  });
  return annotations;
};

export const getGrammarCorrectedToAnnotation = (jsonData) => {
  const annotations = [];
  let globalPos = 0;
  jsonData.data.forEach((item, index) => {
    item.explanations.forEach((item2, index2) => {
      const annotation = {
        id: `${index}-${index2}`,
        color: mapToPredefinedColor(item2.type),
        end: parseInt(item2['end-pos-in-corrected'], 10) + globalPos,
        start: parseInt(item2['start-pos-in-corrected'], 10) + globalPos,
      };
      annotations.push(annotation);
    });
    globalPos += item['correct-sentence'].length + 1;
  });
  return annotations;
};
