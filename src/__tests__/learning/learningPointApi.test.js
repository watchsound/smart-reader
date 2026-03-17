/**
 * learningPointApi.test.js
 *
 * Unit tests for the renderer-side API.
 * Tests the IPC interface and helper functions.
 *
 * @jest-environment node
 */

// Setup mock ipcRenderer before any imports
const mockInvoke = jest.fn();
const mockSendSync = jest.fn();

// Mock window.electron at global level
global.window = {
  electron: {
    ipcRenderer: {
      invoke: mockInvoke,
      sendSync: mockSendSync,
    },
  },
};

// Now import the module - it will capture our mocks
const api = require('../../renderer/api/learningPointApi');

describe('learningPointApi', () => {
  beforeEach(() => {
    // Clear all mock data between tests
    mockInvoke.mockClear();
    mockSendSync.mockClear();
  });

  // ==========================================================================
  // CONSTANTS
  // ==========================================================================

  describe('RATINGS constant', () => {
    test('has correct values', () => {
      expect(api.RATINGS.AGAIN).toBe(1);
      expect(api.RATINGS.HARD).toBe(2);
      expect(api.RATINGS.GOOD).toBe(3);
      expect(api.RATINGS.EASY).toBe(4);
    });
  });

  // ==========================================================================
  // CONSTANT GETTERS (Sync IPC)
  // ==========================================================================

  describe('Constant getters (sync IPC)', () => {
    // Note: These functions have internal caching. We need to reset modules
    // to test the IPC calls, but for behavior tests we can use the cached values.

    describe('getItemTypes', () => {
      test('returns item types array', () => {
        // First call may use cache or IPC, just verify return value format
        const result = api.getItemTypes();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('getDomainTypes', () => {
      test('returns domain types array', () => {
        const result = api.getDomainTypes();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('getDifficultyLevels', () => {
      test('returns difficulty levels array', () => {
        const result = api.getDifficultyLevels();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('getFormats', () => {
      test('returns formats array', () => {
        const result = api.getFormats();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('getSourceTypes', () => {
      test('returns source types array', () => {
        const result = api.getSourceTypes();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('fallback defaults', () => {
      test('item types include common values', () => {
        const result = api.getItemTypes();
        expect(result).toContain('word');
        expect(result).toContain('concept');
      });

      test('domain types include common values', () => {
        const result = api.getDomainTypes();
        expect(result).toContain('vocabulary');
        expect(result).toContain('math');
      });

      test('difficulty levels include common values', () => {
        const result = api.getDifficultyLevels();
        expect(result).toContain('beginner');
        expect(result).toContain('intermediate');
      });

      test('formats include common values', () => {
        const result = api.getFormats();
        expect(result).toContain('card');
        expect(result).toContain('mindmap');
      });

      test('source types include common values', () => {
        const result = api.getSourceTypes();
        expect(result).toContain('book');
        expect(result).toContain('url');
      });
    });
  });

  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================

  describe('createLearningPoint', () => {
    test('calls invoke with correct arguments', async () => {
      const point = { title: 'Test', front: 'Q', back: 'A' };
      const token = 'valid-token';
      mockInvoke.mockResolvedValue({ id: 'new-id', ...point });

      const result = await api.createLearningPoint(point, token);

      expect(mockInvoke).toHaveBeenCalledWith('lp-create', point, token);
      expect(result.id).toBe('new-id');
    });

    test('returns resolved value from IPC', async () => {
      const expected = { id: 'lp-123', title: 'Created' };
      mockInvoke.mockResolvedValue(expected);

      const result = await api.createLearningPoint({}, 'token');

      expect(result).toEqual(expected);
    });
  });

  describe('createLearningPointsBatch', () => {
    test('calls invoke with correct arguments', async () => {
      const points = [
        { title: 'Item 1', front: 'Q1', back: 'A1' },
        { title: 'Item 2', front: 'Q2', back: 'A2' },
      ];
      const token = 'valid-token';
      mockInvoke.mockResolvedValue({ created: 2, errors: [] });

      const result = await api.createLearningPointsBatch(points, token);

      expect(mockInvoke).toHaveBeenCalledWith('lp-create-batch', points, token);
      expect(result.created).toBe(2);
    });

    test('handles errors in batch', async () => {
      mockInvoke.mockResolvedValue({ created: 1, errors: ['Failed item 2'] });

      const result = await api.createLearningPointsBatch([{}, {}], 'token');

      expect(result.errors).toHaveLength(1);
    });
  });

  describe('getLearningPoint', () => {
    test('calls invoke with correct arguments', async () => {
      const id = 'item-123';
      const token = 'valid-token';
      mockInvoke.mockResolvedValue({ id, title: 'Test Item' });

      const result = await api.getLearningPoint(id, token);

      expect(mockInvoke).toHaveBeenCalledWith('lp-get', id, token);
      expect(result.title).toBe('Test Item');
    });

    test('returns null for non-existent item', async () => {
      mockInvoke.mockResolvedValue(null);

      const result = await api.getLearningPoint('non-existent', 'token');

      expect(result).toBeNull();
    });
  });

  describe('updateLearningPoint', () => {
    test('calls invoke with correct arguments', async () => {
      const id = 'item-123';
      const updates = { title: 'Updated' };
      const token = 'valid-token';
      mockInvoke.mockResolvedValue({ id, ...updates });

      const result = await api.updateLearningPoint(id, updates, token);

      expect(mockInvoke).toHaveBeenCalledWith('lp-update', id, updates, token);
      expect(result.title).toBe('Updated');
    });

    test('returns updated learning point', async () => {
      const updated = { id: 'lp-1', title: 'New Title', box: 3 };
      mockInvoke.mockResolvedValue(updated);

      const result = await api.updateLearningPoint('lp-1', { title: 'New Title' }, 'token');

      expect(result).toEqual(updated);
    });
  });

  describe('deleteLearningPoint', () => {
    test('calls invoke with soft delete by default', async () => {
      mockInvoke.mockResolvedValue(true);

      const result = await api.deleteLearningPoint('item-123', 'valid-token');

      expect(mockInvoke).toHaveBeenCalledWith('lp-delete', 'item-123', 'valid-token', false);
      expect(result).toBe(true);
    });

    test('calls invoke with hard delete when specified', async () => {
      mockInvoke.mockResolvedValue(true);

      await api.deleteLearningPoint('item-123', 'valid-token', true);

      expect(mockInvoke).toHaveBeenCalledWith('lp-delete', 'item-123', 'valid-token', true);
    });

    test('returns false on failure', async () => {
      mockInvoke.mockResolvedValue(false);

      const result = await api.deleteLearningPoint('invalid', 'token');

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // QUERY OPERATIONS
  // ==========================================================================

  describe('getDueItems', () => {
    test('calls invoke with options', async () => {
      const options = { token: 'valid-token', limit: 20 };
      mockInvoke.mockResolvedValue([{ id: '1' }, { id: '2' }]);

      const result = await api.getDueItems(options);

      expect(mockInvoke).toHaveBeenCalledWith('lp-get-due', options);
      expect(result).toHaveLength(2);
    });

    test('returns empty array when no items due', async () => {
      mockInvoke.mockResolvedValue([]);

      const result = await api.getDueItems({ token: 'token' });

      expect(result).toEqual([]);
    });
  });

  describe('getBySource', () => {
    test('calls invoke with correct arguments', async () => {
      mockInvoke.mockResolvedValue([{ id: '1', source_type: 'book' }]);

      const result = await api.getBySource('book', 'book-123', 'valid-token');

      expect(mockInvoke).toHaveBeenCalledWith('lp-get-by-source', 'book', 'book-123', 'valid-token');
      expect(result).toHaveLength(1);
    });

    test('returns empty array for source with no items', async () => {
      mockInvoke.mockResolvedValue([]);

      const result = await api.getBySource('url', 'url-1', 'token');

      expect(result).toEqual([]);
    });
  });

  describe('getByPlan', () => {
    test('calls invoke with correct arguments', async () => {
      mockInvoke.mockResolvedValue([{ id: '1', plan_id: 'plan-123' }]);

      const result = await api.getByPlan('plan-123', 'valid-token');

      expect(mockInvoke).toHaveBeenCalledWith('lp-get-by-plan', 'plan-123', 'valid-token');
      expect(result).toHaveLength(1);
    });

    test('returns multiple items for plan', async () => {
      mockInvoke.mockResolvedValue([{ id: '1' }, { id: '2' }, { id: '3' }]);

      const result = await api.getByPlan('plan-1', 'token');

      expect(result).toHaveLength(3);
    });
  });

  describe('searchLearningPoints', () => {
    test('calls invoke with correct arguments', async () => {
      mockInvoke.mockResolvedValue([{ id: '1', title: 'Match' }]);

      const result = await api.searchLearningPoints('test', 'valid-token', { limit: 10 });

      expect(mockInvoke).toHaveBeenCalledWith('lp-search', 'test', 'valid-token', { limit: 10 });
      expect(result).toHaveLength(1);
    });

    test('uses empty options by default', async () => {
      mockInvoke.mockResolvedValue([]);

      await api.searchLearningPoints('test', 'valid-token');

      expect(mockInvoke).toHaveBeenCalledWith('lp-search', 'test', 'valid-token', {});
    });

    test('returns empty array for no matches', async () => {
      mockInvoke.mockResolvedValue([]);

      const result = await api.searchLearningPoints('nonexistent', 'token');

      expect(result).toEqual([]);
    });
  });

  describe('getAllLearningPoints', () => {
    test('calls invoke with correct arguments', async () => {
      mockInvoke.mockResolvedValue({
        items: [{ id: '1' }],
        total: 100,
        page: 1,
        pageSize: 50,
      });

      const result = await api.getAllLearningPoints('valid-token', { page: 2 });

      expect(mockInvoke).toHaveBeenCalledWith('lp-get-all', 'valid-token', { page: 2 });
      expect(result.total).toBe(100);
    });

    test('uses empty options by default', async () => {
      mockInvoke.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });

      await api.getAllLearningPoints('token');

      expect(mockInvoke).toHaveBeenCalledWith('lp-get-all', 'token', {});
    });

    test('returns paginated response', async () => {
      mockInvoke.mockResolvedValue({
        items: [{ id: '1' }, { id: '2' }],
        total: 50,
        page: 1,
        pageSize: 20,
      });

      const result = await api.getAllLearningPoints('token', { pageSize: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(50);
      expect(result.pageSize).toBe(20);
    });
  });

  // ==========================================================================
  // SPACED REPETITION OPERATIONS
  // ==========================================================================

  describe('processReview', () => {
    test('calls invoke with correct arguments', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        newBox: 3,
        nextReview: '2024-01-19',
      });

      const result = await api.processReview('item-123', 3, 2500, 'valid-token');

      expect(mockInvoke).toHaveBeenCalledWith('lp-process-review', 'item-123', 3, 2500, 'valid-token');
      expect(result.success).toBe(true);
      expect(result.newBox).toBe(3);
    });

    test('returns updated SR state after review', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        newBox: 5,
        nextReview: '2024-02-01',
        masteryLevel: 90,
      });

      const result = await api.processReview('item-1', 4, 1000, 'token');

      expect(result.newBox).toBe(5);
      expect(result.masteryLevel).toBe(90);
    });

    test('handles demotion to box 1', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        newBox: 1,
        nextReview: '2024-01-16',
      });

      const result = await api.processReview('item-1', 1, 5000, 'token');

      expect(result.newBox).toBe(1);
    });
  });

  describe('resetLearningPoint', () => {
    test('calls invoke with correct arguments', async () => {
      mockInvoke.mockResolvedValue(true);

      const result = await api.resetLearningPoint('item-123', 'valid-token');

      expect(mockInvoke).toHaveBeenCalledWith('lp-reset', 'item-123', 'valid-token');
      expect(result).toBe(true);
    });

    test('returns false on failure', async () => {
      mockInvoke.mockResolvedValue(false);

      const result = await api.resetLearningPoint('invalid', 'token');

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  describe('getStats', () => {
    test('calls invoke with correct arguments', async () => {
      mockInvoke.mockResolvedValue({
        total: 100,
        mastered: 20,
        dueToday: 15,
      });

      const result = await api.getStats('valid-token', { planId: 'plan-123' });

      expect(mockInvoke).toHaveBeenCalledWith('lp-get-stats', 'valid-token', { planId: 'plan-123' });
      expect(result.total).toBe(100);
    });

    test('uses empty options by default', async () => {
      mockInvoke.mockResolvedValue({});

      await api.getStats('valid-token');

      expect(mockInvoke).toHaveBeenCalledWith('lp-get-stats', 'valid-token', {});
    });

    test('returns comprehensive stats', async () => {
      mockInvoke.mockResolvedValue({
        total: 500,
        mastered: 150,
        dueToday: 25,
        byBox: { 1: 50, 2: 100, 3: 100, 4: 100, 5: 150 },
        averageAccuracy: 85,
      });

      const result = await api.getStats('token');

      expect(result.total).toBe(500);
      expect(result.mastered).toBe(150);
      expect(result.byBox['5']).toBe(150);
    });
  });

  describe('getDailyForecast', () => {
    test('calls invoke with correct arguments', async () => {
      mockInvoke.mockResolvedValue({
        '2024-01-15': 5,
        '2024-01-16': 10,
      });

      const result = await api.getDailyForecast('valid-token', 7);

      expect(mockInvoke).toHaveBeenCalledWith('lp-get-forecast', 'valid-token', 7);
      expect(result['2024-01-15']).toBe(5);
    });

    test('uses default 14 days', async () => {
      mockInvoke.mockResolvedValue({});

      await api.getDailyForecast('valid-token');

      expect(mockInvoke).toHaveBeenCalledWith('lp-get-forecast', 'valid-token', 14);
    });

    test('returns forecast for each day', async () => {
      mockInvoke.mockResolvedValue({
        '2024-01-15': 5,
        '2024-01-16': 10,
        '2024-01-17': 8,
      });

      const result = await api.getDailyForecast('token', 3);

      expect(Object.keys(result)).toHaveLength(3);
    });
  });

  // ==========================================================================
  // HELPER FUNCTIONS
  // ==========================================================================

  describe('getContentText', () => {
    test('returns empty string for null/undefined', () => {
      expect(api.getContentText(null)).toBe('');
      expect(api.getContentText(undefined)).toBe('');
    });

    test('returns string content directly', () => {
      expect(api.getContentText('Hello')).toBe('Hello');
    });

    test('extracts text from object', () => {
      expect(api.getContentText({ text: 'Hello' })).toBe('Hello');
    });

    test('falls back to html if no text', () => {
      expect(api.getContentText({ html: '<b>Bold</b>' })).toBe('<b>Bold</b>');
    });

    test('returns empty string for object without text or html', () => {
      expect(api.getContentText({ latex: '$x^2$' })).toBe('');
    });

    test('handles complex content objects', () => {
      expect(api.getContentText({ text: 'Main', html: '<p>Main</p>' })).toBe('Main');
    });
  });

  describe('hasLatex', () => {
    test('returns false for null/undefined', () => {
      expect(api.hasLatex(null)).toBe(false);
      expect(api.hasLatex(undefined)).toBe(false);
    });

    test('detects $ delimiter in string', () => {
      expect(api.hasLatex('This is $x^2$ math')).toBe(true);
      expect(api.hasLatex('No math here')).toBe(false);
    });

    test('detects \\[ delimiter', () => {
      expect(api.hasLatex('Block math \\[x^2\\]')).toBe(true);
    });

    test('detects \\( delimiter', () => {
      expect(api.hasLatex('Inline \\(x^2\\)')).toBe(true);
    });

    test('checks latex property in object', () => {
      expect(api.hasLatex({ latex: '$x^2$' })).toBe(true);
      expect(api.hasLatex({ text: 'no latex' })).toBe(false);
    });

    test('checks text property in object', () => {
      expect(api.hasLatex({ text: 'Has $math$' })).toBe(true);
    });
  });

  describe('hasCode', () => {
    test('returns false for null/undefined', () => {
      expect(api.hasCode(null)).toBe(false);
      expect(api.hasCode(undefined)).toBe(false);
    });

    test('detects ``` in string', () => {
      expect(api.hasCode('Here is ```code```')).toBe(true);
      expect(api.hasCode('No code here')).toBe(false);
    });

    test('detects <code> tag', () => {
      expect(api.hasCode('Inline <code>code</code>')).toBe(true);
    });

    test('checks code property in object', () => {
      expect(api.hasCode({ code: 'print("hello")' })).toBe(true);
      expect(api.hasCode({ text: 'no code' })).toBe(false);
    });
  });

  describe('getDomainColor', () => {
    test('returns color for vocabulary domain', () => {
      const color = api.getDomainColor('vocabulary');
      expect(color.primary).toBe('#4CAF50');
      expect(color.light).toBe('#E8F5E9');
    });

    test('returns color for math domain', () => {
      const color = api.getDomainColor('math');
      expect(color.primary).toBe('#2196F3');
    });

    test('returns color for programming domain', () => {
      const color = api.getDomainColor('programming');
      expect(color.primary).toBe('#607D8B');
    });

    test('returns custom color for unknown domain', () => {
      const color = api.getDomainColor('unknown');
      expect(color.primary).toBe('#9E9E9E');
    });

    test('returns colors for all known domains', () => {
      const domains = ['vocabulary', 'math', 'physics', 'chemistry', 'biology',
                       'language', 'programming', 'knowledge', 'skill', 'history',
                       'geography', 'custom'];
      domains.forEach(domain => {
        const color = api.getDomainColor(domain);
        expect(color.primary).toBeDefined();
        expect(color.light).toBeDefined();
      });
    });
  });

  describe('getBoxLabel', () => {
    test('returns correct label for each box', () => {
      expect(api.getBoxLabel(1)).toBe('New / Learning');
      expect(api.getBoxLabel(2)).toBe('Review');
      expect(api.getBoxLabel(3)).toBe('Growing');
      expect(api.getBoxLabel(4)).toBe('Familiar');
      expect(api.getBoxLabel(5)).toBe('Mastered');
    });

    test('returns Unknown for invalid box', () => {
      expect(api.getBoxLabel(0)).toBe('Unknown');
      expect(api.getBoxLabel(6)).toBe('Unknown');
      expect(api.getBoxLabel(null)).toBe('Unknown');
    });
  });

  describe('getMasteryLevel', () => {
    test('returns Mastered for 90+', () => {
      const result = api.getMasteryLevel(95);
      expect(result.label).toBe('Mastered');
      expect(result.color).toBe('#4CAF50');
    });

    test('returns Proficient for 70-89', () => {
      const result = api.getMasteryLevel(75);
      expect(result.label).toBe('Proficient');
      expect(result.color).toBe('#8BC34A');
    });

    test('returns Developing for 50-69', () => {
      const result = api.getMasteryLevel(55);
      expect(result.label).toBe('Developing');
      expect(result.color).toBe('#FFC107');
    });

    test('returns Learning for 25-49', () => {
      const result = api.getMasteryLevel(30);
      expect(result.label).toBe('Learning');
      expect(result.color).toBe('#FF9800');
    });

    test('returns Beginner for below 25', () => {
      const result = api.getMasteryLevel(10);
      expect(result.label).toBe('Beginner');
      expect(result.color).toBe('#F44336');
    });

    test('handles boundary values correctly', () => {
      expect(api.getMasteryLevel(90).label).toBe('Mastered');
      expect(api.getMasteryLevel(89).label).toBe('Proficient');
      expect(api.getMasteryLevel(70).label).toBe('Proficient');
      expect(api.getMasteryLevel(69).label).toBe('Developing');
      expect(api.getMasteryLevel(50).label).toBe('Developing');
      expect(api.getMasteryLevel(49).label).toBe('Learning');
      expect(api.getMasteryLevel(25).label).toBe('Learning');
      expect(api.getMasteryLevel(24).label).toBe('Beginner');
    });
  });

  // ==========================================================================
  // DEFAULT EXPORT
  // ==========================================================================

  describe('default export', () => {
    test('contains all expected functions', () => {
      expect(api.default).toBeDefined();
      expect(api.default.createLearningPoint).toBeDefined();
      expect(api.default.getLearningPoint).toBeDefined();
      expect(api.default.updateLearningPoint).toBeDefined();
      expect(api.default.deleteLearningPoint).toBeDefined();
      expect(api.default.processReview).toBeDefined();
      expect(api.default.getStats).toBeDefined();
      expect(api.default.getDomainColor).toBeDefined();
      expect(api.default.getBoxLabel).toBeDefined();
      expect(api.default.RATINGS).toBeDefined();
    });

    test('contains all CRUD functions', () => {
      expect(api.default.createLearningPoint).toBeDefined();
      expect(api.default.createLearningPointsBatch).toBeDefined();
      expect(api.default.getLearningPoint).toBeDefined();
      expect(api.default.updateLearningPoint).toBeDefined();
      expect(api.default.deleteLearningPoint).toBeDefined();
    });

    test('contains all query functions', () => {
      expect(api.default.getDueItems).toBeDefined();
      expect(api.default.getBySource).toBeDefined();
      expect(api.default.getByPlan).toBeDefined();
      expect(api.default.searchLearningPoints).toBeDefined();
      expect(api.default.getAllLearningPoints).toBeDefined();
    });

    test('contains all SR functions', () => {
      expect(api.default.processReview).toBeDefined();
      expect(api.default.resetLearningPoint).toBeDefined();
    });

    test('contains all stats functions', () => {
      expect(api.default.getStats).toBeDefined();
      expect(api.default.getDailyForecast).toBeDefined();
    });

    test('contains all helper functions', () => {
      expect(api.default.getContentText).toBeDefined();
      expect(api.default.hasLatex).toBeDefined();
      expect(api.default.hasCode).toBeDefined();
      expect(api.default.getDomainColor).toBeDefined();
      expect(api.default.getBoxLabel).toBeDefined();
      expect(api.default.getMasteryLevel).toBeDefined();
    });

    test('contains all constant getters', () => {
      expect(api.default.getItemTypes).toBeDefined();
      expect(api.default.getDomainTypes).toBeDefined();
      expect(api.default.getDifficultyLevels).toBeDefined();
      expect(api.default.getFormats).toBeDefined();
      expect(api.default.getSourceTypes).toBeDefined();
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge cases', () => {
    test('IPC calls with empty arguments', async () => {
      mockInvoke.mockResolvedValue({ id: 'new' });

      await api.createLearningPoint({}, '');

      expect(mockInvoke).toHaveBeenCalledWith('lp-create', {}, '');
    });

    test('IPC calls return complex nested objects', async () => {
      const complex = {
        id: 'lp-1',
        front: { text: 'Question', latex: '$x$' },
        back: { text: 'Answer', code: 'print()' },
        extras: { quiz: [], mindmap: {} },
      };
      mockInvoke.mockResolvedValue(complex);

      const result = await api.getLearningPoint('lp-1', 'token');

      expect(result.front.latex).toBe('$x$');
      expect(result.back.code).toBe('print()');
    });

    test('multiple concurrent IPC calls', async () => {
      mockInvoke.mockImplementation((channel, ...args) => {
        if (channel === 'lp-get') {
          return Promise.resolve({ id: args[0] });
        }
        return Promise.resolve(null);
      });

      const [result1, result2, result3] = await Promise.all([
        api.getLearningPoint('id-1', 'token'),
        api.getLearningPoint('id-2', 'token'),
        api.getLearningPoint('id-3', 'token'),
      ]);

      expect(result1.id).toBe('id-1');
      expect(result2.id).toBe('id-2');
      expect(result3.id).toBe('id-3');
      expect(mockInvoke).toHaveBeenCalledTimes(3);
    });

    test('handles IPC rejection', async () => {
      mockInvoke.mockRejectedValue(new Error('IPC Error'));

      await expect(api.createLearningPoint({}, 'token')).rejects.toThrow('IPC Error');
    });
  });

  // ==========================================================================
  // STATUS & AVAILABILITY (Neo4j integration)
  // ==========================================================================

  describe('getStatus', () => {
    test('returns status object via sync IPC', () => {
      mockSendSync.mockReturnValue({
        available: true,
        constants: {
          itemTypes: ['word', 'concept'],
          domainTypes: ['vocabulary', 'knowledge'],
        },
      });

      const result = api.getStatus();

      expect(mockSendSync).toHaveBeenCalledWith('lp-status');
      expect(result.available).toBe(true);
      expect(result.constants.itemTypes).toContain('word');
    });

    test('returns fallback when IPC unavailable', () => {
      mockSendSync.mockReturnValue(undefined);

      const result = api.getStatus();

      expect(result.available).toBe(false);
      expect(result.constants).toEqual({});
    });
  });

  describe('isAvailable', () => {
    test('returns true when service is available', () => {
      mockSendSync.mockReturnValue({ available: true, constants: {} });

      const result = api.isAvailable();

      expect(result).toBe(true);
    });

    test('returns false when service is unavailable', () => {
      mockSendSync.mockReturnValue({ available: false });

      const result = api.isAvailable();

      expect(result).toBe(false);
    });

    test('returns false when IPC fails', () => {
      mockSendSync.mockReturnValue(null);

      const result = api.isAvailable();

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  describe('validateLearningPoint', () => {
    test('validates a learning point via sync IPC', () => {
      mockSendSync.mockReturnValue({ valid: true, errors: [] });

      const result = api.validateLearningPoint({ title: 'Test', front: 'Q' });

      expect(mockSendSync).toHaveBeenCalledWith('lp-validate', { title: 'Test', front: 'Q' });
      expect(result.valid).toBe(true);
    });

    test('returns validation errors', () => {
      mockSendSync.mockReturnValue({
        valid: false,
        errors: ['Title is required', 'Invalid itemType'],
      });

      const result = api.validateLearningPoint({});

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });

    test('returns fallback when IPC unavailable', () => {
      mockSendSync.mockReturnValue(undefined);

      const result = api.validateLearningPoint({});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('IPC unavailable');
    });
  });

  // ==========================================================================
  // MIGRATION HELPERS
  // ==========================================================================

  describe('convertFromVocabulary', () => {
    test('converts vocabulary item via sync IPC', () => {
      const vocab = {
        id: 123,
        word: 'ephemeral',
        definition: 'lasting briefly',
      };
      const leitnerItem = { box: 2, next_review: '2024-01-15' };
      const expectedResult = {
        id: 'lp_vocab_123',
        itemType: 'word',
        front: 'ephemeral',
        box: 2,
      };

      mockSendSync.mockReturnValue(expectedResult);

      const result = api.convertFromVocabulary(vocab, leitnerItem);

      expect(mockSendSync).toHaveBeenCalledWith('lp-convert-vocabulary', vocab, leitnerItem);
      expect(result.id).toBe('lp_vocab_123');
      expect(result.itemType).toBe('word');
    });

    test('handles null leitnerItem', () => {
      const vocab = { id: 1, word: 'test' };
      mockSendSync.mockReturnValue({ id: 'lp_vocab_1', box: 1 });

      const result = api.convertFromVocabulary(vocab);

      expect(mockSendSync).toHaveBeenCalledWith('lp-convert-vocabulary', vocab, null);
      expect(result.box).toBe(1);
    });
  });

  describe('convertFromNote', () => {
    test('converts note item via sync IPC', () => {
      const note = {
        id: 456,
        data: JSON.stringify({ cards: [{ text: 'Highlight' }] }),
      };
      const leitnerItem = { box: 3 };
      const expectedResult = {
        id: 'lp_note_456',
        itemType: 'note',
        box: 3,
      };

      mockSendSync.mockReturnValue(expectedResult);

      const result = api.convertFromNote(note, leitnerItem);

      expect(mockSendSync).toHaveBeenCalledWith('lp-convert-note', note, leitnerItem);
      expect(result.itemType).toBe('note');
    });

    test('handles PDF annotation conversion', () => {
      const note = {
        id: 789,
        data: JSON.stringify({ position: [{ pageNumber: 5 }] }),
      };
      mockSendSync.mockReturnValue({ itemType: 'pdf_annotation', pageNumber: 5 });

      const result = api.convertFromNote(note);

      expect(result.itemType).toBe('pdf_annotation');
    });
  });

  describe('convertFromPlanPoint', () => {
    test('converts plan point via sync IPC', () => {
      const planPoint = {
        id: 'pp_1',
        front: 'Question',
        back: 'Answer',
        type: 'concept',
      };
      const planId = 'plan_123';
      const expectedResult = {
        id: 'pp_1',
        planId: 'plan_123',
        sourceType: 'import',
      };

      mockSendSync.mockReturnValue(expectedResult);

      const result = api.convertFromPlanPoint(planPoint, planId);

      expect(mockSendSync).toHaveBeenCalledWith('lp-convert-plan-point', planPoint, planId);
      expect(result.planId).toBe('plan_123');
      expect(result.sourceType).toBe('import');
    });
  });
});
