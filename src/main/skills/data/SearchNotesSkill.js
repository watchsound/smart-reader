/**
 * SearchNotesSkill - Search user's notes
 *
 * Supports keyword and semantic search.
 * Can filter by source type, tags, date range.
 */

const BaseSkill = require('../BaseSkill');

class SearchNotesSkill extends BaseSkill {
  static get name() {
    return 'search_notes';
  }

  static get description() {
    return "Search the user's notes by keyword or semantic similarity. Can filter by source type and other criteria.";
  }

  static get parameters() {
    return {
      query: {
        type: 'string',
        description: 'Search query text',
      },
      searchType: {
        type: 'string',
        enum: ['keyword', 'semantic'],
        default: 'keyword',
        description: 'Type of search to perform',
      },
      limit: {
        type: 'number',
        default: 10,
        description: 'Maximum number of results to return',
      },
      sourceType: {
        type: 'string',
        enum: ['all', 'book', 'bookmark', 'chat', 'manual'],
        default: 'all',
        description: 'Filter by note source type',
      },
    };
  }

  static get requiredParams() {
    return ['query'];
  }

  static get category() {
    return 'data';
  }

  /**
   * Check if search is available (noteManager must be present)
   */
  static isAvailable(context) {
    return !!context.noteManager || !!context.services?.noteManager;
  }

  async execute({
    query,
    searchType = 'keyword',
    limit = 10,
    sourceType = 'all',
  }) {
    const noteManager =
      this.context.noteManager || this.context.services?.noteManager;
    const embeddingSearch =
      this.context.graphEmbeddingManager ||
      this.context.services?.graphEmbeddingManager;
    const { token } = this.context;

    if (!noteManager) {
      throw new Error('Note manager not available');
    }

    let notes = [];

    if (searchType === 'semantic' && embeddingSearch) {
      // Semantic search via the graph-backed vector store
      try {
        const results = await embeddingSearch.searchNotes(query, token);
        notes = (results || []).slice(0, limit).map((r) => ({
          id: r.id,
          title: r.title || 'Untitled',
          content: r.content || '',
          score: r.score || 0,
          sourceType: r.sourceType || 'unknown',
        }));
      } catch (e) {
        console.warn(
          'Semantic search failed, falling back to keyword search:',
          e,
        );
        notes = await this.keywordSearch(
          noteManager,
          query,
          limit,
          sourceType,
          token,
        );
      }
    } else {
      notes = await this.keywordSearch(
        noteManager,
        query,
        limit,
        sourceType,
        token,
      );
    }

    this.logExecution(
      { query, searchType, limit },
      { resultCount: notes.length },
    );

    return {
      query,
      searchType,
      resultCount: notes.length,
      notes,
    };
  }

  async keywordSearch(noteManager, query, limit, sourceType, token) {
    // Get notes that match the query
    // This assumes noteManager has a search method
    try {
      if (noteManager.searchNotes) {
        const results = await noteManager.searchNotes(query, {
          limit,
          sourceType: sourceType !== 'all' ? sourceType : undefined,
          token,
        });
        return results;
      }

      // Fallback: get all notes and filter
      const allNotes = (await noteManager.getNotes?.(token)) || [];
      const queryLower = query.toLowerCase();

      return allNotes
        .filter((note) => {
          const matchesQuery =
            note.title?.toLowerCase().includes(queryLower) ||
            note.content?.toLowerCase().includes(queryLower) ||
            note.description?.toLowerCase().includes(queryLower);

          const matchesSource =
            sourceType === 'all' || note.sourceType === sourceType;

          return matchesQuery && matchesSource;
        })
        .slice(0, limit)
        .map((note) => ({
          id: note.id,
          title: note.title || 'Untitled',
          content: note.content?.substring(0, 200) || '',
          sourceType: note.sourceType || 'unknown',
          createdAt: note.createdAt,
        }));
    } catch (e) {
      console.error('Error in keyword search:', e);
      return [];
    }
  }
}

module.exports = SearchNotesSkill;
