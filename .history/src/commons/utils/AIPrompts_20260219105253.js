/* eslint-disable no-await-in-loop */
// import { KeyboardReturnSharp } from '@mui/icons-material';

import { ReaderLevel } from '../model/DataTypes';

const langstudyNoun = `Please enclose all nouns with \${}. For example: I love apple -> I love \${apple}.`;
const langstudyVerb = `Please enclose all vrebs with \${}. For example: I love apple -> I \${love} apple.`;
const langstudyPreposition = `Please enclose all prepositions with \${}. For example: He is happy with the meat in his mouth. -> He is happy \${with} the meat \${in} his mouth.`;
const langstudyCommon = `Please annotate all phrases and fixed collocation of prepositions in the text using \${}. For example: He is happy with the meat in his mouth. -> He is \${happy with} the meat in his mouth.`;
const langstudyStructure = `Please annotate all key syntactic structures that form the skeleton of sentences in the text using \${}, such as conjunctions and adverbs. For example: The car not only is economical but also feels good to drive. ->  The car \${not only} is economical \${but also} feels good to drive.`;

/* eslint-disable prettier/prettier */
export const multipleChoiceOne = `
Please generate 4 multiple-choice quiz questions based on the following paragraph, with each question having 4 answer options (labeled A, B, C, and D). Only one option per question should be correct. Ensure the questions cover key details, facts, or concepts from the paragraph and vary in difficulty. Return the questions and answers in JSON format.

Here's the paragraph:

###
`;

export const multipleChoiceTwo = `
###

Here's the sample json format:
{
   quiz : [
     {
       'question' : '',
       'options'  : {
         'optionA'  : '',
         'optionB'  : '',
         'optionB'  : '',
         'optionC'  : '',
        },
       'answer' : ''
     },
     {
       'question' : '',
       'options'  : {
         'optionA'  : '',
         'optionB'  : '',
         'optionB'  : '',
         'optionC'  : '',
        },
       'answer' : ''
     }
   ]
}

Thank you.
`;

const langstudyAnnotateIndex = (type) => {
  if (type === 'Noun') return 0;
  if (type === 'Verb') return 1;
  if (type === 'Prepositions') return 2;
  if (type === 'Collocations') return 3;
  return 4;
};

const langstudyAnnotatePrompt = (type) => {
  if (type === 'Noun') return langstudyNoun;
  if (type === 'Verb') return langstudyVerb;
  if (type === 'Prepositions') return langstudyPreposition;
  if (type === 'Collocations') return langstudyCommon;
  return langstudyStructure;
};

const langstudy5wPrompt = `Please provide only concise keywords for 'Who, What, When, Where, and Why' of every single sentences of paragraph. return data in json format:  {data: [{ sentenceIndex: 0, who: "xx", what: "xx", when: "xx', where: "xx", why: "xx"}]}:`;
const langstudyGrammarCheckPrompt = `As a language expert, your task is to annotate and correct grammar mistakes. Please Identify errors by marking the problematic segment with \${XXX}[index], here XXX is problematic segment. you also provide correction for each of them at the end. For instance:
Microwave ovens is generally more costlier than common ovens.  -> Microwave ovens \${is}[0] generally more \${costlier}[1] than common ovens.
[0] Correction: "is" should be "are"
[1] Correction: "costlier" should be "costly"`;

const langstudyComparisonExercise = (originalSentence, mySentence) => {
  return `
  I try to learn english by rewriting the original sentence.
# this is original sentence:

${originalSentence}

# this is what i wrote:

${mySentence}

# you are a language expert, Please analyze my grammatical errors or any unnatural language usage and design some exercises with examples (not strategies) to help me correct these mistakes.
Response with JSON format, here is an example (there are many types, here we use "Capitalization" and "Article Usage" just for demo purpose):

{
 "issues": [
  {
    "type": "Capitalization",
    "explain": "The word \\"When\\" should be capitalized at the beginning of the sentence."
  },
   {
    "type": "Article Usage",
    "explain": "\\"the element\\" should be used consistently."
  },
 ],

 "exercises": [
  {
    "type": "Capitalization",
    "original": "When the color of the sky is changed, the atmosphere looks different.",
    "rewriteExercise": "Change the verb \\"is changed\\" to match the correct tense and context.",
    "example": "When the color of the sky is set to change, the atmosphere looks different."
  },
  {
    "type": "Article Usage",
    "original": "Element creates an interesting effect in the scene.",
    "rewriteExercise": "Add or remove articles where necessary to correct the sentence.",
    "example": "The element creates an interesting effect in the scene."
  }
 ]
}
  `;
};

const langstudyComparisonExerciseMore = (exercise) => {
  return `
  You are language expert. please provide three more exercise examples about ${exercise.type}.
  Please response in JSON format, here is a sample response:

  {
   "data" : [
     ${JSON.stringify(exercise)}
   ]
  }

  `;
};

const suitableForElementary =
  'Please response using words that elementary school students can understand';

const suitableForMiddle =
  'Please response using vocabulary suitable for middle and high school students.';

const getSystemMessageForSummary = () => {
  const message = [];
  message.push('You are an expert only speak in Json format.');
  message.push(
    'For the given article, you will write a short title and a summary, ',
  );
  message.push('also provide three keywords or tags for article.  ');
  message.push(
    'The Json format is defined as: {"title": , "summary": , "keywords":, } ',
  );
  message.push('also provide three keywords or tags for article.  ');
  return message.join(' ');
};
const getUserMessageForSummary = (savedTags) => {
  const message = [];
  message.push('Please write title, summary and keywords for this article. ');
  if (savedTags && savedTags.length > 0) {
    message.push(`please prioritize selecting keywords in [${savedTags}], `);
  }
  message.push(
    'answer is in a Json format: {"title": , "summary": , "keywords":, } ',
  );
  message.push('\n#####\n');
  return message.join(' ');
};

const getSummaryChatHistoryPrompt =  (content, savedTags) => {
  return [
    {
      role: 'system',
      content: getSystemMessageForSummary(),
    },
    {
      role: 'user',
      content: `${getUserMessageForSummary(savedTags)}   ${content}`,
    },
  ];
  // const r = createChatDescription.choices[0].message?.content;
  // console.log(r);
  // return JSON5.parse(stripJsonWrap(r || ''));
};


const getSystemMessageMindMap = () => {
  const message = [];
  message.push('You are an expert for logic reasoning.');
  message.push(
    'You return *only* a mindmap using markdown,  each node including root node starts with "-".',
  );
  message.push(
    'You use keyword+ "|" + simple description for each node of mindmap.',
  );
  return message.join(' ');
};
const getUserMessageMindMap = () => {
  const message = [];
  message.push(
    'please return *only* a mindmap using markdown for the following paragraph',
  );
  message.push(
    '(use keyword+ "|" + simple description for every item of mindmap, starting with "-") \n\n',
  );
  return message.join(' ');
};

const getMindMapChatHistoryPrompt = (content) => {
  return [
    {
      role: 'system',
      content: getSystemMessageMindMap(),
    },
    {
      role: 'user',
      content: getUserMessageMindMap() + content,
    },
  ];
};

const getQuizChatHistoryPrompt = (content) => {
  return [
    {
      role: 'system',
      content: 'You only use json data for answering the questions.',
    },
    {
      role: 'user',
      content: multipleChoiceOne + content + multipleChoiceTwo,
    },
  ];
};

const getUserMessageForCategory = (existingCategoryStr, content) => {
  const message = [];
  message.push('We have some existing categories:\n');
  message.push(existingCategoryStr);
  message.push('\n\n');
  message.push(
    `Please classify this text into the most fitting category from the provided list. If the text doesn't clearly fit any existing categories, feel free to create a new category or subcategory that better captures the essence of the content.
Here is the text to classify:`,
  );
  message.push('\n#####\n');
  message.push(content);
  message.push('\n#####\n');
  message.push('Please only reply with your answer, no other text.');
  return message.join(' ');
};

// const callChatGptByImage0 = async (openai, model, content, image64) => {
//   // "data:image/jpeg;base64,{base64_image}"
//   try {
//     const createChatDescription = await openai.chat.completions.create({
//       model,
//       messages: [
//         {
//           role: 'user',
//           content: [
//             {
//               type: 'text',
//               text: content,
//             },
//             {
//               type: 'image_url',
//               image_url: {
//                 url: image64,
//               },
//             },
//           ],
//         },
//       ],
//     });

//     const r = createChatDescription.choices[0].message?.content;
//     console.log(r);
//     return r;
//   } catch (e) {
//     return '';
//   }
// };

const extractJsonPrompt = (content) => {
  return `
   Extract and return the JSON data embedded in the following text. Please ensure the response contains only the JSON object itself, starting with the opening curly brace and ending with the closing curly brace, with no additional characters or formatting.

    ${content}
  `;
};

const createReaderLevelPrompt = (readerLevel) => {
  if (readerLevel === ReaderLevel.Elementary) return suitableForElementary;
  if (readerLevel === ReaderLevel.Middle) return suitableForMiddle;
  return '';
};

const createRewriteHtmlCodeForWordFrequencyJsonPrompt = (wordFrequency) => {
  return `
Rewrite the paragraphs on the HTML page using only the top ${wordFrequency} most frequently used words.
Adjust the sentence structures and expressions accordingly while preserving the original HTML tags and attributes.
Ensure that the rewritten text maintains the same meaning and context as the original one.

Provide the modified result in JSON format: {"modified-html": ''}

Here is the html code snippet need to be rewrite:

`;
};

const createRewriteHtmlCodeForElementarySchoolPrompt = `
Please simplify the text content of this HTML page for an elementary school student, keeping the HTML tags intact. Provide only the modified HTML code without any additional explanation or commentary.
`;

const createVocabularyPrompt = (vocabulary, readerLevel) => {
  const level = createReaderLevelPrompt(readerLevel);
  return `
    Provide a word definition, its root, and craft a sentence utilizing the word. ${level}
    Please format your response in JSON as follows: { "definition": "xxx", "root": "xx", "example": "xx" }

    ${vocabulary}
  `;
};

const mapToNewJsonSchema =   (schemaName, jsonData, schema) => {
  const prompt = ` Does given jsonData describes ${schemaName} ? if so, please translate jsonData to use new JSON schema.

      Here is jsonData:
      ${jsonData}

      here is new JSON schema:
      ${schema}

      NOTE: Please ensure the response contains only the JSON object itself, starting with the opening curly brace and ending with the closing curly brace, with no additional characters or formatting..
  `;
  console.log(prompt);
  return prompt; //
};

const createMoodBoardLayoutPrompt = (width, height, content) => {
  return `
    A moodboard is a visual tool used across creative fields like graphic design, interior design, fashion, and marketing.
    I have a set of cards that need to be arranged on an ${width} * ${height} moodboard. Here are the layout requirements:

Cards can have different shapes and sizes, more text and bigger size for each card.
Cards should occupy most empty space of moodboard.
Cards with similar meanings or themes should be grouped closely together.
The layout should visually represent these relationships.
Each card should have a background color to enhance the aesthetic appeal.
Below is the content for the cards:

${content}

Please provide the layout information for each card in JSON format. Here's a sample JSON format: { "layout": [ { "cardIndex": Index, "color": Color, "x": X-coordinate, "y": Y-coordinate, "width": Width, "height": Height } ] }
  `;
};

const createDecomposeParagraphPrompt = (content) => {
  return `
    I need to divide a paragraph into meaningful sections and assign each section to a card for a slide presentation. Each section should be of a moderate length, not too long, and represent a clear topic for easy understanding.

    You can use simple HTML tags to format and decorate the content for better visual presentation:
    - Use <strong> or <b> for emphasis on key terms
    - Use <em> or <i> for italics
    - Use <ul><li>...</li></ul> for bullet lists
    - Use <ol><li>...</li></ol> for numbered lists
    - Use <table><tr><td>...</td></tr></table> for simple tables
    - Use <h3> or <h4> for section headings within a card
    - Use <br> for line breaks
    - Use <span style="color:#xxx"> for colored text highlights

    Also suggest a layout theme for the presentation based on the content type. Available themes:
    - "spiral": Good for exploratory or expanding topics
    - "linear": Good for sequential, step-by-step content
    - "grid": Good for comparisons, lists, or structured data
    - "circular": Good for cyclical processes or related concepts
    - "depth_zoom": Good for drilling into details or hierarchical content
    - "storytelling": Good for narratives with beginning, middle, end
    - "random_walk": Good for creative or diverse topics

    Please provide the breakdown in JSON format like this:
    {
      'layout_theme': 'storytelling',
      'data': [
        {'card_index': 0, 'content': '<h4>Title</h4><p>Description...</p>'},
        {'card_index': 1, 'content': '<ul><li>Point 1</li><li>Point 2</li></ul>'}
      ]
    }

    ${content}
  `;
};

export default getSummaryChatHistoryPrompt;
export {
  getMindMapChatHistoryPrompt,
  getQuizChatHistoryPrompt,
  getUserMessageForCategory,
  extractJsonPrompt,
  createMoodBoardLayoutPrompt,
  mapToNewJsonSchema,
  createVocabularyPrompt,
  createReaderLevelPrompt,
  langstudyAnnotatePrompt,
  langstudy5wPrompt,
  langstudyAnnotateIndex,
  langstudyGrammarCheckPrompt,
  createRewriteHtmlCodeForElementarySchoolPrompt,
  langstudyComparisonExercise,
  langstudyComparisonExerciseMore,
  createRewriteHtmlCodeForWordFrequencyJsonPrompt,
  createDecomposeParagraphPrompt,
};
