/**
 * LearningPointImporter.test.js
 *
 * Comprehensive tests for the LearningPointImporter service.
 * Tests file parsing (CSV, JSON, TXT), data import, and AI enhancement.
 */

import learningPointImporter, { LearningPointImporter } from '../../main/utils/LearningPointImporter';

describe('LearningPointImporter', () => {
  describe('Singleton Pattern', () => {
    it('should export default instance', () => {
      expect(learningPointImporter).toBeDefined();
      expect(typeof learningPointImporter.parseCSV).toBe('function');
    });

    it('should have all required methods', () => {
      expect(learningPointImporter).toHaveProperty('parseCSV');
      expect(learningPointImporter).toHaveProperty('parseJSON');
      expect(learningPointImporter).toHaveProperty('parsePlainText');
      expect(learningPointImporter).toHaveProperty('autoParse');
      expect(learningPointImporter).toHaveProperty('validateLearningPoints');
      expect(learningPointImporter).toHaveProperty('deduplicate');
    });
  });

  describe('parseCSV()', () => {
    describe('Basic CSV Parsing', () => {
      it('should parse simple CSV with header', () => {
        const content = `word,definition
apple,a fruit
banana,a yellow fruit
cherry,a red fruit`;

        const results = learningPointImporter.parseCSV(content, {
          domainType: 'vocabulary',
        });

        expect(results).toHaveLength(3);
        expect(results[0].front.text).toBe('apple');
        expect(results[0].back.text).toBe('a fruit');
      });

      it('should parse CSV without header', () => {
        const content = `apple,a fruit
banana,a yellow fruit`;

        const results = learningPointImporter.parseCSV(content, {
          hasHeader: false,
          domainType: 'vocabulary',
        });

        expect(results).toHaveLength(2);
        expect(results[0].front.text).toBe('apple');
      });

      it('should handle custom delimiter', () => {
        const content = `word;definition
apple;a fruit
banana;a yellow fruit`;

        const results = learningPointImporter.parseCSV(content, {
          delimiter: ';',
          domainType: 'vocabulary',
        });

        expect(results).toHaveLength(2);
        expect(results[0].front.text).toBe('apple');
        expect(results[0].back.text).toBe('a fruit');
      });

      it('should handle quoted fields', () => {
        const content = `word,definition
apple,"a round, red fruit"
"ice cream","a cold, sweet dessert"`;

        const results = learningPointImporter.parseCSV(content, {
          domainType: 'vocabulary',
        });

        expect(results).toHaveLength(2);
        expect(results[0].back.text).toBe('a round, red fruit');
        expect(results[1].front.text).toBe('ice cream');
      });

      it('should skip empty lines', () => {
        const content = `word,definition
apple,a fruit

banana,a yellow fruit

`;

        const results = learningPointImporter.parseCSV(content, {
          domainType: 'vocabulary',
        });

        expect(results).toHaveLength(2);
      });
    });

    describe('Column Mapping', () => {
      it('should auto-detect word/definition columns', () => {
        const content = `term,meaning,example
apple,a fruit,I ate an apple`;

        const results = learningPointImporter.parseCSV(content, {
          domainType: 'vocabulary',
        });

        expect(results[0].front.text).toBe('apple');
        expect(results[0].back.text).toBe('a fruit');
      });

      it('should use custom column mapping', () => {
        const content = `col1,col2,col3
apple,a fruit,extra`;

        const results = learningPointImporter.parseCSV(content, {
          columnMapping: { front: 1, back: 0 },
          domainType: 'vocabulary',
        });

        expect(results[0].front.text).toBe('a fruit');
        expect(results[0].back.text).toBe('apple');
      });

      it('should extract example sentences if column exists', () => {
        const content = `word,definition,example
apple,a fruit,I ate an apple today`;

        const results = learningPointImporter.parseCSV(content, {
          domainType: 'vocabulary',
        });

        expect(results[0].extras?.exampleSentences).toContain('I ate an apple today');
      });

      it('should extract synonyms if column exists', () => {
        const content = `word,definition,synonym
happy,feeling joy,joyful;cheerful;content`;

        const results = learningPointImporter.parseCSV(content, {
          domainType: 'vocabulary',
        });

        expect(results[0].extras?.synonyms).toContain('joyful');
        expect(results[0].extras?.synonyms).toContain('cheerful');
      });
    });

    describe('Learning Point Structure', () => {
      it('should generate unique IDs', () => {
        const content = `word,definition
apple,a fruit
banana,a yellow fruit`;

        const results = learningPointImporter.parseCSV(content, {
          domainType: 'vocabulary',
        });

        const ids = results.map(r => r.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      });

      it('should set correct item type for vocabulary domain', () => {
        const content = `word,definition
apple,a fruit`;

        const results = learningPointImporter.parseCSV(content, {
          domainType: 'vocabulary',
        });

        expect(results[0].itemType).toBe('word');
      });

      it('should set correct domain type', () => {
        const content = `term,definition
concept1,explanation1`;

        const results = learningPointImporter.parseCSV(content, {
          domainType: 'knowledge',
        });

        expect(results[0].domainType).toBe('knowledge');
        expect(results[0].itemType).toBe('concept');
      });

      it('should initialize learning status fields', () => {
        const content = `word,definition
apple,a fruit`;

        const results = learningPointImporter.parseCSV(content, {
          domainType: 'vocabulary',
        });

        expect(results[0].status).toBe('pending');
        expect(results[0].masteryLevel).toBe(0);
        expect(results[0].reviewCount).toBe(0);
        expect(results[0].correctStreak).toBe(0);
      });

      it('should set source type as manual', () => {
        const content = `word,definition
apple,a fruit`;

        const results = learningPointImporter.parseCSV(content, {
          domainType: 'vocabulary',
        });

        expect(results[0].sourceType).toBe('manual');
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty content', () => {
        const results = learningPointImporter.parseCSV('', {
          domainType: 'vocabulary',
        });

        expect(results).toHaveLength(0);
      });

      it('should handle header-only content', () => {
        const content = `word,definition`;

        const results = learningPointImporter.parseCSV(content, {
          domainType: 'vocabulary',
        });

        expect(results).toHaveLength(0);
      });

      it('should skip rows with empty front text', () => {
        const content = `word,definition
apple,a fruit
,empty front
banana,a yellow fruit`;

        const results = learningPointImporter.parseCSV(content, {
          domainType: 'vocabulary',
        });

        expect(results).toHaveLength(2);
      });

      it('should handle missing definition gracefully', () => {
        const content = `word,definition
apple,
banana,a yellow fruit`;

        const results = learningPointImporter.parseCSV(content, {
          domainType: 'vocabulary',
        });

        expect(results).toHaveLength(2);
        expect(results[0].back.text).toContain('No definition');
      });
    });
  });

  describe('parsePlainText()', () => {
    describe('Basic Text Parsing', () => {
      it('should parse lines with default delimiter', () => {
        const content = `apple - a fruit
banana - a yellow fruit
cherry - a red fruit`;

        const results = learningPointImporter.parsePlainText(content, {
          domainType: 'vocabulary',
        });

        expect(results).toHaveLength(3);
        expect(results[0].front.text).toBe('apple');
        expect(results[0].back.text).toBe('a fruit');
      });

      it('should handle custom delimiter', () => {
        const content = `apple: a fruit
banana: a yellow fruit`;

        const results = learningPointImporter.parsePlainText(content, {
          delimiter: ': ',
          domainType: 'vocabulary',
        });

        expect(results).toHaveLength(2);
        expect(results[0].front.text).toBe('apple');
        expect(results[0].back.text).toBe('a fruit');
      });

      it('should handle lines without delimiter', () => {
        const content = `apple
banana
cherry`;

        const results = learningPointImporter.parsePlainText(content, {
          domainType: 'vocabulary',
        });

        expect(results).toHaveLength(3);
        expect(results[0].front.text).toBe('apple');
        expect(results[0].back.text).toContain('Definition needed');
        expect(results[0].needsDefinition).toBe(true);
      });

      it('should skip empty lines', () => {
        const content = `apple - a fruit

banana - a yellow fruit

`;

        const results = learningPointImporter.parsePlainText(content, {
          domainType: 'vocabulary',
        });

        expect(results).toHaveLength(2);
      });
    });

    describe('Status Handling', () => {
      it('should mark items with definition as pending', () => {
        const content = `apple - a fruit`;

        const results = learningPointImporter.parsePlainText(content, {
          domainType: 'vocabulary',
        });

        expect(results[0].status).toBe('pending');
        expect(results[0].needsDefinition).toBeFalsy();
      });

      it('should mark items without definition as incomplete', () => {
        const content = `apple`;

        const results = learningPointImporter.parsePlainText(content, {
          domainType: 'vocabulary',
        });

        expect(results[0].status).toBe('incomplete');
        expect(results[0].needsDefinition).toBe(true);
      });
    });
  });

  describe('parseJSON()', () => {
    describe('Array Format', () => {
      it('should parse JSON array of objects', () => {
        const content = JSON.stringify([
          { word: 'apple', definition: 'a fruit' },
          { word: 'banana', definition: 'a yellow fruit' },
        ]);

        const results = learningPointImporter.parseJSON(content, {
          domainType: 'vocabulary',
        });

        expect(results).toHaveLength(2);
        expect(results[0].front.text).toBe('apple');
        expect(results[0].back.text).toBe('a fruit');
      });

      it('should handle nested items array', () => {
        const content = JSON.stringify({
          items: [
            { word: 'apple', definition: 'a fruit' },
            { word: 'banana', definition: 'a yellow fruit' },
          ],
        });

        const results = learningPointImporter.parseJSON(content, {
          domainType: 'vocabulary',
        });

        expect(results).toHaveLength(2);
      });

      it('should handle words array', () => {
        const content = JSON.stringify({
          words: [
            { term: 'apple', meaning: 'a fruit' },
          ],
        });

        const results = learningPointImporter.parseJSON(content, {
          domainType: 'vocabulary',
        });

        expect(results).toHaveLength(1);
        expect(results[0].front.text).toBe('apple');
        expect(results[0].back.text).toBe('a fruit');
      });

      it('should handle vocabulary array', () => {
        const content = JSON.stringify({
          vocabulary: [
            { word: 'apple', definition: 'a fruit' },
          ],
        });

        const results = learningPointImporter.parseJSON(content, {
          domainType: 'vocabulary',
        });

        expect(results).toHaveLength(1);
      });
    });

    describe('Field Mapping', () => {
      it('should auto-detect common field names', () => {
        const variations = [
          { word: 'apple', definition: 'a fruit' },
          { term: 'banana', meaning: 'a yellow fruit' },
          { front: 'cherry', back: 'a red fruit' },
          { question: 'What is grape?', answer: 'a small fruit' },
        ];

        variations.forEach(item => {
          const content = JSON.stringify([item]);
          const results = learningPointImporter.parseJSON(content, {
            domainType: 'vocabulary',
          });

          expect(results).toHaveLength(1);
          expect(results[0].front.text).toBeTruthy();
          expect(results[0].back.text).toBeTruthy();
        });
      });

      it('should use custom field mapping', () => {
        const content = JSON.stringify([
          { myWord: 'apple', myDef: 'a fruit' },
        ]);

        const results = learningPointImporter.parseJSON(content, {
          domainType: 'vocabulary',
          fieldMapping: { front: 'myWord', back: 'myDef' },
        });

        expect(results[0].front.text).toBe('apple');
        expect(results[0].back.text).toBe('a fruit');
      });
    });

    describe('Extra Fields', () => {
      it('should extract examples', () => {
        const content = JSON.stringify([
          {
            word: 'apple',
            definition: 'a fruit',
            examples: ['I ate an apple', 'The apple is red'],
          },
        ]);

        const results = learningPointImporter.parseJSON(content, {
          domainType: 'vocabulary',
        });

        expect(results[0].extras?.exampleSentences).toEqual(['I ate an apple', 'The apple is red']);
      });

      it('should extract synonyms', () => {
        const content = JSON.stringify([
          {
            word: 'happy',
            definition: 'feeling joy',
            synonyms: ['joyful', 'cheerful'],
          },
        ]);

        const results = learningPointImporter.parseJSON(content, {
          domainType: 'vocabulary',
        });

        expect(results[0].extras?.synonyms).toEqual(['joyful', 'cheerful']);
      });

      it('should extract pronunciation', () => {
        const content = JSON.stringify([
          {
            word: 'apple',
            definition: 'a fruit',
            pronunciation: '/ˈæp.əl/',
          },
        ]);

        const results = learningPointImporter.parseJSON(content, {
          domainType: 'vocabulary',
        });

        expect(results[0].extras?.pronunciation).toBe('/ˈæp.əl/');
      });

      it('should preserve difficulty from JSON', () => {
        const content = JSON.stringify([
          {
            word: 'apple',
            definition: 'a fruit',
            difficulty: 'beginner',
          },
        ]);

        const results = learningPointImporter.parseJSON(content, {
          domainType: 'vocabulary',
        });

        expect(results[0].difficulty).toBe('beginner');
      });
    });

    describe('Error Handling', () => {
      it('should return empty array for invalid JSON', () => {
        const content = 'not valid json {{{';

        const results = learningPointImporter.parseJSON(content, {
          domainType: 'vocabulary',
        });

        expect(results).toHaveLength(0);
      });

      it('should skip items with empty front text', () => {
        const content = JSON.stringify([
          { word: '', definition: 'a fruit' },
          { word: 'banana', definition: 'a yellow fruit' },
        ]);

        const results = learningPointImporter.parseJSON(content, {
          domainType: 'vocabulary',
        });

        expect(results).toHaveLength(1);
        expect(results[0].front.text).toBe('banana');
      });
    });
  });

  describe('importFromVocabulary()', () => {
    it('should convert vocabulary items to learning points', () => {
      const vocabularyItems = [
        { id: 1, word: 'apple', definition: 'a fruit', example: 'I ate an apple' },
        { id: 2, word: 'banana', definition: 'a yellow fruit' },
      ];

      const results = learningPointImporter.importFromVocabulary(vocabularyItems);

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('apple');
      expect(results[0].sourceType).toBe('vocabulary');
      expect(results[0].sourceId).toBe('1');
    });

    it('should extract example sentences', () => {
      const vocabularyItems = [
        { id: 1, word: 'apple', definition: 'a fruit', example: 'I ate an apple' },
      ];

      const results = learningPointImporter.importFromVocabulary(vocabularyItems);

      expect(results[0].extras?.exampleSentences).toContain('I ate an apple');
    });

    it('should parse relatedWords as JSON', () => {
      const vocabularyItems = [
        {
          id: 1,
          word: 'happy',
          definition: 'feeling joy',
          relatedWords: '["joyful", "cheerful"]',
        },
      ];

      const results = learningPointImporter.importFromVocabulary(vocabularyItems);

      expect(results[0].extras?.synonyms).toEqual(['joyful', 'cheerful']);
    });

    it('should parse relatedWords as comma-separated string', () => {
      const vocabularyItems = [
        {
          id: 1,
          word: 'happy',
          definition: 'feeling joy',
          relatedWords: 'joyful, cheerful',
        },
      ];

      const results = learningPointImporter.importFromVocabulary(vocabularyItems);

      expect(results[0].extras?.synonyms).toContain('joyful');
      expect(results[0].extras?.synonyms).toContain('cheerful');
    });
  });

  describe('importFromNotes()', () => {
    it('should convert notes to learning points', () => {
      const notes = [
        {
          id: 1,
          title: 'Important Concept',
          cards: [
            { text: 'What is X?' },
            { text: 'X is...' },
          ],
        },
      ];

      const results = learningPointImporter.importFromNotes(notes);

      expect(results).toHaveLength(1);
      expect(results[0].sourceType).toBe('note');
      expect(results[0].sourceId).toBe('1');
      expect(results[0].itemType).toBe('concept');
    });

    it('should use note title as front if cards are empty', () => {
      const notes = [
        {
          id: 1,
          title: 'Important Concept',
          cards: [],
        },
      ];

      const results = learningPointImporter.importFromNotes(notes);

      expect(results[0].front.text).toBe('Important Concept');
    });

    it('should extract content from note cards', () => {
      const notes = [
        {
          id: 1,
          title: '',
          cards: [
            { text: 'Front content' },
            { text: 'Back content' },
          ],
        },
      ];

      const results = learningPointImporter.importFromNotes(notes);

      expect(results[0].front.text).toBe('Front content');
      expect(results[0].back.text).toBe('Back content');
    });

    it('should skip notes with no content', () => {
      const notes = [
        { id: 1, title: '', cards: [] },
        { id: 2, title: 'Valid Note', cards: [{ text: 'Content' }] },
      ];

      const results = learningPointImporter.importFromNotes(notes);

      expect(results).toHaveLength(1);
      expect(results[0].sourceId).toBe('2');
    });
  });

  describe('importFromBookChunks()', () => {
    it('should convert book chunks to learning points', () => {
      const chunks = [
        {
          id: 'chunk_1',
          bookId: 'book_1',
          text: 'This is the content of the chunk...',
          chunkIndex: 0,
          sectionTitle: 'Chapter 1',
        },
      ];

      const results = learningPointImporter.importFromBookChunks(chunks);

      expect(results).toHaveLength(1);
      expect(results[0].sourceType).toBe('book_chunk');
      expect(results[0].chunkId).toBe('chunk_1');
      expect(results[0].needsSummary).toBe(true);
    });

    it('should use section title as learning point title', () => {
      const chunks = [
        {
          id: 'chunk_1',
          text: 'Content...',
          chunkIndex: 0,
          sectionTitle: 'Introduction to Algorithms',
        },
      ];

      const results = learningPointImporter.importFromBookChunks(chunks);

      expect(results[0].title).toBe('Introduction to Algorithms');
    });

    it('should include related concepts if provided', () => {
      const chunks = [
        {
          id: 'chunk_1',
          text: 'This chunk discusses algorithms and data structures.',
          chunkIndex: 0,
        },
      ];

      const concepts = [
        { name: 'algorithms' },
        { name: 'data structures' },
        { name: 'complexity' },
      ];

      const results = learningPointImporter.importFromBookChunks(chunks, concepts);

      expect(results[0].relatedConcepts).toContain('algorithms');
      expect(results[0].relatedConcepts).toContain('data structures');
      expect(results[0].relatedConcepts).not.toContain('complexity');
    });

    it('should store raw content for summary generation', () => {
      const chunks = [
        {
          id: 'chunk_1',
          text: 'Raw content for processing...',
          chunkIndex: 0,
        },
      ];

      const results = learningPointImporter.importFromBookChunks(chunks);

      expect(results[0].rawContent).toBe('Raw content for processing...');
    });
  });

  describe('detectFormat()', () => {
    it('should detect JSON array', () => {
      const content = '[{"word": "apple"}]';
      expect(learningPointImporter.detectFormat(content)).toBe('json');
    });

    it('should detect JSON object', () => {
      const content = '{"items": []}';
      expect(learningPointImporter.detectFormat(content)).toBe('json');
    });

    it('should detect CSV', () => {
      const content = `word,definition,example
apple,a fruit,I ate an apple`;
      expect(learningPointImporter.detectFormat(content)).toBe('csv');
    });

    it('should detect TSV', () => {
      const content = `word\tdefinition
apple\ta fruit`;
      expect(learningPointImporter.detectFormat(content)).toBe('tsv');
    });

    it('should detect plain text', () => {
      const content = `apple - a fruit
banana - a yellow fruit`;
      expect(learningPointImporter.detectFormat(content)).toBe('text');
    });

    it('should detect plain text for word list', () => {
      const content = `apple
banana
cherry`;
      expect(learningPointImporter.detectFormat(content)).toBe('text');
    });
  });

  describe('autoParse()', () => {
    it('should auto-parse JSON', () => {
      const content = JSON.stringify([{ word: 'apple', definition: 'a fruit' }]);

      const results = learningPointImporter.autoParse(content, {
        domainType: 'vocabulary',
      });

      expect(results).toHaveLength(1);
      expect(results[0].front.text).toBe('apple');
    });

    it('should auto-parse CSV', () => {
      const content = `word,definition
apple,a fruit`;

      const results = learningPointImporter.autoParse(content, {
        domainType: 'vocabulary',
      });

      expect(results).toHaveLength(1);
      expect(results[0].front.text).toBe('apple');
    });

    it('should auto-parse TSV', () => {
      const content = `word\tdefinition
apple\ta fruit`;

      const results = learningPointImporter.autoParse(content, {
        domainType: 'vocabulary',
      });

      expect(results).toHaveLength(1);
      expect(results[0].front.text).toBe('apple');
    });

    it('should auto-parse plain text', () => {
      const content = `apple - a fruit`;

      const results = learningPointImporter.autoParse(content, {
        domainType: 'vocabulary',
      });

      expect(results).toHaveLength(1);
      expect(results[0].front.text).toBe('apple');
    });
  });

  describe('validateLearningPoints()', () => {
    it('should separate valid and invalid learning points', () => {
      const learningPoints = [
        { id: '1', front: { text: 'valid' }, itemType: 'word', domainType: 'vocabulary' },
        { id: '2', front: { text: '' }, itemType: 'word', domainType: 'vocabulary' },
        { id: '3', front: { text: 'missing type' }, domainType: 'vocabulary' },
      ];

      const { valid, invalid } = learningPointImporter.validateLearningPoints(learningPoints);

      expect(valid).toHaveLength(1);
      expect(invalid).toHaveLength(2);
    });

    it('should report specific errors', () => {
      const learningPoints = [
        { id: '1', front: { text: '' }, itemType: 'word' },
      ];

      const { invalid } = learningPointImporter.validateLearningPoints(learningPoints);

      expect(invalid[0].errors).toContain('Missing front text');
      expect(invalid[0].errors).toContain('Missing domain type');
    });

    it('should pass valid learning points', () => {
      const learningPoints = [
        {
          id: '1',
          front: { text: 'apple' },
          back: { text: 'a fruit' },
          itemType: 'word',
          domainType: 'vocabulary',
        },
      ];

      const { valid, invalid } = learningPointImporter.validateLearningPoints(learningPoints);

      expect(valid).toHaveLength(1);
      expect(invalid).toHaveLength(0);
    });
  });

  describe('deduplicate()', () => {
    it('should remove duplicate learning points by front text', () => {
      const learningPoints = [
        { id: '1', front: { text: 'apple' } },
        { id: '2', front: { text: 'Apple' } }, // Same, different case
        { id: '3', front: { text: 'banana' } },
        { id: '4', front: { text: 'apple' } }, // Duplicate
      ];

      const unique = learningPointImporter.deduplicate(learningPoints);

      expect(unique).toHaveLength(2);
      expect(unique.map(lp => lp.front.text.toLowerCase())).toContain('apple');
      expect(unique.map(lp => lp.front.text.toLowerCase())).toContain('banana');
    });

    it('should keep first occurrence', () => {
      const learningPoints = [
        { id: '1', front: { text: 'apple' }, back: { text: 'first' } },
        { id: '2', front: { text: 'apple' }, back: { text: 'second' } },
      ];

      const unique = learningPointImporter.deduplicate(learningPoints);

      expect(unique).toHaveLength(1);
      expect(unique[0].back.text).toBe('first');
    });

    it('should handle empty array', () => {
      const unique = learningPointImporter.deduplicate([]);
      expect(unique).toHaveLength(0);
    });

    it('should skip items with no front text', () => {
      const learningPoints = [
        { id: '1', front: { text: '' } },
        { id: '2', front: { text: 'apple' } },
      ];

      const unique = learningPointImporter.deduplicate(learningPoints);

      expect(unique).toHaveLength(1);
      expect(unique[0].id).toBe('2');
    });
  });

  describe('inferItemType()', () => {
    it('should return word for vocabulary domain', () => {
      expect(learningPointImporter.inferItemType('vocabulary')).toBe('word');
    });

    it('should return formula for math domain', () => {
      expect(learningPointImporter.inferItemType('math')).toBe('formula');
    });

    it('should return rule for language domain', () => {
      expect(learningPointImporter.inferItemType('language')).toBe('rule');
    });

    it('should return concept for knowledge domain', () => {
      expect(learningPointImporter.inferItemType('knowledge')).toBe('concept');
    });

    it('should return technique for skill domain', () => {
      expect(learningPointImporter.inferItemType('skill')).toBe('technique');
    });

    it('should return concept for unknown domain', () => {
      expect(learningPointImporter.inferItemType('unknown')).toBe('concept');
    });
  });

  describe('AI Enhancement', () => {
    describe('setAIProvider()', () => {
      it('should set the AI provider', () => {
        const mockProvider = { generateContentWithJson: jest.fn() };
        learningPointImporter.setAIProvider(mockProvider);
        expect(learningPointImporter.aiProvider).toBe(mockProvider);
      });
    });

    describe('enhanceWithAI()', () => {
      it('should return original items when no AI provider', async () => {
        learningPointImporter.setAIProvider(null);

        const items = [
          { id: '1', front: { text: 'apple' }, needsDefinition: true },
        ];

        const results = await learningPointImporter.enhanceWithAI(items);

        expect(results).toEqual(items);
      });

      it('should skip items that do not need enhancement', async () => {
        const mockProvider = {
          generateContentWithJson: jest.fn(),
        };
        learningPointImporter.setAIProvider(mockProvider);

        const items = [
          { id: '1', front: { text: 'apple' }, back: { text: 'a fruit' } },
        ];

        await learningPointImporter.enhanceWithAI(items);

        expect(mockProvider.generateContentWithJson).not.toHaveBeenCalled();
      });

      it('should call AI for items needing definition', async () => {
        const mockProvider = {
          generateContentWithJson: jest.fn().mockResolvedValue({
            definition: 'a fruit',
            example: 'I ate an apple',
            synonyms: ['fruit'],
          }),
        };
        learningPointImporter.setAIProvider(mockProvider);

        const items = [
          { id: '1', front: { text: 'apple' }, needsDefinition: true },
        ];

        const results = await learningPointImporter.enhanceWithAI(items);

        expect(mockProvider.generateContentWithJson).toHaveBeenCalled();
        expect(results[0].back.text).toBe('a fruit');
        expect(results[0].needsDefinition).toBe(false);
      });

      it('should call progress callback', async () => {
        const mockProvider = {
          generateContentWithJson: jest.fn().mockResolvedValue({
            definition: 'a fruit',
          }),
        };
        learningPointImporter.setAIProvider(mockProvider);

        const items = [
          { id: '1', title: 'apple', front: { text: 'apple' }, needsDefinition: true },
          { id: '2', title: 'banana', front: { text: 'banana' }, needsDefinition: true },
        ];

        const progressCallback = jest.fn();

        await learningPointImporter.enhanceWithAI(items, {}, progressCallback);

        expect(progressCallback).toHaveBeenCalledTimes(2);
        expect(progressCallback).toHaveBeenCalledWith({
          completed: 1,
          total: 2,
          current: 'apple',
        });
      });
    });
  });
});
