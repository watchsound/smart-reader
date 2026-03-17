/**
 * TranslateSkill - Multi-step translation learning
 *
 * Guides users through structured translation from Chinese/Japanese to English
 * using a 5-step methodology:
 * 1. Extract SVO structure
 * 2. Analyze verbs
 * 3. Build English scaffold
 * 4. Select sentence pattern
 * 5. Expand to full translation
 *
 * Optionally includes NLP analysis (tokenization, POS, dependencies).
 */

const BaseSkill = require('../BaseSkill');

class TranslateSkill extends BaseSkill {
  static get name() {
    return 'translate';
  }

  static get description() {
    return 'Guide through structured translation from Chinese or Japanese to English using a 5-step methodology. Extracts SVO structure, analyzes verbs, builds scaffolds, and produces final translation with explanations.';
  }

  static get parameters() {
    return {
      text: {
        type: 'string',
        description: 'The text to translate (Chinese or Japanese)',
      },
      sourceLanguage: {
        type: 'string',
        enum: ['Chinese', 'Japanese'],
        default: 'Chinese',
        description: 'Source language of the text',
      },
      includeNLP: {
        type: 'boolean',
        default: false,
        description:
          'Include NLP analysis (tokenization, POS, dependencies) for the translated output',
      },
      mode: {
        type: 'string',
        enum: ['full', 'simple'],
        default: 'full',
        description:
          'full = 5-step breakdown with detailed analysis, simple = direct translation with brief explanation',
      },
    };
  }

  static get requiredParams() {
    return ['text'];
  }

  static get category() {
    return 'ai';
  }

  async execute({
    text,
    sourceLanguage = 'Chinese',
    includeNLP = false,
    mode = 'full',
  }) {
    const aiProvider = this.getAIProvider();
    if (!aiProvider) {
      throw new Error('AI provider not available');
    }

    if (mode === 'simple') {
      return this.executeSimpleMode(text, sourceLanguage, aiProvider);
    }

    return this.executeFullMode(text, sourceLanguage, includeNLP, aiProvider);
  }

  /**
   * Simple mode - direct translation with brief explanation
   */
  async executeSimpleMode(text, sourceLanguage, aiProvider) {
    const prompt = this.buildSimplePrompt(text, sourceLanguage);
    const response = await aiProvider.generateContent(prompt);
    const result = this.parseSimpleResponse(response);

    this.logExecution(
      { textLength: text.length, sourceLanguage, mode: 'simple' },
      { hasTranslation: !!result.translation },
    );

    return {
      inputSentence: text,
      sourceLanguage,
      mode: 'simple',
      translation: result.translation,
      explanation: result.explanation,
    };
  }

  /**
   * Full mode - 5-step translation breakdown
   */
  async executeFullMode(text, sourceLanguage, includeNLP, aiProvider) {
    // Get the 5-step translation
    const translatePrompt = this.buildFullPrompt(text, sourceLanguage);
    const translateResponse = await aiProvider.generateContent(translatePrompt);
    const translateResult = this.parseFullResponse(translateResponse);

    let nlpAnalysis = null;

    // Optionally get NLP analysis for the translated output
    if (includeNLP && translateResult.steps?.['step-5']?.output) {
      const nlpPrompt = this.buildNLPPrompt(
        translateResult.steps['step-5'].output,
      );
      const nlpResponse = await aiProvider.generateContent(nlpPrompt);
      nlpAnalysis = this.parseNLPResponse(nlpResponse);
    }

    this.logExecution(
      { textLength: text.length, sourceLanguage, mode: 'full', includeNLP },
      {
        hasSteps: !!translateResult.steps,
        hasNLP: !!nlpAnalysis,
      },
    );

    return {
      inputSentence: text,
      sourceLanguage,
      mode: 'full',
      steps: translateResult.steps,
      nlpAnalysis,
    };
  }

  buildSimplePrompt(text, sourceLanguage) {
    return `
You are a language expert. Translate the following ${sourceLanguage} text to English.

Provide:
1. The English translation
2. A brief explanation of the translation choices

Text to translate:
${text}

Response in JSON format:
{
  "translation": "The English translation",
  "explanation": "Brief explanation of translation choices"
}
`;
  }

  buildFullPrompt(text, sourceLanguage) {
    // This is the detailed 5-step translation prompt
    // Reusing the pattern from getTranslatePrompt in AIPrompts.js
    return `
You are a language expert, adept at teaching students how to translate from ${sourceLanguage} to English.

The difference between ${sourceLanguage} and English expression lies in that ${sourceLanguage} often emphasize an entire scene for a single sentence, where the elements within the scene lack prominent logic relationships. In contrast, English states a fact in a single sentence, unfolding from the core scaffold of actor-action-result.
To overcome the cognitive differences between ${sourceLanguage} and English, when translating from ${sourceLanguage} to English, we need to first extract the basic subject-verb-object structure from ${sourceLanguage} and then expand it into English expression.

###
A. step-1: Extract the basic subject-verb-object structure from ${sourceLanguage} sentence.
If there exists more than one sub-verb-obj structures, list all of them.

B. step-2: Consider the extracted verbs, and think about their corresponding English verb phrase expressions. If there are several options,
choose one that conforms to English expression conventions.

C. step-3: Write down scaffold of english expression. If there are several options, choose one that conforms to English expression conventions.
Select sentence structure from common English sentence patterns.

D. step-4: Think about most suitable sentence pattern which will be used for the final translated whole sentence.
Here are list of common patterns:
1. Simple Sentence
2. Compound Sentence
3. Complex Sentence
4. Compound-Complex Sentence
5. Relative Clause
6. Noun Clause
7. Adverbial Clause
8. Direct and Indirect Speech
9. Imperative Sentence
10. Exclamatory Sentence
11. Passive Voice
12. Comparative and Superlative
13. Conditional Sentence
14. Participle Construction

E. step-5: Expand from the basic framework to include time, place, and modifiers (adverbs and adjectives).

Response with JSON object:
{
  "input-sentence": "${text}",
  "step-1": {
    "title": "Extract SVO Structure",
    "sub-verb-obj-list": [
      {
        "subject": { "input": "原文主语", "english": "English subject" },
        "verb": { "input": "原文动词", "english": ["verb option 1", "verb option 2"] },
        "object": { "input": "原文宾语", "english": "English object" }
      }
    ],
    "explain": "Explanation in ${sourceLanguage}"
  },
  "step-2": {
    "title": "Analyze Verbs",
    "input-verb-list": [
      { "input-verb": "原文动词", "english-verb-options": ["option1", "option2"] }
    ],
    "explain": "Explanation in ${sourceLanguage}"
  },
  "step-3": {
    "title": "Build Scaffold",
    "scaffold-options": ["Option 1", "Option 2"],
    "best-scaffold": "Best scaffold choice",
    "explain": "Explanation in ${sourceLanguage}"
  },
  "step-4": {
    "title": "Select Sentence Pattern",
    "sentence-structure": "Pattern name",
    "explain": "Explanation in ${sourceLanguage}"
  },
  "step-5": {
    "title": "Final Translation",
    "output": "The complete English translation",
    "explain": "Explanation in ${sourceLanguage}"
  }
}

NOTE: Attribute values of "explain" in JSON should use ${sourceLanguage} to express.

###
Using this approach, please explain the following ${sourceLanguage}-to-English translation:

${text}
`;
  }

  buildNLPPrompt(sentence) {
    return `
Please perform NLP analysis on this English sentence: tokenize, assign POS tags, analyze Named Entities, Dependencies, and Coreferences.

Response in JSON format:
{
  "sentence": "${sentence}",
  "tokens": [
    {
      "text": "word",
      "pos": "POS tag (e.g., VBD, NN, PRP)",
      "ner": "NER tag (e.g., O, PERSON, ORG)",
      "dependency": "dependency relation (e.g., nsubj, ROOT)",
      "index": 1,
      "head": "head word"
    }
  ],
  "coreferences": [
    {
      "coref_chain": 1,
      "mentions": [
        { "text": "mention text", "start_index": 0, "end_index": 0, "type": "proper/pronoun" }
      ]
    }
  ]
}

Sentence to analyze:
${sentence}
`;
  }

  parseSimpleResponse(response) {
    let textContent = this.extractTextContent(response);

    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          translation: parsed.translation || '',
          explanation: parsed.explanation || '',
        };
      }
    } catch (e) {
      console.warn('Could not parse simple translate response as JSON:', e);
    }

    // Fallback
    return {
      translation: textContent,
      explanation: '',
    };
  }

  parseFullResponse(response) {
    let textContent = this.extractTextContent(response);

    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // Normalize step keys (handle both "step-1" and "step1" formats)
        const steps = {};
        for (let i = 1; i <= 5; i++) {
          const key = `step-${i}`;
          const altKey = `step${i}`;
          steps[key] = parsed[key] || parsed[altKey] || null;
        }

        return { steps };
      }
    } catch (e) {
      console.warn('Could not parse full translate response as JSON:', e);
    }

    return { steps: null, rawResponse: textContent };
  }

  parseNLPResponse(response) {
    let textContent = this.extractTextContent(response);

    try {
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          sentence: parsed.sentence || '',
          tokens: parsed.tokens || [],
          coreferences: parsed.coreferences || [],
        };
      }
    } catch (e) {
      console.warn('Could not parse NLP response as JSON:', e);
    }

    return null;
  }

  extractTextContent(response) {
    if (Array.isArray(response)) {
      return response
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');
    }
    if (response?.text) {
      return response.text;
    }
    return String(response);
  }
}

module.exports = TranslateSkill;
