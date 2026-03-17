/**
 * AnnotateSkill - Annotate text for grammatical elements
 *
 * Highlights specific parts of speech or grammatical structures
 * using ${} markers around annotated elements.
 *
 * Supports: Nouns, Verbs, Prepositions, Collocations, Structures
 */

const BaseSkill = require('../BaseSkill');

class AnnotateSkill extends BaseSkill {
  static get name() {
    return 'annotate';
  }

  static get description() {
    return 'Annotate text to highlight specific grammatical elements like nouns, verbs, prepositions, collocations, or syntactic structures.';
  }

  static get parameters() {
    return {
      text: {
        type: 'string',
        description: 'The text to annotate',
      },
      annotationType: {
        type: 'string',
        enum: ['Noun', 'Verb', 'Prepositions', 'Collocations', 'Structures'],
        default: 'Noun',
        description: 'Type of grammatical element to annotate',
      },
    };
  }

  static get requiredParams() {
    return ['text'];
  }

  static get category() {
    return 'ai';
  }

  async execute({ text, annotationType = 'Noun' }) {
    const aiProvider = this.getAIProvider();
    if (!aiProvider) {
      throw new Error('AI provider not available');
    }

    const prompt = this.buildPrompt(text, annotationType);
    const response = await aiProvider.generateContent(prompt);
    const annotatedText = this.parseResponse(response);

    // Extract annotations from the marked text
    const annotations = this.extractAnnotations(annotatedText);

    this.logExecution(
      { textLength: text.length, annotationType },
      { annotationCount: annotations.length },
    );

    return {
      originalText: text,
      annotatedText,
      annotationType,
      annotations,
      annotationCount: annotations.length,
    };
  }

  buildPrompt(text, annotationType) {
    const instructions = {
      Noun: 'Please enclose all nouns with ${}. For example: I love apple -> I love ${apple}.',
      Verb: 'Please enclose all verbs with ${}. For example: I love apple -> I ${love} apple.',
      Prepositions:
        'Please enclose all prepositions with ${}. For example: He is happy with the meat in his mouth. -> He is happy ${with} the meat ${in} his mouth.',
      Collocations:
        'Please annotate all phrases and fixed collocation of prepositions in the text using ${}. For example: He is happy with the meat in his mouth. -> He is ${happy with} the meat in his mouth.',
      Structures:
        'Please annotate all key syntactic structures that form the skeleton of sentences in the text using ${}, such as conjunctions and adverbs. For example: The car not only is economical but also feels good to drive. -> The car ${not only} is economical ${but also} feels good to drive.',
    };

    return `${instructions[annotationType]}

Text to annotate:
${text}

Return only the annotated text with no additional explanation.`;
  }

  parseResponse(response) {
    let textContent = this.extractTextContent(response);

    // Clean up any extra formatting
    return textContent.trim();
  }

  /**
   * Extract annotation positions from annotated text
   */
  extractAnnotations(annotatedText) {
    const annotations = [];
    const regex = /\$\{([^}]+)\}/g;
    let match;
    let offset = 0;

    while ((match = regex.exec(annotatedText)) !== null) {
      const annotatedWord = match[1];
      // Calculate position in original text (without ${} markers)
      const startInAnnotated = match.index;
      // Count previous markers to calculate original position
      const textBefore = annotatedText.substring(0, startInAnnotated);
      const markersBefore = (textBefore.match(/\$\{|\}/g) || []).length;
      const adjustedStart = startInAnnotated - markersBefore;

      annotations.push({
        text: annotatedWord,
        startIndex: adjustedStart - offset,
        endIndex: adjustedStart - offset + annotatedWord.length,
      });

      // Adjust offset for removed markers
      offset += 3; // ${ and }
    }

    return annotations;
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

module.exports = AnnotateSkill;
