export const getNLPAnnotationPrompt = (sentence) => {
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

export const getTranslatePrompt = (sentence, language) => {
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
       "title" : ${language === 'Chinese' ? '提取句子的主谓宾基本结构' : '文の主語・述語・目的語の基本構造を抽出する'},
       "sub-verb-obj-list: [
          {
            "subject" : {
                "input" : "二楼",
                "english" : "the second floor",
            },
              "verb" : {
                "input" : "有",
                "english" : [ "has", "there are" ],
            },
            "object" : {
                "input" : "书",
                "english" : "books",
            },
          },
        ],
        "explain" : "This step abstracts the basic elements of the event.",
    },
    "step-2" :{
       "title" : ${language === 'Chinese' ? '考察谓语动词' : '述語動詞を考察する'},
        "input-verb-list" : [
          {
            "input-verb" : "有",
            "english-verb-options": [ "has", "there are" ],
          },
        ],

       "explain" : "'There are' is commonly used in this scenes.",
    },
    "step-3" :{"
       "title" :  ${language === 'Chinese' ? '选择相应英语翻译的基本结构' : '対応する英語翻訳の基本構造を選択する'},
       "scaffold-options":
         [
         "The second floor has books",
         "There are books on the second floor."
         ],
       "best-scaffold" : "There are books on the second floor.",
       "explain" : ""
    },
    "step-4" :{
       "title" : ${language === 'Chinese' ? '选择句型结构类项' : '文型構造のカテゴリーを選択する'},
       "sentence-structure" : "Simple Sentence",
       "explain" : "",
    },
     "step-5" :{
       "title" : ${language === 'Chinese' ? '从句子的基本结构扩展为完整句子' : '文の基本構造から完全な文へと拡張する'},
       "output" : "There are many books on the second floor of the library.",
       "explain" : "",
    },
}


NOTE: Attribute values  of "explain" in JSON should use ${language} to express.

###
Using this approach, please explain the following ${language}-to-English translation:

${sentence}
  `;
};

export const getVerbComparisonPrompt = (verb1, verb2, language) => {
  return `
     Please compare the different usage of two English verbs, "${verb1}" and "${verb2}", and provide examples. The word count should not be less than 100 words.
     Please explain in ${language} language.
  `;
};

export const getVerbExplainedPrompt = (verb1, language) => {
  return `
     Please describe usage of English verb: "${verb1}", and provide examples. The word count should not be less than 100 words.
     Please explain in ${language} language.
  `;
};
