/**
 * LearningPointImporter.js
 *
 * Service for importing and parsing learning points from various sources:
 * - CSV/TXT files (vocabulary lists)
 * - JSON files (structured data)
 * - Book chunks (extract concepts)
 * - Existing vocabulary/notes from SQLite
 * - AI generation
 *
 * This service handles the parsing and transformation of raw content
 * into UniversalLearningPoint format.
 */

import { DomainType, DifficultyLevel } from '../../commons/model/LearningDomains';

/**
 * Default card templates by learning point type
 */
const CARD_TEMPLATES = {
  word: {
    frontTemplate: (data) => data.word || data.term,
    backTemplate: (data) => data.definition || data.meaning,
  },
  concept: {
    frontTemplate: (data) => `What is ${data.name || data.concept}?`,
    backTemplate: (data) => data.description || data.explanation,
  },
  formula: {
    frontTemplate: (data) => `Formula for ${data.name}`,
    backTemplate: (data) => data.formula,
  },
  fact: {
    frontTemplate: (data) => data.question || `What is ${data.subject}?`,
    backTemplate: (data) => data.answer || data.fact,
  },
  rule: {
    frontTemplate: (data) => data.name || data.rule,
    backTemplate: (data) => data.explanation || data.example,
  },
};

class LearningPointImporter {
  constructor() {
    this.aiProvider = null;
  }

  /**
   * Set the AI provider for content enhancement
   * @param {Object} aiProvider - AI provider instance
   */
  setAIProvider(aiProvider) {
    this.aiProvider = aiProvider;
  }

  // ===========================================================================
  // FILE PARSING
  // ===========================================================================

  /**
   * Parse a CSV file into learning points
   *
   * @param {string} content - CSV file content
   * @param {Object} options - Parsing options
   * @param {string} options.delimiter - Field delimiter (default: ',')
   * @param {boolean} options.hasHeader - Whether first row is header (default: true)
   * @param {Object} options.columnMapping - Map column indices/names to fields
   * @param {string} options.domainType - Domain type for the learning points
   * @returns {Array} Parsed learning points
   */
  parseCSV(content, options = {}) {
    const {
      delimiter = ',',
      hasHeader = true,
      columnMapping = null,
      domainType = 'vocabulary',
    } = options;

    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    // Parse header if present
    let headers = [];
    let dataStartIndex = 0;

    if (hasHeader) {
      headers = this.parseCSVLine(lines[0], delimiter);
      dataStartIndex = 1;
    }

    // Determine column mapping
    const mapping = columnMapping || this.inferColumnMapping(headers, domainType);

    // Parse data rows
    const learningPoints = [];

    for (let i = dataStartIndex; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i], delimiter);
      if (values.length === 0) continue;

      const lp = this.createLearningPointFromRow(values, mapping, headers, domainType, i);
      if (lp) {
        learningPoints.push(lp);
      }
    }

    return learningPoints;
  }

  /**
   * Parse a single CSV line handling quoted fields
   */
  parseCSVLine(line, delimiter = ',') {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  /**
   * Infer column mapping from headers
   */
  inferColumnMapping(headers, domainType) {
    const mapping = {};
    const headersLower = headers.map(h => h.toLowerCase());

    // Common vocabulary mappings
    const wordAliases = ['word', 'term', 'vocabulary', 'front', 'question'];
    const defAliases = ['definition', 'meaning', 'answer', 'back', 'explanation'];
    const exampleAliases = ['example', 'sentence', 'usage', 'context'];
    const synonymAliases = ['synonym', 'synonyms', 'related'];

    wordAliases.forEach(alias => {
      const idx = headersLower.indexOf(alias);
      if (idx >= 0) mapping.front = idx;
    });

    defAliases.forEach(alias => {
      const idx = headersLower.indexOf(alias);
      if (idx >= 0) mapping.back = idx;
    });

    exampleAliases.forEach(alias => {
      const idx = headersLower.indexOf(alias);
      if (idx >= 0) mapping.example = idx;
    });

    synonymAliases.forEach(alias => {
      const idx = headersLower.indexOf(alias);
      if (idx >= 0) mapping.synonyms = idx;
    });

    // Default: first column is front, second is back
    if (mapping.front === undefined) mapping.front = 0;
    if (mapping.back === undefined) mapping.back = 1;

    return mapping;
  }

  /**
   * Create a learning point from a CSV row
   */
  createLearningPointFromRow(values, mapping, headers, domainType, rowIndex) {
    const frontValue = values[mapping.front] || '';
    const backValue = values[mapping.back] || '';

    if (!frontValue.trim()) return null;

    const id = `import_${Date.now()}_${rowIndex}_${Math.random().toString(36).slice(2, 6)}`;

    const lp = {
      id,
      itemType: this.inferItemType(domainType),
      domainType,
      title: frontValue.substring(0, 100),
      front: { text: frontValue },
      back: { text: backValue || '(No definition provided)' },
      difficulty: 'intermediate',
      estimatedTimeMinutes: domainType === 'vocabulary' ? 1 : 2,
      status: 'pending',
      masteryLevel: 0,
      reviewCount: 0,
      correctStreak: 0,
      sourceType: 'manual',
    };

    // Add extras if available
    const extras = {};
    if (mapping.example !== undefined && values[mapping.example]) {
      extras.exampleSentences = [values[mapping.example]];
    }
    if (mapping.synonyms !== undefined && values[mapping.synonyms]) {
      extras.synonyms = values[mapping.synonyms].split(/[,;]/).map(s => s.trim());
    }
    if (Object.keys(extras).length > 0) {
      lp.extras = extras;
    }

    return lp;
  }

  /**
   * Parse plain text into learning points (one per line)
   *
   * Supported formats:
   * - "word - definition" (dash separator)
   * - "word = definition" (equals separator)
   * - "word: definition" (colon separator)
   * - "word | definition" (pipe separator)
   * - "word\tdefinition" (tab separator)
   *
   * @param {string} content - Plain text content
   * @param {Object} options - Parsing options
   * @param {string} options.delimiter - Delimiter between front and back (auto-detected if not specified)
   * @param {string} options.domainType - Domain type
   * @returns {Array} Parsed learning points
   */
  parsePlainText(content, options = {}) {
    const {
      delimiter = null, // Auto-detect if not specified
      domainType = 'vocabulary',
    } = options;

    const lines = content.split('\n').filter(line => line.trim());
    const learningPoints = [];

    // Common delimiters to try (in order of preference)
    const delimiters = [' - ', ' = ', '=', ': ', ':', ' | ', '|', '\t'];

    // Auto-detect delimiter from first few lines if not specified
    const effectiveDelimiter = delimiter || this.detectDelimiter(lines.slice(0, 5), delimiters);

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Try to split by delimiter
      let front, back;
      const delimiterIndex = trimmed.indexOf(effectiveDelimiter);

      if (delimiterIndex > 0) {
        front = trimmed.substring(0, delimiterIndex).trim();
        back = trimmed.substring(delimiterIndex + effectiveDelimiter.length).trim();
      } else {
        // Try other delimiters as fallback for this specific line
        let found = false;
        for (const d of delimiters) {
          const idx = trimmed.indexOf(d);
          if (idx > 0) {
            front = trimmed.substring(0, idx).trim();
            back = trimmed.substring(idx + d.length).trim();
            found = true;
            break;
          }
        }
        if (!found) {
          // No delimiter found - just use the line as front, back will be empty
          front = trimmed;
          back = '';
        }
      }

      if (!front) return;

      const id = `import_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`;

      learningPoints.push({
        id,
        itemType: this.inferItemType(domainType),
        domainType,
        title: front.substring(0, 100),
        front: { text: front },
        back: { text: back || '(Definition needed)' },
        difficulty: 'intermediate',
        estimatedTimeMinutes: domainType === 'vocabulary' ? 1 : 2,
        status: back ? 'pending' : 'incomplete',
        masteryLevel: 0,
        reviewCount: 0,
        correctStreak: 0,
        sourceType: 'manual',
        needsDefinition: !back,
      });
    });

    return learningPoints;
  }

  /**
   * Parse JSON file into learning points
   *
   * @param {string} content - JSON string
   * @param {Object} options - Parsing options
   * @param {string} options.domainType - Domain type
   * @param {Object} options.fieldMapping - Map JSON fields to learning point fields
   * @returns {Array} Parsed learning points
   */
  parseJSON(content, options = {}) {
    const {
      domainType = 'vocabulary',
      fieldMapping = null,
    } = options;

    let data;
    try {
      data = JSON.parse(content);
    } catch (e) {
      console.error('LearningPointImporter: Invalid JSON:', e);
      return [];
    }

    // Handle different JSON structures
    let items = [];
    if (Array.isArray(data)) {
      items = data;
    } else if (data.items && Array.isArray(data.items)) {
      items = data.items;
    } else if (data.words && Array.isArray(data.words)) {
      items = data.words;
    } else if (data.vocabulary && Array.isArray(data.vocabulary)) {
      items = data.vocabulary;
    } else {
      // Single object
      items = [data];
    }

    const mapping = fieldMapping || this.inferJSONFieldMapping(items[0]);

    return items.map((item, index) => {
      const id = `import_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`;

      const front = this.getNestedValue(item, mapping.front) || '';
      const back = this.getNestedValue(item, mapping.back) || '';

      if (!front) return null;

      const lp = {
        id,
        itemType: this.inferItemType(domainType),
        domainType,
        title: front.substring(0, 100),
        front: { text: front },
        back: { text: back },
        difficulty: item.difficulty || 'intermediate',
        estimatedTimeMinutes: item.timeMinutes || (domainType === 'vocabulary' ? 1 : 2),
        status: 'pending',
        masteryLevel: 0,
        reviewCount: 0,
        correctStreak: 0,
        sourceType: 'manual',
      };

      // Copy any extras
      const extras = {};
      if (item.examples) extras.exampleSentences = item.examples;
      if (item.synonyms) extras.synonyms = item.synonyms;
      if (item.pronunciation) extras.pronunciation = item.pronunciation;
      if (item.etymology) extras.etymology = item.etymology;
      if (Object.keys(extras).length > 0) {
        lp.extras = extras;
      }

      return lp;
    }).filter(Boolean);
  }

  /**
   * Infer JSON field mapping from sample object
   */
  inferJSONFieldMapping(sample) {
    if (!sample) return { front: 'word', back: 'definition' };

    const keys = Object.keys(sample);
    const keysLower = keys.map(k => k.toLowerCase());

    const frontAliases = ['word', 'term', 'front', 'question', 'name', 'concept'];
    const backAliases = ['definition', 'meaning', 'back', 'answer', 'explanation', 'description'];

    let front = 'word';
    let back = 'definition';

    frontAliases.forEach(alias => {
      const idx = keysLower.indexOf(alias);
      if (idx >= 0) front = keys[idx];
    });

    backAliases.forEach(alias => {
      const idx = keysLower.indexOf(alias);
      if (idx >= 0) back = keys[idx];
    });

    return { front, back };
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    if (!path) return undefined;
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }

  /**
   * Detect the most likely delimiter from sample lines
   */
  detectDelimiter(lines, delimiters) {
    const scores = {};
    delimiters.forEach(d => scores[d] = 0);

    for (const line of lines) {
      for (const d of delimiters) {
        const idx = line.indexOf(d);
        // Delimiter should split line roughly in half (not at very start or end)
        if (idx > 2 && idx < line.length - 2) {
          scores[d]++;
        }
      }
    }

    // Find delimiter with highest score
    let bestDelimiter = ' - ';
    let maxScore = 0;
    for (const [d, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        bestDelimiter = d;
      }
    }

    return bestDelimiter;
  }

  // ===========================================================================
  // EXISTING DATA IMPORT
  // ===========================================================================

  /**
   * Import vocabulary items from SQLite vocabulary table
   *
   * @param {Array} vocabularyItems - Items from vocabulary table
   * @returns {Array} Learning points
   */
  importFromVocabulary(vocabularyItems) {
    return vocabularyItems.map((vocab, index) => {
      const id = `vocab_${vocab.id}_${Date.now()}`;

      const lp = {
        id,
        itemType: 'word',
        domainType: 'vocabulary',
        title: vocab.word,
        front: { text: vocab.word },
        back: { text: vocab.definition || '' },
        difficulty: 'intermediate',
        estimatedTimeMinutes: 1,
        status: 'pending',
        masteryLevel: 0,
        reviewCount: 0,
        correctStreak: 0,
        sourceType: 'vocabulary',
        sourceId: String(vocab.id),
      };

      // Add extras
      const extras = {};
      if (vocab.example) extras.exampleSentences = [vocab.example];
      if (vocab.relatedWords) {
        try {
          extras.synonyms = JSON.parse(vocab.relatedWords);
        } catch (e) {
          extras.synonyms = vocab.relatedWords.split(/[,;]/).map(s => s.trim());
        }
      }
      if (Object.keys(extras).length > 0) {
        lp.extras = extras;
      }

      return lp;
    });
  }

  /**
   * Import notes as learning points
   *
   * @param {Array} notes - Notes from note_json table
   * @returns {Array} Learning points
   */
  importFromNotes(notes) {
    return notes.map((note, index) => {
      const id = `note_${note.id}_${Date.now()}`;

      // Extract content from note cards
      let front = note.title || '';
      let back = '';

      if (note.cards && Array.isArray(note.cards)) {
        if (note.cards[0]) front = front || note.cards[0].text || '';
        if (note.cards[1]) back = note.cards[1].text || '';
        if (note.cards[2] && !back) back = note.cards[2].text || '';
      }

      if (!front) return null;

      return {
        id,
        itemType: 'concept',
        domainType: 'knowledge',
        title: front.substring(0, 100),
        front: { text: front },
        back: { text: back },
        difficulty: 'intermediate',
        estimatedTimeMinutes: 2,
        status: 'pending',
        masteryLevel: 0,
        reviewCount: 0,
        correctStreak: 0,
        sourceType: 'note',
        sourceId: String(note.id),
      };
    }).filter(Boolean);
  }

  /**
   * Import from book chunks (create learning points from chunks)
   *
   * @param {Array} chunks - Book chunks from Neo4j
   * @param {Array} concepts - Key concepts for the book
   * @returns {Array} Learning points (one per chunk with summary needed)
   */
  importFromBookChunks(chunks, concepts = []) {
    // This creates "raw" learning points that need AI summary generation
    return chunks.map((chunk, index) => {
      const id = `chunk_${chunk.id}_${Date.now()}`;

      // Find concepts mentioned in this chunk
      const relatedConcepts = concepts.filter(c =>
        chunk.text.toLowerCase().includes(c.name.toLowerCase())
      );

      return {
        id,
        itemType: 'concept',
        domainType: 'knowledge',
        title: chunk.sectionTitle || `Section ${chunk.chunkIndex + 1}`,
        front: {
          text: relatedConcepts.length > 0
            ? `What are the key points about ${relatedConcepts.map(c => c.name).join(', ')}?`
            : `Key points from section ${chunk.chunkIndex + 1}`
        },
        back: { text: '(Summary to be generated)' },
        difficulty: 'intermediate',
        estimatedTimeMinutes: 3,
        status: 'incomplete',
        masteryLevel: 0,
        reviewCount: 0,
        correctStreak: 0,
        sourceType: 'book_chunk',
        sourceId: chunk.bookId,
        chunkId: chunk.id,
        sourceContext: chunk.pageNum ? `Page ${chunk.pageNum}` : undefined,
        needsSummary: true,
        rawContent: chunk.text,
        relatedConcepts: relatedConcepts.map(c => c.name),
      };
    });
  }

  // ===========================================================================
  // AI ENHANCEMENT
  // ===========================================================================

  /**
   * Generate definitions/summaries for learning points that need them
   *
   * @param {Array} learningPoints - Learning points (some may have needsDefinition/needsSummary)
   * @param {Object} options - Options
   * @param {Function} onProgress - Progress callback
   * @returns {Array} Enhanced learning points
   */
  async enhanceWithAI(learningPoints, options = {}, onProgress = null) {
    if (!this.aiProvider) {
      console.warn('LearningPointImporter: No AI provider configured');
      return learningPoints;
    }

    const itemsNeedingEnhancement = learningPoints.filter(
      lp => lp.needsDefinition || lp.needsSummary
    );

    if (itemsNeedingEnhancement.length === 0) {
      return learningPoints;
    }

    const enhanced = [...learningPoints];
    let completed = 0;

    for (const lp of itemsNeedingEnhancement) {
      try {
        let result;

        if (lp.needsDefinition) {
          // Generate definition for vocabulary
          result = await this.generateDefinition(lp);
        } else if (lp.needsSummary) {
          // Generate summary for chunk
          result = await this.generateSummary(lp, options.concepts || []);
        }

        if (result) {
          // Find and update in the enhanced array
          const idx = enhanced.findIndex(e => e.id === lp.id);
          if (idx >= 0) {
            enhanced[idx] = {
              ...enhanced[idx],
              ...result,
              needsDefinition: false,
              needsSummary: false,
              status: 'pending',
            };
          }
        }

        completed++;
        if (onProgress) {
          onProgress({
            completed,
            total: itemsNeedingEnhancement.length,
            current: lp.title,
          });
        }
      } catch (error) {
        console.error(`LearningPointImporter: Error enhancing ${lp.title}:`, error);
      }
    }

    return enhanced;
  }

  /**
   * Generate definition for a vocabulary word
   */
  async generateDefinition(learningPoint) {
    const prompt = `Define the word "${learningPoint.front.text}" concisely.
Include:
1. A clear, simple definition (1-2 sentences)
2. One example sentence
3. 2-3 synonyms (if applicable)

Respond in JSON format:
{
  "definition": "...",
  "example": "...",
  "synonyms": ["...", "..."]
}`;

    try {
      const response = await this.aiProvider.generateContentWithJson(prompt);

      return {
        back: { text: response.definition },
        extras: {
          exampleSentences: response.example ? [response.example] : undefined,
          synonyms: response.synonyms,
        },
      };
    } catch (error) {
      console.error('LearningPointImporter: Error generating definition:', error);
      return null;
    }
  }

  /**
   * Generate summary for a book chunk
   */
  async generateSummary(learningPoint, concepts = []) {
    const conceptList = learningPoint.relatedConcepts?.length > 0
      ? learningPoint.relatedConcepts
      : concepts.slice(0, 10).map(c => c.name);

    const prompt = `Summarize the following text in 2-3 sentences, focusing on the key concepts.
${conceptList.length > 0 ? `Key concepts to focus on: ${conceptList.join(', ')}` : ''}

Text:
${learningPoint.rawContent?.substring(0, 2000) || ''}

Respond in JSON format:
{
  "summary": "...",
  "keyPoints": ["...", "...", "..."],
  "conceptsMentioned": ["...", "..."]
}`;

    try {
      const response = await this.aiProvider.generateContentWithJson(prompt);

      return {
        back: { text: response.summary },
        extras: {
          keyPoints: response.keyPoints,
          relatedConcepts: response.conceptsMentioned,
        },
      };
    } catch (error) {
      console.error('LearningPointImporter: Error generating summary:', error);
      return null;
    }
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Infer item type from domain
   */
  inferItemType(domainType) {
    const typeMap = {
      vocabulary: 'word',
      math: 'formula',
      language: 'rule',
      knowledge: 'concept',
      skill: 'technique',
    };
    return typeMap[domainType] || 'concept';
  }

  /**
   * Detect file format from content
   */
  detectFormat(content) {
    const trimmed = content.trim();

    // Check for JSON
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(trimmed);
        return 'json';
      } catch (e) {
        // Not valid JSON
      }
    }

    // Check for CSV (has commas and consistent column count)
    const lines = trimmed.split('\n').slice(0, 5);
    const commaCountFirst = (lines[0].match(/,/g) || []).length;
    if (commaCountFirst > 0) {
      const isConsistent = lines.every(line =>
        (line.match(/,/g) || []).length === commaCountFirst
      );
      if (isConsistent) return 'csv';
    }

    // Check for TSV
    const tabCountFirst = (lines[0].match(/\t/g) || []).length;
    if (tabCountFirst > 0) {
      return 'tsv';
    }

    // Default to plain text
    return 'text';
  }

  /**
   * Auto-parse content based on detected format
   *
   * @param {string} content - File content
   * @param {Object} options - Parsing options
   * @returns {Array} Parsed learning points
   */
  autoParse(content, options = {}) {
    const format = this.detectFormat(content);

    switch (format) {
      case 'json':
        return this.parseJSON(content, options);
      case 'csv':
        return this.parseCSV(content, { ...options, delimiter: ',' });
      case 'tsv':
        return this.parseCSV(content, { ...options, delimiter: '\t' });
      default:
        return this.parsePlainText(content, options);
    }
  }

  /**
   * Validate learning points
   */
  validateLearningPoints(learningPoints) {
    const valid = [];
    const invalid = [];

    learningPoints.forEach(lp => {
      const errors = [];

      if (!lp.front?.text?.trim()) {
        errors.push('Missing front text');
      }
      if (!lp.itemType) {
        errors.push('Missing item type');
      }
      if (!lp.domainType) {
        errors.push('Missing domain type');
      }

      if (errors.length === 0) {
        valid.push(lp);
      } else {
        invalid.push({ learningPoint: lp, errors });
      }
    });

    return { valid, invalid };
  }

  /**
   * Deduplicate learning points by front text
   */
  deduplicate(learningPoints) {
    const seen = new Set();
    const unique = [];

    learningPoints.forEach(lp => {
      const key = lp.front?.text?.toLowerCase().trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        unique.push(lp);
      }
    });

    return unique;
  }
}

// Export singleton instance
const learningPointImporter = new LearningPointImporter();

export default learningPointImporter;
export { LearningPointImporter };
