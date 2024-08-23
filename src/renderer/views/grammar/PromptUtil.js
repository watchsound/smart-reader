export const getLangSystemMessage = `
 You are a language expert.
`;

export const getGrammarCorrectionExtraPrompt = (originalSentence, correctedSentence, original, corrected, explain, language) => {
  return `
      This is original sentence:

      ${originalSentence}

      This is sentence with grammar error fixed:

      ${correctedSentence}

      This is one error:  ${original}
      This is correction: ${corrected}
      This is a concise explanation: ${explain}

      In order to better understand and master this knowledge point and avoid making similar mistakes in the future, please give a more detailed explanation and provide more examples. Your reply should be no less than 100 words.
      NOTE: you must use ${language} to compose response.
      `;
};

export const getGrammarCorrectionPrompt = (sentence, language) => {
  return `
Given a paragraph, please check the grammar, make all corrections, and explain them.
then response with JSON object. Here is the sample JSON output.
{
  "data" :[
    {
      "original-sentence" : "XXX",
	    "correct-sentence": "XXX"
	    "explanations" :
	      [
	        {
	          "type" : "",
	          "original": "",
            "start-pos-in-original": 0,
            "end-pos-in-original":  5.
	          "corrected": "",
            "start-pos-in-corrected": 0,
            "end-pos-in-corrected":  5.
	          "explain": "",
            "similar-examples": ""
	        },

	      ]
    },

  ]
}

NOTE: Both attribute values  of "explain" and "similar-examples" should use ${language} to express.

# Here is the paragraph

${sentence}
`;
};
