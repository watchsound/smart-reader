/* eslint-disable no-await-in-loop */
// import { KeyboardReturnSharp } from '@mui/icons-material';

import { ReaderLevel } from '../model/DataTypes';

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

const langstudy5wPrompt = `Please provide only concise keywords for 'Who, What, When, Where, and Why' of every single sentences of paragraph. return data in json format:  {data: [{ sentenceIndex: 0, who: "xx", what: "xx", when: "xx', where: "xx", why: "xx"}]}:`;

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
  message.push('You are an expert at structured outlines.');
  message.push(
    'Return ONLY a markdown indented bullet list. Every line begins with "- " (dash + space). Use 2 spaces per indent level.',
  );
  message.push(
    'Each bullet is "keyword | one-line description". No numbered lists, no headers (#), no preamble, no explanation, no code fences.',
  );
  message.push(
    'If the input cannot be turned into a mindmap, return an empty response.',
  );
  return message.join(' ');
};
const getUserMessageMindMap = () => {
  const message = [];
  message.push(
    'Return ONLY a markdown mindmap of the following text. Format rules:',
  );
  message.push(
    '- every line begins with "- " (dash space); no "1." numbered list, no "#" headers, no code fences',
  );
  message.push(
    '- indent children with 2 extra spaces',
  );
  message.push(
    '- each bullet is keyword + " | " + short description',
  );
  message.push('\nText:\n\n');
  return message.join('\n');
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
    I need to divide a paragraph into meaningful sections and assign each section to a card for a slide presentation. Each section should be of moderate length, not too long, and represent a clear topic.

    You can use simple HTML tags for visual formatting:
    - <strong> or <b> for emphasis on key terms
    - <em> or <i> for italics
    - <ul><li>...</li></ul> for bullet lists
    - <ol><li>...</li></ol> for numbered lists
    - <table><tr><td>...</td></tr></table> for simple tables
    - <h3> or <h4> for section headings within a card
    - <br> for line breaks
    - <span style="color:#xxx"> for colored text highlights

    Suggest a layout theme for the presentation. Available themes:
    - "spiral": exploratory or expanding topics
    - "linear": sequential, step-by-step content
    - "grid": comparisons, lists, structured data
    - "circular": cyclical processes or related concepts
    - "depth_zoom": drilling into details / hierarchical content
    - "storytelling": narratives with beginning, middle, end
    - "random_walk": creative or diverse topics
    - "helix": vertical, ascending/descending journeys
    - "mobius": looped or paradoxical ideas
    - "exploded_text": fragments converging into a whole
    - "z_tunnel": forward-motion / drilling-into-the-future feel
    - "page_turn_book": book-like, chapter-by-chapter

    For richer presentations you MAY add these OPTIONAL fields. Omit any field if you are uncertain:
    - top-level "global_mood": one of "calm", "dramatic", "tech", "playful", "scholarly", "cinematic"
    - top-level "background": one of "none", "gradient_flow", "starfield_parallax", "dust_motes", "ink_wash", "cinema_letterbox"
    - per-slide "role": one of "opening", "key_concept", "example", "quote", "data", "punchline", "closing"
    - per-slide "typography": one of "none", "typewriter", "word_by_word_fade", "scramble_decode", "blur_in", "letters_from_edges", "ink_write", "glitch_chromatic", "neon_glow_pulse"
    - per-slide "transition": one of "default", "depth_blur", "dissolve", "ink_bleed", "shatter_rebuild"
    - per-slide "background": overrides the global background for this one slide

    Return JSON like:
    {
      'layout_theme': 'storytelling',
      'global_mood': 'dramatic',
      'background': 'starfield_parallax',
      'data': [
        {'card_index': 0, 'content': '<h4>Title</h4>', 'role': 'opening', 'typography': 'blur_in', 'transition': 'default'},
        {'card_index': 1, 'content': '<ul><li>Point 1</li></ul>', 'role': 'key_concept', 'typography': 'word_by_word_fade', 'transition': 'depth_blur'}
      ]
    }

    Only include the optional fields when they meaningfully enhance the content. Omit them otherwise.

    ${content}
  `;
};

/**
 * Creates a prompt for generating vocabulary-constrained summaries
 * The AI must use words from the original text + learning vocabulary
 * Returns JSON with summary words and their source locations
 *
 * @param {string} text - The selected text to summarize
 * @param {string[]} vocabularyWords - User's learning vocabulary words
 * @returns {string} - The prompt for AI
 */
const createSmartSummaryPrompt = (text, vocabularyWords = []) => {
  const vocabList = vocabularyWords.length > 0
    ? `\n\nLearning Vocabulary (MUST include at least 2-3 of these words if they fit naturally):\n${vocabularyWords.join(', ')}`
    : '';

  return `You are a study assistant helping students learn through visual word association.

TASK: Create a concise summary (1-2 sentences, max 20 words) of the following text.

CRITICAL RULES:
1. Use ONLY words that appear in the original text OR from the Learning Vocabulary list
2. Do NOT add any new words, synonyms, or paraphrases
3. The summary must be grammatically correct
4. Prioritize including Learning Vocabulary words when they fit naturally
${vocabList}

TEXT TO SUMMARIZE:
"""
${text}
"""

Respond in JSON format:
{
  "summary": "Your summary here using only words from the source",
  "words": ["array", "of", "each", "word", "in", "summary"],
  "vocabularyUsed": ["words", "from", "learning", "vocabulary", "that", "were", "used"]
}

Remember: Every word in your summary MUST exist in the original text or the Learning Vocabulary list. No exceptions.`;
};

/**
 * Creates a prompt for extracting entities and relationships to build a mindmap
 * @param {string} text - The source text to analyze
 * @returns {string} - The prompt for the AI
 */
const createMindmapExtractionPrompt = (text) => {
  return `You are a knowledge extraction assistant helping students understand text through visual mindmaps.

TASK: Extract key entities and their relationships from the following text to create a mindmap structure.

RULES:
1. Identify the MAIN CONCEPT (central topic) - this becomes the root node
2. Extract KEY ENTITIES: people, concepts, places, events, objects (max 8 entities)
3. Identify RELATIONSHIPS between entities (verbs, prepositions that connect them)
4. Each entity text should be SHORT (1-3 words, use the exact words from text when possible)
5. Assign entity types: "person", "concept", "place", "event", "object"
6. Structure should be hierarchical: root -> level1 -> level2 (max 2 levels deep)

TEXT TO ANALYZE:
"""
${text}
"""

Respond in JSON format:
{
  "title": "Brief title for the mindmap",
  "root": {
    "id": "root",
    "text": "Main concept (1-3 words)",
    "type": "concept"
  },
  "nodes": [
    { "id": "n1", "text": "Entity text", "type": "person|concept|place|event|object", "level": 1, "sourcePhrase": "original phrase from text" },
    { "id": "n2", "text": "Entity text", "type": "concept", "level": 1, "sourcePhrase": "original phrase" },
    { "id": "n3", "text": "Sub-entity", "type": "event", "level": 2, "parentId": "n1", "sourcePhrase": "original phrase" }
  ],
  "edges": [
    { "from": "root", "to": "n1", "relation": "verb or preposition connecting them" },
    { "from": "root", "to": "n2", "relation": "relationship word" },
    { "from": "n1", "to": "n3", "relation": "relationship word" }
  ]
}

IMPORTANT:
- Keep it simple: 4-8 nodes total (not counting root)
- Use EXACT words from the source text for "sourcePhrase"
- Relations should be single words or short phrases (1-3 words)
- Level 1 nodes connect to root, Level 2 nodes connect to their parentId`;
};

/**
 * Create prompt for entity resolution / coreference resolution
 * Identifies entities and all their references in the text
 */
const createEntityResolutionPrompt = (text) => {
  return `You are a coreference resolution assistant helping students understand entity references in text.

TASK: Identify all entities mentioned in the text and group together all references to the same entity.

RULES:
1. An ENTITY is a person, organization, place, concept, or thing that is referred to multiple times
2. A REFERENCE is any word or phrase that refers to an entity (names, pronouns, descriptions)
3. Group all references that refer to the SAME entity together
4. Use EXACT text from the source - match the exact words/phrases as they appear
5. Include the character position (start index) of each reference for precise matching
6. Only include entities that have 2+ references (single mentions are not useful for linking)
7. Assign each entity a type: "person", "organization", "place", "concept", "thing"

TEXT TO ANALYZE:
"""
${text}
"""

Respond in JSON format:
{
  "entities": [
    {
      "id": "e1",
      "canonicalName": "Main name for this entity",
      "type": "person|organization|place|concept|thing",
      "references": [
        { "text": "exact text from source", "startIndex": 0 },
        { "text": "another reference", "startIndex": 45 },
        { "text": "pronoun or description", "startIndex": 89 }
      ]
    },
    {
      "id": "e2",
      "canonicalName": "Another entity",
      "type": "concept",
      "references": [
        { "text": "first mention", "startIndex": 20 },
        { "text": "second mention", "startIndex": 120 }
      ]
    }
  ]
}

EXAMPLE:
Text: "Einstein published his theory in 1905. The physicist later won the Nobel Prize. He changed physics forever."

Result:
{
  "entities": [
    {
      "id": "e1",
      "canonicalName": "Albert Einstein",
      "type": "person",
      "references": [
        { "text": "Einstein", "startIndex": 0 },
        { "text": "his", "startIndex": 19 },
        { "text": "The physicist", "startIndex": 39 },
        { "text": "He", "startIndex": 81 }
      ]
    }
  ]
}

IMPORTANT:
- Only include entities with 2+ references
- Use EXACT text matches from the source
- startIndex must be accurate character positions
- Maximum 6 entities to avoid visual clutter`;
};

/**
 * NLP Annotation Prompt - Tokenization, POS tagging, NER, dependency parsing
 * Used by TranslateSkill for linguistic analysis
 * @param {string} sentence - The sentence to analyze
 * @returns {string} - The prompt for NLP analysis
 */
const getNLPAnnotationPrompt = (sentence) => {
  return `
please finish initial step of NLP :  tokenize sentence and assign POS tag for each token. also analysis Named Entity, DEPENDENCY, COREFERENCE.  Response in JSON data. Here is an example:

{
  "sentence": "I voted for Trump as he was smart.",
  "tokens": [
    {
      "text": "I",
      "pos": "PRP",
      "ner": "O",
      "dependency": "nsubj",
      "index": 1,
      "head": "voted"
    },
    {
      "text": "voted",
      "pos": "VBD",
      "ner": "O",
      "dependency": "ROOT",
      "index": 2,
      "head": "ROOT"
    },
    {
      "text": "for",
      "pos": "IN",
      "ner": "O",
      "dependency": "prep",
      "index": 3,
      "head": "voted"
    },
    {
      "text": "Trump",
      "pos": "NNP",
      "ner": "PERSON",
      "dependency": "pobj",
      "index": 4,
      "head": "for"
    },
    {
      "text": "as",
      "pos": "IN",
      "ner": "O",
      "dependency": "mark",
      "index": 5,
      "head": "smart"
    },
    {
      "text": "he",
      "pos": "PRP",
      "ner": "O",
      "dependency": "nsubj",
      "index": 6,
      "head": "smart"
    },
    {
      "text": "was",
      "pos": "VBD",
      "ner": "O",
      "dependency": "cop",
      "index": 7,
      "head": "smart"
    },
    {
      "text": "smart",
      "pos": "JJ",
      "ner": "O",
      "dependency": "advcl",
      "index": 8,
      "head": "voted"
    },
    {
      "text": ".",
      "pos": ".",
      "ner": "O",
      "dependency": "punct",
      "index": 9,
      "head": "voted"
    }
  ],
  "coreferences": [
    {
      "coref_chain": 1,
      "mentions": [
        {
          "text": "Trump",
          "start_index": 4,
          "end_index": 4,
          "type": "proper"
        },
        {
          "text": "he",
          "start_index": 6,
          "end_index": 6,
          "type": "pronoun"
        }
      ]
    }
  ]
}

Here is the sentence for analysis:

${sentence}

  `;
};

/**
 * Translation Prompt - Multi-step translation learning (Chinese/Japanese to English)
 * Used by TranslateSkill for structured translation guidance
 * @param {string} sentence - The sentence to translate
 * @param {string} language - Source language ('Chinese' or 'Japanese')
 * @returns {string} - The prompt for translation
 */
const getTranslatePrompt = (sentence, language) => {
  return `

You are a language expert, adept at teaching students how to translate from ${language} to English.

The difference between ${language} and English expression lies in that ${language} often emphasize an entire scene for a single sentence, where the elements within the scene lack prominent logic relationships. In contrast, English states a fact in a single sentence, unfolding from the core scalfold of actor-action-result.
To overcome the cognitive differences between ${language} and English, when translating from ${language} to English, we need to first extract the basic subject-verb-object structure from ${language} and then expand it into English expression.

###
A. step-1: Extract the basic subject-verb-object structure from ${language} sentence.
If there exists more than one sub-verb-obj structures, list all of them.

B. step-2: Consider the extracted verbs, and think about their corresponding English verb phrase expressions. If there are several options,
choose one that conforms to English expression conventions.

C. step-3: Write down scaffold of english expression. If there are several options, choose one that conforms to English expression conventions.
 Select sentence structure from common English sentence patterns.

D. step-4: Think about most suitable sentence pattern which will be used for the final translated whole sentence.
Here are list of common patterns:
1. 简单句 (Simple Sentence)
2. 并列句 (Compound Sentence)
3. 复合句 (Complex Sentence)
4. 并列复合句 (Compound-Complex Sentence)
5. 定语从句 (Relative Clause)
6. 名词从句 (Noun Clause)
7. 状语从句 (Adverbial Clause)
8. 直接引语和间接引语 (Direct and Indirect Speech)
9. 祈使句 (Imperative Sentence)
10. 感叹句 (Exclamatory Sentence)
11. 被动语态 (Passive Voice)
12. 比较级和最高级 (Comparative and Superlative)
13. 条件句 (Conditional Sentence)
14. 分词结构 (Participle Construction)

E. step-5:  Expand from the basic framework to include time, place, and modifiers (adverbs and adjectives).

Response with JSON object, here is an sample response:
{
    "input-sentence" : "图书馆的二楼有很多书",
    "step-1" :{
       "title" : ${language === 'Chinese' ? '"提取句子的主谓宾基本结构"' : '"文の主語・述語・目的語の基本構造を抽出する"'},
       "sub-verb-obj-list": [
          {
            "subject" : {
                "input" : "二楼",
                "english" : "the second floor"
            },
              "verb" : {
                "input" : "有",
                "english" : [ "has", "there are" ]
            },
            "object" : {
                "input" : "书",
                "english" : "books"
            }
          }
        ],
        "explain" : "This step abstracts the basic elements of the event."
    },
    "step-2" :{
       "title" : ${language === 'Chinese' ? '"考察谓语动词"' : '"述語動詞を考察する"'},
        "input-verb-list" : [
          {
            "input-verb" : "有",
            "english-verb-options": [ "has", "there are" ]
          }
        ],

       "explain" : "'There are' is commonly used in this scenes."
    },
    "step-3" :{
       "title" :  ${language === 'Chinese' ? '"选择相应英语翻译的基本结构"' : '"対応する英語翻訳の基本構造を選択する"'},
       "scaffold-options":
         [
         "The second floor has books",
         "There are books on the second floor."
         ],
       "best-scaffold" : "There are books on the second floor.",
       "explain" : ""
    },
    "step-4" :{
       "title" : ${language === 'Chinese' ? '"选择句型结构类项"' : '"文型構造のカテゴリーを選択する"'},
       "sentence-structure" : "Simple Sentence",
       "explain" : ""
    },
     "step-5" :{
       "title" : ${language === 'Chinese' ? '"从句子的基本结构扩展为完整句子"' : '"文の基本構造から完全な文へと拡張する"'},
       "output" : "There are many books on the second floor of the library.",
       "explain" : ""
    }
}


NOTE: Attribute values  of "explain" in JSON should use ${language} to express.

###
Using this approach, please explain the following ${language}-to-English translation:

${sentence}
  `;
};

/**
 * Verb Comparison Prompt - Compare usage of two English verbs
 * Used by VerbCompareSkill
 * @param {string} verb1 - First verb to compare
 * @param {string} verb2 - Second verb to compare
 * @param {string} language - Language for explanation
 * @returns {string} - The prompt for verb comparison
 */
const getVerbComparisonPrompt = (verb1, verb2, language) => {
  return `
     Please compare the different usage of two English verbs, "${verb1}" and "${verb2}", and provide examples. The word count should not be less than 100 words.
     Please explain in ${language} language.
  `;
};

/**
 * Verb Explanation Prompt - Describe usage of an English verb
 * @param {string} verb - The verb to explain
 * @param {string} language - Language for explanation
 * @returns {string} - The prompt for verb explanation
 */
const getVerbExplainedPrompt = (verb, language) => {
  return `
     Please describe usage of English verb: "${verb}", and provide examples. The word count should not be less than 100 words.
     Please explain in ${language} language.
  `;
};

/**
 * Format episodes for the consolidation prompt
 * @param {Array} episodes - Array of episode objects
 * @returns {string} - Formatted episode timeline
 */
const formatEpisodesForConsolidation = (episodes) => {
  return episodes.map((ep, i) => {
    const time = new Date(ep.timestamp || ep.t_valid).toLocaleString();
    const payload = ep.payload || {};
    const parts = [`[${i + 1}] ${time} - ${ep.eventType}`];

    // Add relevant details based on event type
    if (payload.wasCorrect !== undefined) {
      parts.push(payload.wasCorrect ? 'Correct' : 'Incorrect');
    }
    if (payload.rating) {
      parts.push(`(rating: ${payload.rating})`);
    }
    if (payload.hintUsed) {
      parts.push('[hint used]');
    }
    if (payload.newBox !== undefined) {
      parts.push(`→ Box ${payload.newBox}`);
    }
    if (payload.previousBox !== undefined && payload.newBox !== undefined) {
      parts.push(`(from Box ${payload.previousBox})`);
    }
    if (payload.responseTimeMs) {
      parts.push(`[${payload.responseTimeMs}ms]`);
    }

    return parts.join(' ');
  }).join('\n');
};

/**
 * Creates a prompt for LLM-powered memory consolidation
 * Analyzes learning episodes and synthesizes into a consolidated memory
 *
 * @param {Array} episodes - Array of episode objects with payloads
 * @param {string} conceptName - Name of the concept being learned
 * @param {Object} processAnalysis - Learning process analysis from ConsolidationService
 * @returns {string} - The prompt for memory synthesis
 */
const createMemoryConsolidationPrompt = (episodes, conceptName, processAnalysis = null) => {
  const episodesSummary = formatEpisodesForConsolidation(episodes);

  const processContext = processAnalysis ? `
Learning Process Analysis:
- Total reviews: ${processAnalysis.totalReviews || episodes.length}
- Correct answers: ${processAnalysis.correctCount || 0}
- Incorrect answers: ${processAnalysis.incorrectCount || 0}
- Accuracy: ${processAnalysis.accuracy || 0}%
- Box progression: ${JSON.stringify(processAnalysis.boxProgression || [])}
- Struggle patterns detected: ${(processAnalysis.strugglePatterns || []).length}
- Cramming detected: ${processAnalysis.isCramming ? 'Yes' : 'No'}
- Average response time: ${processAnalysis.avgResponseTimeMs || 'N/A'}ms
- Hints used: ${processAnalysis.hintUsage || 0}
` : '';

  return `You are a learning analytics assistant analyzing a student's learning session.

TASK: Synthesize the following learning episodes for the concept "${conceptName}" into a consolidated memory that captures the learner's journey.

${processContext}

Episode Timeline (chronologically ordered):
${episodesSummary}

ANALYSIS REQUIREMENTS:
1. Describe the learner's progression over time (did they improve? plateau? struggle then breakthrough?)
2. Identify patterns in struggle/success (what was difficult? what clicked?)
3. Assess learning style indicators (quick learner, needs repetition, steady progress, variable performance)
4. Note any significant moments (breakthroughs, persistent struggles, cramming behavior)

Respond in JSON format:
{
  "summary": "2-3 sentence narrative describing the learning journey for this concept. Be specific about what happened.",
  "keyInsights": [
    "Specific insight about how learning progressed",
    "Pattern observation (e.g., 'struggled initially but improved after 3rd attempt')",
    "Notable behavior or trend"
  ],
  "masteryAssessment": "beginner|developing|proficient|mastered",
  "learningStyle": "quick|steady|needs-repetition|variable",
  "progressionNarrative": "Brief story (1-2 sentences) of how understanding developed over this session",
  "strugglingAreas": ["specific difficulty 1", "specific difficulty 2"],
  "breakthroughMoments": ["when understanding clicked", "turning point moment"],
  "recommendations": ["actionable suggestion based on patterns observed"],
  "metrics": {
    "totalReviews": ${processAnalysis?.totalReviews || episodes.length},
    "correctRate": ${processAnalysis?.accuracy || 0},
    "averageResponseTimeMs": ${processAnalysis?.avgResponseTimeMs || 0},
    "consistencyScore": "0-100 based on variance in performance (100=very consistent, 0=highly variable)"
  }
}

IMPORTANT:
- Be concise but specific in your analysis
- Base insights ONLY on the episode data provided
- If insufficient data, note this in the summary
- masteryAssessment should reflect the END state of the learning session
- learningStyle should reflect the PATTERN of learning observed`;
};

/**
 * Create a prompt for LLM-based answer verification for STEM problems.
 * The LLM evaluates whether the student's answer is correct, provides
 * partial credit assessment, and gives constructive feedback.
 *
 * @param {Object} params
 * @param {string} params.problem - The original problem/question
 * @param {string} params.studentAnswer - The student's submitted answer
 * @param {string} params.correctAnswer - The expected correct answer (if available)
 * @param {string} params.domain - Domain type (math, physics, chemistry, programming, etc.)
 * @param {string} params.itemType - Item type (formula, problem, code, etc.)
 * @param {Object} params.variables - Variables from the problem (if any)
 * @param {string} params.solution - Step-by-step solution (if available)
 * @returns {string} The verification prompt
 */
const createAnswerVerificationPrompt = ({
  problem,
  studentAnswer,
  correctAnswer = null,
  domain = 'general',
  itemType = 'problem',
  variables = null,
  solution = null,
}) => {
  const domainGuidance = {
    math: `
- Accept mathematically equivalent expressions (e.g., "1/2" = "0.5" = "50%")
- Accept different forms of the same answer (e.g., "x=5" = "5" for solving equations)
- Check for correct units if specified
- Evaluate intermediate steps if showing work`,
    physics: `
- Check for correct units (SI or specified)
- Accept reasonable numerical approximations
- Evaluate vector notation if applicable
- Consider significant figures if specified`,
    chemistry: `
- Check chemical formula notation
- Verify stoichiometry if relevant
- Accept equivalent notations (e.g., molecular formulas)`,
    programming: `
- Focus on correctness of logic, not exact syntax
- Accept equivalent algorithms
- Check for edge case handling if specified
- Evaluate time/space complexity claims if relevant`,
    general: `
- Compare semantic meaning, not exact wording
- Accept equivalent expressions`,
  };

  const guidance = domainGuidance[domain] || domainGuidance.general;

  let variablesSection = '';
  if (variables && Array.isArray(variables) && variables.length > 0) {
    variablesSection = `
Given Variables:
${variables.map((v) => `- ${v.symbol}: ${v.meaning}${v.value ? ` = ${v.value}` : ''}`).join('\n')}
`;
  }

  let correctAnswerSection = '';
  if (correctAnswer) {
    correctAnswerSection = `
Expected Answer:
${correctAnswer}
`;
  }

  let solutionHint = '';
  if (solution) {
    solutionHint = `
Reference Solution (for verification context only):
${solution.substring(0, 500)}${solution.length > 500 ? '...' : ''}
`;
  }

  return `You are an expert ${domain} tutor evaluating a student's answer. Your task is to:
1. Determine if the student's answer is correct
2. Assess partial credit if applicable
3. Provide constructive, encouraging feedback
4. Suggest a hint for improvement if incorrect

Domain: ${domain}
Item Type: ${itemType}

${guidance}

Problem/Question:
${problem}
${variablesSection}${correctAnswerSection}
Student's Answer:
${studentAnswer}
${solutionHint}
Evaluate the student's answer and respond in JSON format:

{
  "correct": true/false,
  "confidence": 0.0-1.0,
  "partialCredit": 0-100,
  "equivalentToExpected": true/false,
  "explanation": "Brief explanation of why the answer is correct/incorrect",
  "feedback": "Encouraging, constructive feedback for the student",
  "errors": ["List specific errors if any"],
  "suggestedHint": "A hint to help if incorrect (null if correct)",
  "workingShown": true/false,
  "conceptsApplied": ["List of correctly applied concepts"],
  "conceptsMissing": ["List of concepts not applied or misunderstood"]
}

IMPORTANT:
- Be encouraging even for incorrect answers
- Focus on understanding, not just the final number
- Give partial credit for correct methodology with calculation errors
- "confidence" reflects how certain you are in your evaluation (1.0 = very certain)
- If the student shows their work, evaluate the process not just the final answer
- Accept mathematically/logically equivalent answers as correct`;
};

/**
 * Creates a prompt for LLM-driven schedule reconciliation
 * The LLM analyzes learner context and provides personalized scheduling decisions
 *
 * @param {Object} context - Context object containing learner data
 * @param {string} context.planName - Name of the learning plan
 * @param {string} context.domainType - Domain type (vocabulary, math, etc.)
 * @param {Object} context.profile - Learner profile with forgetting curve, optimal timing
 * @param {Array} context.overdueItems - Array of overdue items with decay calculations
 * @param {Object} context.gapAnalysis - Analysis of the learning gap
 * @param {Array} context.crossConceptPatterns - Cross-concept patterns (prerequisites, interference)
 * @param {Object} context.recentMemory - Recent consolidated memory summary
 * @param {Object} context.sessionContext - Current session context (time of day, previous sessions)
 * @returns {string} - The prompt for schedule reconciliation
 */
const createScheduleReconciliationPrompt = (context) => {
  const {
    planName,
    domainType,
    profile,
    overdueItems,
    gapAnalysis,
    crossConceptPatterns,
    recentMemory,
    sessionContext,
  } = context;

  // Format profile information
  const profileSummary = profile ? `
Learner Profile:
- Forgetting curve slope: ${profile.forgettingCurveSlope || 0.5} (lower = better retention)
- Optimal review interval: ${profile.optimalReviewInterval || 3} days
- Average retention rate: ${(profile.averageRetentionRate || 0.7) * 100}%
- Learning pace preference: ${profile.pacePreference || 'steady'}
- Optimal time of day: ${profile.preferredTimeOfDay || 'flexible'}
- Optimal session length: ${profile.optimalSessionLength || 25} minutes
- Consistency score: ${profile.consistencyScore || 50}/100
` : '';

  // Format overdue items with priority info
  const overdueItemsSummary = overdueItems && overdueItems.length > 0 ? `
Overdue Items (${overdueItems.length} total):
${overdueItems.slice(0, 10).map((item, i) => {
    const daysOverdue = Math.floor((Date.now() - new Date(item.nextReview).getTime()) / (1000 * 60 * 60 * 24));
    const decayedMastery = item.decayedMastery !== undefined ? `${Math.round(item.decayedMastery * 100)}%` : 'N/A';
    return `  ${i + 1}. "${item.front.substring(0, 30)}..." - Box ${item.boxLevel}, ${daysOverdue} days overdue, mastery: ${decayedMastery}`;
  }).join('\n')}${overdueItems.length > 10 ? `\n  ... and ${overdueItems.length - 10} more` : ''}
` : 'No overdue items.';

  // Format gap analysis
  const gapSummary = gapAnalysis ? `
Gap Analysis:
- Gap severity: ${gapAnalysis.severity || 'unknown'}
- Days since last review: ${gapAnalysis.daysSinceLastReview || 'N/A'}
- Gap relative to optimal: ${gapAnalysis.gapRelativeToOptimal || 'N/A'}x
- Estimated mastery decay: ${gapAnalysis.estimatedDecay ? `${Math.round(gapAnalysis.estimatedDecay * 100)  }%` : 'N/A'}
- Session type: ${gapAnalysis.sessionType || 'first_today'}
` : '';

  // Format cross-concept patterns
  const patternsSummary = crossConceptPatterns && crossConceptPatterns.length > 0 ? `
Cross-Concept Patterns Detected:
${crossConceptPatterns.slice(0, 5).map((p) => {
    if (p.type === 'PREREQUISITE') {
      return `  - PREREQUISITE: "${p.conceptA}" should be studied before "${p.conceptB}" (confidence: ${Math.round(p.confidence * 100)}%)`;
    } if (p.type === 'INTERFERENCE') {
      return `  - INTERFERENCE: "${p.conceptA}" and "${p.conceptB}" interfere - space them out`;
    } if (p.type === 'POSITIVE_TRANSFER') {
      return `  - POSITIVE TRANSFER: "${p.conceptA}" reinforces "${p.conceptB}"`;
    }
    return `  - ${p.type}: ${p.conceptA} ↔ ${p.conceptB}`;
  }).join('\n')}
` : '';

  // Format recent memory context
  const memorySummary = recentMemory ? `
Recent Learning Context:
- Last session: ${recentMemory.lastSessionSummary || 'No recent session data'}
- Recent mastery trend: ${recentMemory.masteryTrend || 'unknown'}
- Struggling concepts: ${recentMemory.strugglingConcepts?.join(', ') || 'None identified'}
- Strong concepts: ${recentMemory.strongConcepts?.join(', ') || 'None identified'}
` : '';

  // Format current session context
  const sessionSummary = sessionContext ? `
Current Session Context:
- Time of day: ${sessionContext.timeOfDay || 'unknown'}
- Day of week: ${sessionContext.dayOfWeek || 'unknown'}
- Sessions today: ${sessionContext.sessionsToday || 0}
- Items reviewed today: ${sessionContext.itemsReviewedToday || 0}
- Available study time: ${sessionContext.availableMinutes || 'unknown'} minutes
` : '';

  return `You are an adaptive learning schedule manager using personalized spaced repetition.

TASK: Analyze the learner's context and provide intelligent scheduling decisions for their study session.

Learning Plan: "${planName || 'Unknown'}"
Domain: ${domainType || 'general'}

${profileSummary}
${overdueItemsSummary}
${gapSummary}
${patternsSummary}
${memorySummary}
${sessionSummary}

ANALYSIS REQUIREMENTS:
1. Prioritize items based on learner's personal forgetting curve (not generic intervals)
2. Consider cross-concept relationships (prerequisites first, space out interfering concepts)
3. Account for the learner's optimal session length and current fatigue
4. Adjust for time since last review relative to the learner's optimal interval
5. Consider recent performance trends and struggling areas

Respond in JSON format:
{
  "prioritizedItems": [
    {
      "itemId": "item_id_here",
      "priority": 1-10,
      "reason": "Brief explanation of priority",
      "suggestedInterval": "next review interval in days if answered correctly"
    }
  ],
  "sessionPlan": {
    "recommendedItemCount": "number of items for this session",
    "estimatedDurationMinutes": "expected session length",
    "focusAreas": ["concepts to focus on"],
    "conceptsToSpace": ["concepts to avoid in same session due to interference"]
  },
  "adjustments": {
    "intervalMultiplier": "0.5-2.0 adjustment to base intervals based on gap severity",
    "reasoning": "Why intervals should be adjusted"
  },
  "recommendations": {
    "studyOrder": "Description of optimal study order",
    "breakSuggestion": "When to take breaks if session is long",
    "nextSessionTiming": "When to schedule next session"
  },
  "confidence": 0.0-1.0
}

IMPORTANT:
- Prioritize items at risk of forgetting (high decay, long overdue)
- Don't overwhelm: suggest reasonable session length based on learner's preferences
- Consider interference patterns: don't schedule similar confusable items together
- For prerequisites, ensure foundational concepts are reviewed first
- Adjust intervals based on gap severity: longer gaps → shorter initial intervals to rebuild retention`;
};

/**
 * Creates a prompt for generating a catch-up plan after extended absence
 * Used when the learner has a significant backlog of overdue items
 *
 * @param {Object} context - Context object containing learner data
 * @param {number} context.totalOverdueCount - Total number of overdue items
 * @param {number} context.daysSinceLastSession - Days since last study session
 * @param {Object} context.profile - Learner profile
 * @param {number} context.availableMinutesPerDay - Available study time per day
 * @param {Array} context.overdueByDomain - Breakdown of overdue items by domain
 * @returns {string} - The prompt for catch-up plan generation
 */
const createCatchUpPlanPrompt = (context) => {
  const {
    totalOverdueCount,
    daysSinceLastSession,
    profile,
    availableMinutesPerDay,
    overdueByDomain,
    targetCatchUpDays,
  } = context;

  const domainBreakdown = overdueByDomain && overdueByDomain.length > 0 ?
    overdueByDomain.map((d) => `  - ${d.domain}: ${d.count} items (avg ${d.avgDaysOverdue} days overdue)`).join('\n') :
    'No domain breakdown available';

  return `You are a learning recovery specialist helping a learner get back on track after an extended break.

SITUATION:
- Days since last session: ${daysSinceLastSession || 'unknown'}
- Total overdue items: ${totalOverdueCount || 0}
- Available study time per day: ${availableMinutesPerDay || 30} minutes
- Target catch-up period: ${targetCatchUpDays || 7} days

Overdue Items by Domain:
${domainBreakdown}

Learner Profile:
- Pace preference: ${profile?.pacePreference || 'steady'}
- Optimal session length: ${profile?.optimalSessionLength || 25} minutes
- Consistency score: ${profile?.consistencyScore || 50}/100
- Forgetting curve slope: ${profile?.forgettingCurveSlope || 0.5}

TASK: Create a realistic catch-up plan that:
1. Prioritizes items at highest risk of being forgotten completely
2. Doesn't overwhelm the learner (sustainable daily load)
3. Rebuilds the learning habit gradually
4. Accounts for re-learning time (overdue items need more repetitions)

Respond in JSON format:
{
  "plan": {
    "totalDays": "number of days to catch up",
    "dailySchedule": [
      {
        "day": 1,
        "itemCount": "items to review",
        "focusDomains": ["primary domain focus"],
        "estimatedMinutes": "expected time",
        "intensity": "light|moderate|intensive"
      }
    ],
    "priorityTiers": {
      "critical": "items > 2x optimal interval overdue",
      "important": "items 1-2x optimal interval overdue",
      "routine": "items < 1x optimal interval overdue"
    }
  },
  "strategy": {
    "approach": "Description of overall approach",
    "dailyGoal": "Concrete daily goal",
    "milestones": ["day 3: xyz milestone", "day 7: xyz milestone"],
    "adjustmentTriggers": ["When to adjust the plan"]
  },
  "motivation": {
    "encouragement": "Encouraging message for the learner",
    "progressMetric": "How to measure progress",
    "rewards": ["suggested micro-rewards for milestones"]
  },
  "warnings": ["potential challenges to watch for"],
  "confidence": 0.0-1.0
}

IMPORTANT:
- Start gently on day 1 to rebuild habit
- Gradually increase intensity over first 3 days
- Don't schedule more than learner's optimal session length per day initially
- Include buffer for items that need extra repetitions
- Plan for the possibility that some items may need to be re-learned from scratch`;
};

/**
 * Tutor-mode system prompt — Phase 1.
 *
 * Wraps the assembled learner/knowledge/recent-activity blocks (produced by
 * src/renderer/utils/tutorContext.js) with behavioral guidance so the chat
 * answers as a teacher who remembers the learner, not a stateless Q&A bot.
 *
 * The injected blocks are passed as a single string (`contextString`). They
 * are wrapped in XML-style tags inside the system prompt so the model treats
 * them as data, not instructions.
 *
 * @param {string} contextString — pre-formatted block bundle (may be '')
 * @param {Object} [opts]
 * @param {string} [opts.bookTitle]
 * @param {string} [opts.chapterTitle]
 * @returns {string}
 */
const createTutorSystemPrompt = (contextString, opts = {}) => {
  const { bookTitle, chapterTitle } = opts;
  const bookLine = bookTitle
    ? `The learner is currently reading "${bookTitle}"${chapterTitle ? `, chapter "${chapterTitle}"` : ''}.`
    : '';

  const trimmedContext = (contextString || '').trim();
  const contextSection = trimmedContext
    ? `Use the following information about the learner silently — do NOT state it back unless directly asked. Adapt your tone, depth, and starting point based on it.\n\n${trimmedContext}\n`
    : 'No learner profile data is available yet — answer as a careful tutor and ask questions to learn about the reader as you go.\n';

  return `You are a personal learning tutor for this specific reader.

${bookLine}

Behavioral rules:
- If they ask about a concept they have already mastered (per <KNOWLEDGE>), build on it rather than re-explaining basics.
- If they ask about a concept they recently struggled with, slow down and try a DIFFERENT framing than a stock explanation — concrete examples, analogies, or a check question.
- If they ask about a concept new to them, briefly check the prerequisite chain first ("do you know X?") before diving in.
- Match their preferred learning style (visual / textual / mixed) from <LEARNER>.
- If <RECENT_ACTIVITY> suggests cramming or burnout, keep responses tight and end with a low-cost suggestion (e.g., "want a 2-minute recap card for this?").
- Never enumerate the data you have about them. The reader experience is "this AI just gets me," not "this AI is reading my profile out loud."
- When the page text (provided in the user-turn context) is the focus, answer about *this* passage rather than generic knowledge.

${contextSection}`;
};

// ===========================================================================
// Domain-aware extraction prompts (Phase 3b)
//
// Each prompt asks the LLM to produce the typed `extras` shape declared
// in src/commons/model/LearningPointDomains.ts for the given domain.
// They are deliberately short and instruct the model to focus on the
// fields that matter for the corresponding card type. The schema itself
// is appended by the structured-output polyfill (do NOT inline the schema
// here — keep the prompt focused on the task and the extraction rules).
// ===========================================================================

/** Vocabulary: word/phrase → ipa, partOfSpeech, examples, collocations, translations */
const createVocabularyExtractionPrompt = (text, targetLang = '') => `
You are extracting structured vocabulary data from the following text.

Identify the primary word or phrase being defined or used, and produce a
JSON object with these fields (omit any field you cannot confidently fill):
- ipa: IPA pronunciation (e.g. "/ɪˈfɛm(ə)rəl/")
- partOfSpeech: noun | verb | adjective | adverb | phrase | idiom | other
- examples: 1-3 short example sentences USING the word
- collocations: common multi-word patterns (e.g. "ephemeral beauty")
${targetLang ? `- translations: object keyed by language code, ONLY include "${targetLang}"` : '- translations: object keyed by language code (only if obvious)'}

Do not invent definitions — only extract what is in or directly implied by the text.

TEXT:
"""
${text}
"""
`;

/**
 * Formal concept (math / physics / chemistry / biology).
 * Output shape mirrors FormalConceptExtras in LearningPointDomains.ts.
 */
const createFormalConceptExtractionPrompt = (text, domain = 'math') => `
You are extracting a formal ${domain} concept from the following text.

Produce a JSON object with these fields (omit any field you cannot fill):
- definitionLatex: the concept's definition. Use LaTeX for math notation (\\frac, \\int, etc.) when applicable, otherwise plain text.
- workedExampleLatex: ONE worked example demonstrating the concept, in LaTeX where applicable.
- prerequisites: array of concept NAMES the learner should know first (do not invent IDs)
- similarProblems: array of up to 2 objects, each { "promptLatex": "...", "solutionLatex": "..." }
- commonMistakes: array of 1-3 short strings naming frequent pitfalls
${domain === 'physics' || domain === 'chemistry' ? '- units: SI unit string if applicable (e.g. "m/s", "mol/L")' : ''}

Be precise. Do not paraphrase the definition unless the text is informal.

TEXT:
"""
${text}
"""
`;

/**
 * Programming: code snippet + explanation.
 * Output shape mirrors ProgrammingExtras in LearningPointDomains.ts.
 */
const createProgrammingExtractionPrompt = (text) => `
You are extracting a programming concept or snippet from the following text.

Produce a JSON object with these fields:
- language (REQUIRED): programming language identifier in lowercase (e.g. "javascript", "python", "rust", "sql")
- snippet (REQUIRED): the code sample (extract the most representative block; preserve whitespace)
- expectedOutput: what the snippet outputs / returns, if shown or directly stated
- variations: array of up to 2 { "snippet": "...", "note": "..." } alternatives or related forms
- gotchas: array of 1-3 short strings describing pitfalls or surprises
- runnable: true if the snippet is self-contained and runnable as-is, false if it needs context
- versionContext: language/library version if behavior depends on it

If no code is present, return { "language": "", "snippet": "" }.

TEXT:
"""
${text}
"""
`;

/**
 * Knowledge / history / geography / reading (KnowledgeExtras shape).
 * General-purpose extractor for prose-like content.
 */
const createKnowledgeExtractionPrompt = (text) => `
You are extracting general factual / contextual information from the following text.

Produce a JSON object with these fields (omit any field with no content):
- sources: array of { "title": "...", "url": "...", "cite": "..." } if the text cites references
- relatedConcepts: array of concept NAMES mentioned that the learner may want to follow up on
- evidence: array of short statements summarizing the key claims supported by the text
- dates: array of ISO-style date strings (YYYY or YYYY-MM-DD) relevant to the content
- locations: array of place names mentioned

Be conservative — only include fields the text actually supports.

TEXT:
"""
${text}
"""
`;

/**
 * Micro-card proposal prompt (Phase 4).
 *
 * Asks the LLM to decide whether a paragraph contains a single learnable
 * concept worth flashcarding, and if so, generate a tight (front, back)
 * pair. The model is also the final quality gate — if the paragraph is
 * boilerplate, narrative filler, or doesn't teach anything, it returns
 * `shouldPropose: false`.
 *
 * The expected output shape matches what MicroCardProposer.normalizeProposal
 * consumes; do not change one without the other.
 *
 * @param {string} paragraphText
 * @param {Object} [context] — { bookTitle, chapterTitle, knownConcepts: string[] }
 */
const createMicroCardProposalPrompt = (paragraphText, context = {}) => {
  const { bookTitle, chapterTitle, knownConcepts } = context;
  const bookLine = bookTitle
    ? `The reader is in "${bookTitle}"${chapterTitle ? `, chapter "${chapterTitle}"` : ''}.`
    : '';
  const knownLine =
    Array.isArray(knownConcepts) && knownConcepts.length > 0
      ? `Concepts the reader already knows (do NOT propose cards for these): ${knownConcepts.slice(0, 30).join(', ')}.`
      : '';

  return `${bookLine}
${knownLine}
You are evaluating a single paragraph the reader just finished. Decide whether it contains ONE learnable concept worth turning into a flashcard.

Return ONLY one JSON object with these fields:
- shouldPropose (boolean): true ONLY if the paragraph contains a definitional, factual, or technical idea the reader would benefit from reviewing later. False for narrative filler, transitional text, boilerplate, examples without a generalizable concept, or anything the reader is already known to know.
- front (string, ≤ 100 chars): a concise question or term that prompts recall of the concept. Use the natural question form ("What is X?" / "Why does Y happen?") or just the term itself.
- back (string, ≤ 300 chars): the answer / definition / key fact. Self-contained — should not require re-reading the paragraph.
- domain (string): one of vocabulary, math, programming, knowledge, language, reading, skill. Best-fit domain.
- conceptName (string, optional): the canonical name of the concept being learned (e.g. "oxidative phosphorylation").
- confidence (number 0-1): your confidence that THIS card is worth proposing.

Guidance:
- Prefer FEWER, HIGHER-QUALITY proposals. Returning shouldPropose=false is the right answer most of the time.
- If the paragraph contains multiple ideas, pick the most central one — never propose multiple cards from one paragraph.
- The front should test understanding, not regurgitation. Avoid "What does the paragraph say about X?".

PARAGRAPH:
"""
${paragraphText}
"""
`;
};

/**
 * Phase 5: Pre-book diagnostic prompt.
 *
 * Given a book's TOC (flat list of chapter labels) plus light metadata,
 * the LLM returns a structured summary the renderer can render as an
 * annotated map of what's ahead. The renderer then deterministically
 * intersects `chapters[].estimatedConcepts` with the learner's known
 * concepts to surface "you already know X" / "you'll learn Y" annotations
 * — no second AI call is needed for personalization.
 *
 * The output shape is consumed by BookDiagnosticService.parseResponse;
 * do not change one without the other.
 *
 * @param {Object} input
 * @param {string} input.bookTitle
 * @param {string} [input.bookAuthor]
 * @param {string} [input.bookCategory]
 * @param {Array<{label: string, depth?: number}>} input.tocEntries
 * @param {string[]} [input.knownConcepts] — for primer personalization (NOT
 *   used for annotation; that's deterministic post-processing)
 */
const createBookDiagnosticPrompt = (input = {}) => {
  const {
    bookTitle = '',
    bookAuthor = '',
    bookCategory = '',
    tocEntries = [],
    knownConcepts = [],
  } = input;

  const meta = [
    bookTitle && `Title: ${bookTitle}`,
    bookAuthor && `Author: ${bookAuthor}`,
    bookCategory && `Category: ${bookCategory}`,
  ]
    .filter(Boolean)
    .join('\n');

  const tocList = tocEntries
    .map((e, i) => {
      const indent = '  '.repeat(Math.max(0, (e.depth || 0)));
      return `${i + 1}. ${indent}${e.label}`;
    })
    .join('\n');

  const knownLine =
    Array.isArray(knownConcepts) && knownConcepts.length > 0
      ? `The reader already knows these concepts (use to tailor the primer; ` +
        `don't suggest revisiting them): ${knownConcepts.slice(0, 40).join(', ')}.`
      : 'The reader is new to this material.';

  return `You are helping a reader decide how to approach a book they're about to start.

${meta}

TABLE OF CONTENTS (chapter titles only; the body text is not available):
${tocList}

${knownLine}

Return ONLY one JSON object with these fields:
- bookSummary (string, ≤ 240 chars): one or two sentences naming what the book is about and what kind of reader it suits.
- topics (string[], 3-6 items): high-level topics the book covers (e.g. "cellular respiration", "linear algebra", "the French Revolution"). Lowercase canonical phrases.
- estimatedDifficulty (string): one of beginner | intermediate | advanced. Your best guess from titles + category.
- chapters (array): one entry per TOC entry in the SAME order. Each entry: { title: string (echo the title), estimatedConcepts: string[] (2-5 specific concept names this chapter likely covers — empty array if the title is too generic e.g. "Introduction", "Appendix") }.
- primer (string, ≤ 600 chars): a personalized note to the reader. Mention chapters that will be densest, prerequisites worth shoring up, and (if knownConcepts is non-empty) which chapters they can probably skim because they already know the material. Speak directly to the reader ("you'll").
- prerequisiteWarnings (array, optional, up to 3): { topic: string, reason: string } — topics the reader should be comfortable with before starting; only include if titles strongly imply a prerequisite (e.g. "calculus" for a real analysis book).

Be honest about uncertainty: if titles are too thin to guess content (e.g. "Chapter 1", "Part II"), return empty estimatedConcepts for those entries rather than confabulating. Better to under-guess than to mislead the reader.`;
};

/**
 * createComprehensionPromptPrompt — generates a single open-ended comprehension
 * question from a chapter title + accumulated text excerpt (Phase 6).
 *
 * The output is a plain string (the question), not JSON, so no schema is needed.
 * Keep it open-ended ("explain", "describe", "what is the relationship between")
 * rather than factual recall — we want to surface understanding gaps, not quiz trivia.
 */
const createComprehensionPromptPrompt = (input = {}) => {
  const { chapterTitle = '', textExcerpt = '', bookTitle = '' } = input;

  const bookLine = bookTitle ? `Book: ${bookTitle}\n` : '';
  const excerptTrimmed = (textExcerpt || '').slice(0, 3000);

  return `${bookLine}Chapter: ${chapterTitle}

The reader just finished this chapter. Here is the chapter text (possibly truncated):
---
${excerptTrimmed}
---

Generate ONE open-ended comprehension question that would reveal whether the reader genuinely understood the chapter's main idea or central mechanism. The question should:
- Require the reader to explain, not just recall a fact
- Be answerable in 2-5 sentences
- Avoid "list X things" formats

Return ONLY the question text, no preamble, no numbering.`;
};

/**
 * createComprehensionGradingPrompt — grades the reader's free-text answer
 * against the chapter content (Phase 6).
 *
 * Returns JSON: { score (0-100), strengths (string[]), gaps (string[]), feedback (string ≤ 200 chars) }
 * score: 0-49 = significant gaps, 50-74 = partial, 75-100 = solid understanding
 */
const createComprehensionGradingPrompt = (input = {}) => {
  const {
    chapterTitle = '',
    textExcerpt = '',
    question = '',
    answer = '',
    bookTitle = '',
  } = input;

  const bookLine = bookTitle ? `Book: ${bookTitle}\n` : '';
  const excerptTrimmed = (textExcerpt || '').slice(0, 3000);

  return `${bookLine}Chapter: ${chapterTitle}

Chapter text (possibly truncated):
---
${excerptTrimmed}
---

Question asked: ${question}

Reader's answer: ${answer}

Grade the reader's answer for comprehension depth. Return ONLY one JSON object:
- score (integer 0-100): 0-49 = significant gaps, 50-74 = partial understanding, 75-100 = solid understanding
- strengths (string[], 0-3 items): what the reader got right — concrete, specific
- gaps (string[], 0-3 items): key concepts or mechanisms the reader missed or misunderstood — concrete, specific (empty array if score >= 75)
- feedback (string, ≤ 200 chars): one or two encouraging sentences that name the most important thing they missed (if any) or affirm what they understood well

Grade for understanding of concepts and relationships, not for matching exact wording from the text.`;
};

/**
 * createLearningPathPrompt — given a learning goal and the user's library,
 * produces an ordered multi-book reading curriculum (Phase 7).
 *
 * Books with Phase 5 diagnostic data contribute topics + per-chapter concepts.
 * Books without diagnostic data appear as title/author only so the AI can
 * still mention them if they're plausibly relevant.
 *
 * Output JSON:
 *   {
 *     summary        string   — one sentence on what this path covers
 *     pathSteps      Array    — ordered reading steps (see below)
 *     coverageGaps   string[] — goal topics not covered by any book in library (0–4 items)
 *   }
 *
 *   pathStep: { bookId, bookTitle, chapterFocus ('all' | string[]), reason, estimatedHours }
 */
const createLearningPathPrompt = (input = {}) => {
  const { goal = '', analyzedBooks = [], unaanalyzedBooks = [] } = input;

  const analyzedSection = analyzedBooks
    .map((b, i) => {
      const topicLine = b.topics?.length
        ? `  Topics: ${b.topics.slice(0, 6).join(', ')}`
        : '';
      const diffLine = b.estimatedDifficulty
        ? `  Difficulty: ${b.estimatedDifficulty}`
        : '';
      const chapterLines = (b.chapters || [])
        .slice(0, 20)
        .map((ch) => {
          const concepts = ch.estimatedConcepts?.slice(0, 4).join(', ') || '';
          return `    - ${ch.title}${concepts ? ` (${concepts})` : ''}`;
        })
        .join('\n');
      return `[Book ${i + 1}] id=${b.id} "${b.title}"${b.author ? ` by ${b.author}` : ''}\n${topicLine}\n${diffLine}\n  Chapters:\n${chapterLines}`;
    })
    .join('\n\n');

  const unanalyzedSection =
    unaanalyzedBooks.length > 0
      ? `\nLibrary books without analysis (title only — include only if clearly relevant):\n${unaanalyzedBooks
          .map((b) => `  id=${b.id} "${b.title}"${b.author ? ` by ${b.author}` : ''}`)
          .join('\n')}`
      : '';

  return `You are building a personalized multi-book reading curriculum for a learner.

Learning goal: ${goal}

The learner's library (books with full analysis):
${analyzedSection || '(none)'}
${unanalyzedSection}

Create the optimal reading sequence from the books above that best achieves the goal.

Rules:
- Only include books that meaningfully contribute to the goal. Exclude irrelevant books entirely.
- Order steps from foundational to advanced — prerequisites first.
- For each step, chapterFocus should be 'all' if the whole book is relevant, or a list of chapter titles (echo exactly as listed) if only specific chapters matter.
- estimatedHours: honest estimate in hours of active reading + note-taking.
- If the goal cannot be well served by the available books, include coverageGaps (topics the learner should seek elsewhere).
- Keep reasons concise (≤ 100 chars each).

Return ONLY one JSON object:
{
  "summary": "string (≤ 160 chars) — what this curriculum achieves",
  "pathSteps": [
    {
      "bookId": number,
      "bookTitle": "string",
      "chapterFocus": "all" or ["chapter title 1", "chapter title 2"],
      "reason": "string ≤ 100 chars",
      "estimatedHours": number
    }
  ],
  "coverageGaps": ["string"] (0–4 items; only topics genuinely missing from the library)
}`;
};

export default getSummaryChatHistoryPrompt;
export {
  createTutorSystemPrompt,
  // Domain-aware extraction prompts (Phase 3b)
  createVocabularyExtractionPrompt,
  createFormalConceptExtractionPrompt,
  createProgrammingExtractionPrompt,
  createKnowledgeExtractionPrompt,
  // Micro-card proposal prompt (Phase 4)
  createMicroCardProposalPrompt,
  // Pre-book diagnostic prompt (Phase 5)
  createBookDiagnosticPrompt,
  // Comprehension grading prompts (Phase 6)
  createComprehensionPromptPrompt,
  createComprehensionGradingPrompt,
  // Cross-book learning path prompt (Phase 7)
  createLearningPathPrompt,
  getMindMapChatHistoryPrompt,
  getQuizChatHistoryPrompt,
  getUserMessageForCategory,
  extractJsonPrompt,
  createMoodBoardLayoutPrompt,
  mapToNewJsonSchema,
  createVocabularyPrompt,
  createReaderLevelPrompt,
  langstudy5wPrompt,
  createRewriteHtmlCodeForElementarySchoolPrompt,
  createRewriteHtmlCodeForWordFrequencyJsonPrompt,
  createDecomposeParagraphPrompt,
  createSmartSummaryPrompt,
  createMindmapExtractionPrompt,
  createEntityResolutionPrompt,
  // Translation prompts (moved from renderer/views/translate/PromptUtil.js)
  getNLPAnnotationPrompt,
  getTranslatePrompt,
  getVerbComparisonPrompt,
  getVerbExplainedPrompt,
  // Memory consolidation prompt
  createMemoryConsolidationPrompt,
  formatEpisodesForConsolidation,
  // Answer verification prompt
  createAnswerVerificationPrompt,
  // Schedule reconciliation prompts
  createScheduleReconciliationPrompt,
  createCatchUpPlanPrompt,
};

// === Writing Practice v2 (2026-06-29 redesign) ===

export const langstudyRecallLadderPrompt = (text) => `
Generate three masked versions of the paragraph below for a language-learning recall exercise.
Each version targets a different layer of SENTENCE STRUCTURE — not random content words.
The pedagogical goal is to help the learner notice how English builds complex thought,
not to memorize vocabulary. Wrap each masked span with \${} so the renderer can detect them.

Return ONLY a JSON object with three string fields:

  - "light":   STRUCTURAL CONNECTIVES — mask only the small structural words that glue
               sentences together: coordinating conjunctions (and, but, or, so, yet),
               subordinating conjunctions (although, while, because, since, if, unless,
               whereas, when, before, after), discourse markers (however, therefore,
               nevertheless, in addition, as a result, on the other hand), relative pronouns
               (who, which, that, where, when), and prepositional connectives (in order to,
               despite, due to, instead of). Do NOT mask main verbs, content nouns, or
               adjectives. If a sentence has no such connectives, leave it unmasked.

  - "medium":  CLAUSE STEMS — mask the verbal joints driving each clause: main verbs with
               their auxiliaries (had been, will have, would have), copulas with their
               complements (is responsible, became clear), modal verbs with their main verb
               (must consider, should remain), and the verb stems of subordinate clauses
               (that he had waited, who is responsible). Do NOT mask connectives this time —
               keep them visible so the structural skeleton is intact.

  - "hard":    SUBORDINATE STRUCTURES — mask whole subordinate clauses and embedded
               argument phrases: everything inside a "that…" / "which…" / "who…" / "when…" /
               "if…" / "because…" dependency, plus whole prepositional or infinitival
               argument phrases that complete a main verb. Keep the main clause spine
               (subject + main verb + connective) visible. The learner reconstructs the
               dependent ideas while the spine stays intact.

Example for "Although the project fell behind schedule, the team still delivered everything on time because they had a clear plan.":

{
  "light":  "\${Although} the project fell behind schedule, the team still delivered everything on time \${because} they had a clear plan.",
  "medium": "Although the project \${fell behind} schedule, the team \${still delivered} everything on time because they \${had} a clear plan.",
  "hard":   "Although \${the project fell behind schedule}, the team still delivered everything on time \${because they had a clear plan}."
}

Paragraph:
${text}
`;

export const langstudyExpressionDiffPrompt = (original, learner) => `
You are a language-learning tutor. Compare the LEARNER's text against the ORIGINAL
SENTENCE BY SENTENCE. For each sentence pair, surface where the learner's
expression is weaker than the original's (collocation, idiom, register,
cohesion) and where it has mechanical grammar issues.

Return ONLY a JSON object with this shape:
{
  "spans": [
    { "side": "learner"|"original", "text": "<exact substring>", "kind": "match"|"weaker"|"stronger"|"grammar", "pair_id": "<string, only for weaker/stronger pairs>", "sentence_index": <0-based>, "note": "<optional, only for grammar kind>" }
  ],
  "sentenceComparisons": [
    {
      "sentenceIndex": 0,
      "originalSentence": "<the original's sentence 0>",
      "learnerSentence": "<the learner's corresponding sentence>",
      "notes": [
        { "pair_id": "<matches a span pair>", "learner_phrase": "...", "original_phrase": "...", "explanation": "1-2 sentences on why the original phrasing is stronger." }
      ]
    }
  ]
}

Rules:
- Split the ORIGINAL into sentences (terminal . ! ?). For each, find the
  best-matching sentence in the LEARNER's text (paraphrase, near-match, or
  shorter version). Pair them via "sentenceIndex" (0-based from the original).
- If the learner has merged two original sentences into one, repeat the
  learner sentence under both indices. If the learner has split one original
  sentence into two, list both halves in "learnerSentence".
- Pair each "weaker" learner span with the corresponding "stronger" original
  span via the same pair_id (p1, p2, p3, ...). pair_id is globally unique
  across the document.
- Notes are nested INSIDE the sentenceComparisons entry they belong to —
  don't emit a flat top-level notes array.
- Do NOT include "match" spans unless they are deliberate paraphrases worth
  praising; default to omitting them.
- Each note's "explanation" must be ONE pedagogical reason (collocation
  rule, idiom, register, cohesion device) — not a generic "the original is
  better."
- If a sentence pair has no issues, include the pair with notes: [].

ORIGINAL:
${original}

LEARNER:
${learner}
`;

export const langstudyDictionaryLookupPrompt = (word, context = '') => `
Look up the English word "${word}"${context ? ' in this paragraph context:\n' + context : ''}.

Return ONLY a JSON object with these fields:
{
  "definition": "<concise definition appropriate for the context — 1 to 2 sentences>",
  "partOfSpeech": "<noun / verb / adjective / adverb / preposition / ...>",
  "example": "<one short example sentence using the word, distinct from the context>",
  "related": "<2-4 related words (synonyms, antonyms, root forms), comma-separated; empty string if none>"
}

Keep the definition short and learner-friendly. Avoid circular definitions.
`;

export const langstudyComposeScaffoldsPrompt = (text, l1Language = 'Chinese') => `
You are a language-learning tutor helping a learner reconstruct a paragraph in their target language (English) from scratch.
Produce three scaffolds that anchor MEANING without giving away the exact wording.

Return ONLY a JSON object with this shape:
{
  "gists": [
    "<sentence 1's gist in plain everyday English — what the sentence is saying, NOT the original wording>",
    "<sentence 2's gist>",
    ...
  ],
  "phrases": [
    "<idiomatic phrase or collocation 1 from the original — useful for the learner to reuse>",
    "<phrase 2>",
    ...
  ],
  "translation": "<the WHOLE paragraph translated into ${l1Language}>"
}

Rules:
- "gists": one item per sentence in the original paragraph. Each gist should be a clear simple-English summary of what the sentence means, NOT a paraphrase. Aim for ~10-15 words. Avoid copying the original's distinctive phrases.
- "phrases": 6 to 10 useful collocations or idiomatic phrases extracted verbatim from the original. Focus on multi-word units that L2 learners typically miss (e.g., "make a decision", "at first glance", "happened during", "include the commerce of"). Skip trivial bigrams (the cat, in 2009).
- "translation": faithful translation of the original paragraph into ${l1Language}. Preserve register and meaning.

ORIGINAL:
${text}
`;


// === Translate Page Redesign (2026-06-30) ===

export const getSvoHintPrompt = (sentence, language) => `
You are a language expert helping a learner translate from ${language} to English.

Identify the subject, verb, and object of the ${language} sentence below. If the
sentence has multiple sub-clauses, return only the MAIN clause's SVO.

Return ONLY a JSON object with this shape:
{
  "subject": { "source": "<the ${language} subject>", "english": "<idiomatic English translation>" },
  "verb":    { "source": "<the ${language} verb>",    "english": "<idiomatic English verb phrase>" },
  "object":  { "source": "<the ${language} object>",  "english": "<idiomatic English object>" }
}

If a slot is implied but not explicit in the source (common in ${language}), still
fill the English with the implied form.

Sentence: ${sentence}
`;

export const getTenseHintPrompt = (sentence, language) => `
You are a language expert helping a ${language}-native speaker translate to English.

The ${language} sentence below does not mark tense morphologically. Decide what
English tense fits the scene the sentence describes.

Return ONLY a JSON object:
{
  "tense": "<one of: simple-present, present-continuous, present-perfect, present-perfect-continuous, simple-past, past-continuous, past-perfect, past-perfect-continuous, simple-future, future-continuous, future-perfect, conditional>",
  "justification": "<one sentence explaining which clue in the ${language} sentence points to this tense — usually an aspect marker (了/着/过), an adverb of time, or the discourse context>"
}

Sentence: ${sentence}
`;

export const getTranslateComparePrompt = (sentence, attempt, language) => `
You are a translation tutor. Compare the LEARNER's English attempt against a
high-quality model translation of the ${language} sentence below.

For each WEAKNESS in the learner's English, label it with ONE of these six closed buckets:
- "tense" — wrong tense or aspect mapping (especially of ${language} aspect markers like 了/着/过)
- "word-order" — element in wrong English slot (time/place adverbials, S-V-O position, attributive clause placement)
- "article-number" — missing/wrong a/an/the, missing plural -s
- "preposition-collocation" — wrong preposition or weak verb-noun pairing
- "connector-cohesion" — missing because/although/while etc. that ${language} parataxis often omits
- "idiom-register" — word-for-word translation of an idiom, or register mismatch

Also produce the 5-step pedagogical breakdown of how the MODEL English was built.

Return ONLY a JSON object:
{
  "modelEnglish": "<the model translation>",
  "spans": [
    {
      "side": "learner" | "model",
      "text": "<exact substring of side's text>",
      "bucket": "tense" | "word-order" | "article-number" | "preposition-collocation" | "connector-cohesion" | "idiom-register",
      "kind": "weaker",
      "pair_id": "<string, links learner side to model side for hover-pairing>",
      "reason": "<1-2 sentences explaining why the model phrasing is stronger; phrase as advice the learner can apply>"
    }
  ],
  "stepBreakdown": {
    "step-1": { "title": "...", "sub-verb-obj-list": [...], "explain": "..." },
    "step-2": { "title": "...", "input-verb-list": [...], "explain": "..." },
    "step-3": { "title": "...", "scaffold-options": [...], "best-scaffold": "...", "explain": "..." },
    "step-4": { "title": "...", "sentence-structure": "...", "explain": "..." },
    "step-5": { "title": "...", "output": "<the model English>", "explain": "..." }
  }
}

${language} sentence: ${sentence}
Learner's English: ${attempt}
`;

export const getTranslateParagraphComparePrompt = (paragraph, attempt, language) => `
You are a translation tutor. Compare the LEARNER's English paragraph against a
model translation of the ${language} paragraph below.

Label weaknesses against the SAME 6-bucket taxonomy as the sentence-level prompt:
- "tense", "word-order", "article-number", "preposition-collocation", "connector-cohesion", "idiom-register"

At paragraph scale, give EXTRA weight to:
- "connector-cohesion" (${language} parataxis often drops connectors English requires)
- "idiom-register" (style consistency across sentences)
- paragraph-level "word-order" (information flow, topic-comment shifts)

Group weaknesses by sentence so the UI can render side-by-side per sentence.

Return ONLY a JSON object:
{
  "modelEnglish": "<the model translation paragraph>",
  "spans": [
    { "side": "learner"|"model", "text": "<substring>", "bucket": "<one of 6>", "kind": "weaker", "pair_id": "<string>", "reason": "<1-2 sentences>" }
  ],
  "sentenceComparisons": [
    {
      "sentenceIndex": 0,
      "originalSentence": "<the ${language} sentence>",
      "modelSentence": "<the model English sentence>",
      "learnerSentence": "<the learner's English sentence>",
      "notes": [
        { "pair_id": "<links to spans>", "learner_phrase": "...", "model_phrase": "...", "explanation": "...", "bucket": "<one of 6>" }
      ]
    }
  ]
}

${language} paragraph: ${paragraph}
Learner's English: ${attempt}
`;
