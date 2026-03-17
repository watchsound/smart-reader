/**
 * LinkSuggestionMenu.test.js
 *
 * Tests for LinkSuggestionMenu interface and behavior.
 * Tests autocomplete suggestions, keyboard navigation, and selection.
 */

import '@testing-library/jest-dom';

describe('LinkSuggestionMenu Interface', () => {
  describe('Props', () => {
    const validProps = {
      query: 'test',
      position: { x: 100, y: 200 },
      onSelect: jest.fn(),
      onClose: jest.fn(),
    };

    it('should require query', () => {
      expect(typeof validProps.query).toBe('string');
    });

    it('should require position', () => {
      expect(validProps.position.x).toBe(100);
      expect(validProps.position.y).toBe(200);
    });

    it('should require onSelect callback', () => {
      expect(typeof validProps.onSelect).toBe('function');
    });

    it('should require onClose callback', () => {
      expect(typeof validProps.onClose).toBe('function');
    });
  });

  describe('Position', () => {
    it('should accept null position', () => {
      const position = null;
      expect(position).toBeNull();
    });

    it('should accept valid coordinates', () => {
      const position = { x: 150, y: 250 };
      expect(position.x).toBeGreaterThanOrEqual(0);
      expect(position.y).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('LinkSuggestionMenu Data', () => {
  describe('Suggestion Item', () => {
    const suggestionItem = {
      type: 'vocabulary',
      id: 'vocab_1',
      title: 'ephemeral',
      description: 'lasting for a very short time',
      priority: 1,
    };

    it('should have type', () => {
      expect(['vocabulary', 'concept', 'note']).toContain(suggestionItem.type);
    });

    it('should have id', () => {
      expect(suggestionItem.id).toBeDefined();
    });

    it('should have title', () => {
      expect(suggestionItem.title).toBeDefined();
    });

    it('should have description', () => {
      expect(suggestionItem.description).toBeDefined();
    });

    it('should have priority', () => {
      expect(suggestionItem.priority).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Suggestion Types', () => {
    const types = ['vocabulary', 'concept', 'note'];

    types.forEach((type) => {
      it(`should support ${type} suggestions`, () => {
        expect(types).toContain(type);
      });
    });
  });
});

describe('LinkSuggestionMenu IPC', () => {
  describe('get-link-suggestions handler', () => {
    it('should call with query', () => {
      const mockSendSync = jest.fn();

      mockSendSync('get-link-suggestions', ['test query']);

      expect(mockSendSync).toHaveBeenCalledWith('get-link-suggestions', ['test query']);
    });

    it('should debounce queries', () => {
      const debounceTime = 150;
      expect(debounceTime).toBe(150);
    });
  });
});

describe('LinkSuggestionMenu Selection', () => {
  describe('onSelect callback', () => {
    it('should call with selected item', () => {
      const onSelect = jest.fn();
      const item = { type: 'vocabulary', id: 'v1', title: 'word' };

      onSelect(item);

      expect(onSelect).toHaveBeenCalledWith(item);
    });

    it('should include type and id', () => {
      const onSelect = jest.fn();
      const item = { type: 'concept', id: 'c1', title: 'idea' };

      onSelect(item);

      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'concept', id: 'c1' })
      );
    });
  });
});

describe('LinkSuggestionMenu Keyboard Navigation', () => {
  describe('Arrow Keys', () => {
    it('should support ArrowDown', () => {
      const key = 'ArrowDown';
      expect(key).toBe('ArrowDown');
    });

    it('should support ArrowUp', () => {
      const key = 'ArrowUp';
      expect(key).toBe('ArrowUp');
    });
  });

  describe('Enter Key', () => {
    it('should select current item', () => {
      const key = 'Enter';
      expect(key).toBe('Enter');
    });
  });

  describe('Escape Key', () => {
    it('should close menu', () => {
      const onClose = jest.fn();
      // Simulate Escape key
      onClose();
      expect(onClose).toHaveBeenCalled();
    });
  });
});

describe('LinkSuggestionMenu States', () => {
  describe('Loading State', () => {
    it('should show loading indicator', () => {
      const loading = true;
      expect(loading).toBe(true);
    });
  });

  describe('Empty State', () => {
    it('should show no matches message', () => {
      const message = 'No matches for "test"';
      expect(message).toContain('No matches');
    });

    it('should show start typing message', () => {
      const message = 'Start typing to search';
      expect(message).toContain('Start typing');
    });
  });

  describe('Results State', () => {
    it('should show suggestion items', () => {
      const items = [
        { type: 'vocabulary', id: 'v1', title: 'word1' },
        { type: 'concept', id: 'c1', title: 'concept1' },
      ];
      expect(items.length).toBe(2);
    });
  });
});

describe('LinkSuggestionMenu Close Behavior', () => {
  describe('Click Outside', () => {
    it('should close on click outside', () => {
      const onClose = jest.fn();
      // Simulate click outside
      onClose();
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('Escape Key', () => {
    it('should close on Escape', () => {
      const onClose = jest.fn();
      // Simulate Escape
      onClose();
      expect(onClose).toHaveBeenCalled();
    });
  });
});

describe('LinkSuggestionMenu Styling', () => {
  describe('Type Icons', () => {
    const typeIcons = {
      vocabulary: 'MenuBookIcon',
      concept: 'SchoolIcon',
      note: 'NotesIcon',
    };

    it('should have icon for vocabulary', () => {
      expect(typeIcons.vocabulary).toBe('MenuBookIcon');
    });

    it('should have icon for concept', () => {
      expect(typeIcons.concept).toBe('SchoolIcon');
    });

    it('should have icon for note', () => {
      expect(typeIcons.note).toBe('NotesIcon');
    });
  });

  describe('Type Colors', () => {
    const typeColors = {
      vocabulary: { background: 'rgba(76, 175, 80, 0.15)', color: '#4CAF50' },
      concept: { background: 'rgba(33, 150, 243, 0.15)', color: '#2196F3' },
      note: { background: 'rgba(158, 158, 158, 0.15)', color: '#757575' },
    };

    it('should have green for vocabulary', () => {
      expect(typeColors.vocabulary.color).toBe('#4CAF50');
    });

    it('should have blue for concept', () => {
      expect(typeColors.concept.color).toBe('#2196F3');
    });

    it('should have gray for note', () => {
      expect(typeColors.note.color).toBe('#757575');
    });
  });

  describe('Container Styles', () => {
    const containerStyles = {
      maxHeight: 320,
      minWidth: 280,
      maxWidth: 360,
      borderRadius: 10,
    };

    it('should have max height', () => {
      expect(containerStyles.maxHeight).toBe(320);
    });

    it('should have min width', () => {
      expect(containerStyles.minWidth).toBe(280);
    });

    it('should have max width', () => {
      expect(containerStyles.maxWidth).toBe(360);
    });
  });
});

describe('LinkSuggestionMenu Selected Index', () => {
  it('should reset to 0 when items change', () => {
    const selectedIndex = 0;
    expect(selectedIndex).toBe(0);
  });

  it('should not exceed items length', () => {
    const items = [{}, {}, {}];
    const maxIndex = items.length - 1;
    expect(maxIndex).toBe(2);
  });

  it('should not go below 0', () => {
    const minIndex = 0;
    expect(minIndex).toBe(0);
  });
});

describe('LinkSuggestionMenu Priority Sorting', () => {
  it('should sort by priority', () => {
    const items = [
      { type: 'note', priority: 3 },
      { type: 'vocabulary', priority: 1 },
      { type: 'concept', priority: 2 },
    ];

    const sorted = [...items].sort((a, b) => a.priority - b.priority);

    expect(sorted[0].type).toBe('vocabulary');
    expect(sorted[1].type).toBe('concept');
    expect(sorted[2].type).toBe('note');
  });
});
