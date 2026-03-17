/**
 * CreateNoteSkill - Create notes with AI enhancement
 *
 * Creates notes from selected text or AI-generated content.
 * Supports automatic concept extraction for knowledge graph integration.
 */

const BaseSkill = require('../BaseSkill');

class CreateNoteSkill extends BaseSkill {
  static get name() {
    return 'create_note';
  }

  static get description() {
    return 'Create a new note from text content. Can optionally extract concepts for knowledge graph and generate tags.';
  }

  static get parameters() {
    return {
      content: {
        type: 'string',
        description: 'The text content for the note',
      },
      title: {
        type: 'string',
        description: 'Optional title for the note. If not provided, will be auto-generated.',
      },
      sourceType: {
        type: 'string',
        enum: ['book', 'web', 'chat', 'manual'],
        default: 'manual',
        description: 'The source type of the note',
      },
      sourceId: {
        type: 'string',
        description: 'ID of the source (book ID, URL, chat ID)',
      },
      extractConcepts: {
        type: 'boolean',
        default: false,
        description: 'Whether to extract concepts for knowledge graph',
      },
      generateTags: {
        type: 'boolean',
        default: true,
        description: 'Whether to auto-generate tags',
      },
      leitnerBox: {
        type: 'number',
        default: 1,
        description: 'Initial Leitner box (1-5) for spaced repetition',
      },
    };
  }

  static get requiredParams() {
    return ['content'];
  }

  static get category() {
    return 'data';
  }

  /**
   * Check if note creation is available
   */
  static isAvailable(context) {
    const noteManager = context.noteManager || context.services?.noteManager;
    return !!noteManager;
  }

  async execute({
    content,
    title,
    sourceType = 'manual',
    sourceId,
    extractConcepts = false,
    generateTags = true,
    leitnerBox = 1,
  }) {
    const noteManager = this.context.noteManager || this.context.services?.noteManager;
    const aiProvider = this.context.aiProvider || this.context.services?.aiProvider;
    const token = this.context.token;
    const userId = this.context.userId;

    if (!noteManager) {
      throw new Error('Note manager not available');
    }

    // Auto-generate title if not provided
    let noteTitle = title;
    if (!noteTitle && aiProvider) {
      noteTitle = await this.generateTitle(aiProvider, content);
    } else if (!noteTitle) {
      // Fallback: use first 50 chars
      noteTitle = content.substring(0, 50) + (content.length > 50 ? '...' : '');
    }

    // Generate tags if requested
    let tags = [];
    if (generateTags && aiProvider) {
      tags = await this.generateTags(aiProvider, content);
    }

    // Extract concepts if requested
    let concepts = [];
    if (extractConcepts && aiProvider) {
      concepts = await this.extractConcepts(aiProvider, content);
    }

    // Create the note
    const noteData = {
      title: noteTitle,
      content,
      sourceType,
      sourceId: sourceId || null,
      tags: JSON.stringify(tags),
      concepts: JSON.stringify(concepts),
      leitnerBox,
      nextReviewDate: this.calculateNextReview(leitnerBox),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let noteId;
    try {
      if (noteManager.createNote) {
        noteId = await noteManager.createNote(userId, noteData, token);
      } else if (noteManager.create) {
        noteId = await noteManager.create(noteData, token);
      } else {
        throw new Error('Note manager does not support note creation');
      }
    } catch (e) {
      console.error('Error creating note:', e);
      throw new Error(`Failed to create note: ${e.message}`);
    }

    // Link concepts to knowledge graph if available
    if (concepts.length > 0 && this.context.graphApi) {
      await this.linkConceptsToGraph(noteId, concepts);
    }

    this.logExecution(
      { content: content.substring(0, 100), sourceType, extractConcepts },
      { noteId, conceptCount: concepts.length, tagCount: tags.length },
    );

    return {
      noteId,
      title: noteTitle,
      tags,
      concepts,
      leitnerBox,
      message: `Note created successfully${concepts.length > 0 ? ` with ${concepts.length} concepts extracted` : ''}`,
    };
  }

  async generateTitle(aiProvider, content) {
    try {
      const prompt = `Generate a concise title (max 10 words) for this note content. Return only the title, no quotes or explanation:

${content.substring(0, 500)}`;

      const response = await aiProvider.generateContent(prompt);
      const title = typeof response === 'string' ? response : response[0]?.text || response.text;
      return title.trim().replace(/^["']|["']$/g, ''); // Remove quotes
    } catch (e) {
      console.error('Error generating title:', e);
      return content.substring(0, 50) + '...';
    }
  }

  async generateTags(aiProvider, content) {
    try {
      const prompt = `Extract 3-5 relevant tags from this content. Return as JSON array of strings, e.g., ["tag1", "tag2"]:

${content.substring(0, 500)}`;

      const response = await aiProvider.generateContent(prompt);
      const text = typeof response === 'string' ? response : response[0]?.text || response.text;

      // Parse JSON array from response
      const match = text.match(/\[[\s\S]*?\]/);
      if (match) {
        return JSON.parse(match[0]);
      }
      return [];
    } catch (e) {
      console.error('Error generating tags:', e);
      return [];
    }
  }

  async extractConcepts(aiProvider, content) {
    try {
      const prompt = `Extract key concepts from this text for a knowledge graph. Return as JSON array with format:
[{ "name": "concept name", "type": "category", "importance": 1-5 }]

Types can be: person, place, event, term, theory, method, etc.

Text:
${content.substring(0, 1000)}`;

      const response = await aiProvider.generateContent(prompt);
      const text = typeof response === 'string' ? response : response[0]?.text || response.text;

      // Parse JSON array from response
      const match = text.match(/\[[\s\S]*?\]/);
      if (match) {
        return JSON.parse(match[0]);
      }
      return [];
    } catch (e) {
      console.error('Error extracting concepts:', e);
      return [];
    }
  }

  async linkConceptsToGraph(noteId, concepts) {
    const graphApi = this.context.graphApi || this.context.services?.graphApi;
    const token = this.context.token;

    if (!graphApi?.linkNoteToConcepts) {
      return;
    }

    try {
      await graphApi.linkNoteToConcepts(noteId, concepts, token);
    } catch (e) {
      console.error('Error linking concepts to graph:', e);
      // Don't throw - note was still created successfully
    }
  }

  calculateNextReview(box) {
    const intervals = {
      1: 1,    // 1 day
      2: 3,    // 3 days
      3: 7,    // 1 week
      4: 14,   // 2 weeks
      5: 30,   // 1 month
    };

    const days = intervals[box] || 1;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
  }
}

module.exports = CreateNoteSkill;
