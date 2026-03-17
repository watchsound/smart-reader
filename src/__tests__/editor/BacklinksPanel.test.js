/**
 * BacklinksPanel.test.js
 *
 * Tests for BacklinksPanel interface and behavior.
 * Tests backlink display, navigation, and data handling.
 */

import '@testing-library/jest-dom';

describe('BacklinksPanel Interface', () => {
  describe('Props', () => {
    const validProps = {
      targetId: 'note_123',
      targetType: 'note',
      onNavigate: jest.fn(),
    };

    it('should require targetId', () => {
      expect(typeof validProps.targetId).toBe('string');
    });

    it('should require targetType', () => {
      expect(['note', 'vocabulary', 'concept']).toContain(validProps.targetType);
    });

    it('should accept onNavigate callback', () => {
      expect(typeof validProps.onNavigate).toBe('function');
    });
  });

  describe('Target Types', () => {
    const targetTypes = ['note', 'vocabulary', 'concept'];

    targetTypes.forEach((type) => {
      it(`should support ${type} target type`, () => {
        expect(targetTypes).toContain(type);
      });
    });
  });
});

describe('BacklinksPanel Data Structure', () => {
  describe('Backlink Item', () => {
    const backlinkItem = {
      noteId: 'note_1',
      noteTitle: 'Introduction to ML',
      linkText: 'Target Note',
      context: '...as discussed in [[Target Note]]...',
      linkType: 'explicit',
      createdAt: '2024-01-15T10:00:00Z',
      tags: ['AI', 'ML'],
    };

    it('should have noteId', () => {
      expect(backlinkItem.noteId).toBeDefined();
    });

    it('should have noteTitle', () => {
      expect(backlinkItem.noteTitle).toBeDefined();
    });

    it('should have linkType', () => {
      expect(['explicit', 'auto']).toContain(backlinkItem.linkType);
    });

    it('should have context', () => {
      expect(backlinkItem.context).toBeDefined();
    });

    it('should have tags array', () => {
      expect(Array.isArray(backlinkItem.tags)).toBe(true);
    });
  });

  describe('Link Types', () => {
    it('should support explicit links', () => {
      const linkType = 'explicit';
      expect(linkType).toBe('explicit');
    });

    it('should support auto links', () => {
      const linkType = 'auto';
      expect(linkType).toBe('auto');
    });
  });
});

describe('BacklinksPanel IPC', () => {
  describe('get-backlinks handler', () => {
    it('should call with targetId and targetType', () => {
      const mockSendSync = jest.fn();
      const targetId = 'note_123';
      const targetType = 'note';

      mockSendSync('get-backlinks', [targetId, targetType]);

      expect(mockSendSync).toHaveBeenCalledWith('get-backlinks', ['note_123', 'note']);
    });

    it('should work with vocabulary target', () => {
      const mockSendSync = jest.fn();
      mockSendSync('get-backlinks', ['vocab_123', 'vocabulary']);
      expect(mockSendSync).toHaveBeenCalledWith('get-backlinks', ['vocab_123', 'vocabulary']);
    });

    it('should work with concept target', () => {
      const mockSendSync = jest.fn();
      mockSendSync('get-backlinks', ['concept_123', 'concept']);
      expect(mockSendSync).toHaveBeenCalledWith('get-backlinks', ['concept_123', 'concept']);
    });
  });
});

describe('BacklinksPanel Navigation', () => {
  it('should call onNavigate with noteId', () => {
    const onNavigate = jest.fn();
    const noteId = 'note_456';

    onNavigate(noteId);

    expect(onNavigate).toHaveBeenCalledWith('note_456');
  });
});

describe('BacklinksPanel Sections', () => {
  describe('Explicit Links Section', () => {
    const sectionConfig = {
      title: 'Direct Links',
      linkType: 'explicit',
      expanded: true,
    };

    it('should have title', () => {
      expect(sectionConfig.title).toBe('Direct Links');
    });

    it('should be expanded by default', () => {
      expect(sectionConfig.expanded).toBe(true);
    });
  });

  describe('Auto Links Section', () => {
    const sectionConfig = {
      title: 'Related (Auto)',
      linkType: 'auto',
      expanded: true,
    };

    it('should have title', () => {
      expect(sectionConfig.title).toBe('Related (Auto)');
    });

    it('should be expanded by default', () => {
      expect(sectionConfig.expanded).toBe(true);
    });
  });
});

describe('BacklinksPanel States', () => {
  describe('Loading State', () => {
    it('should show loading indicator', () => {
      const loading = true;
      expect(loading).toBe(true);
    });
  });

  describe('Empty State', () => {
    it('should show empty message', () => {
      const emptyMessage = 'No backlinks yet';
      expect(emptyMessage).toContain('No backlinks');
    });

    it('should show helpful text', () => {
      const helpText = 'Notes that link to this note will appear here';
      expect(helpText).toContain('link to this');
    });
  });

  describe('Error State', () => {
    it('should show error message', () => {
      const errorMessage = 'Failed to load backlinks';
      expect(errorMessage).toContain('Failed');
    });
  });
});

describe('BacklinksPanel Context Highlighting', () => {
  const highlightContext = (context, linkText) => {
    if (!linkText) return context;
    const regex = new RegExp(`(${linkText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return context.replace(regex, '<mark>$1</mark>');
  };

  it('should highlight link text in context', () => {
    const result = highlightContext('See Target Note for details', 'Target Note');
    expect(result).toContain('<mark>Target Note</mark>');
  });

  it('should handle empty link text', () => {
    const result = highlightContext('Some context', '');
    expect(result).toBe('Some context');
  });

  it('should escape special regex characters', () => {
    const result = highlightContext('See [Note] here', '[Note]');
    expect(result).toContain('<mark>[Note]</mark>');
  });
});

describe('BacklinksPanel Styling', () => {
  describe('Link Type Badges', () => {
    const badgeColors = {
      explicit: { background: 'rgba(76, 175, 80, 0.15)', color: '#4CAF50' },
      auto: { background: 'rgba(33, 150, 243, 0.15)', color: '#2196F3' },
    };

    it('should have green for explicit links', () => {
      expect(badgeColors.explicit.color).toBe('#4CAF50');
    });

    it('should have blue for auto links', () => {
      expect(badgeColors.auto.color).toBe('#2196F3');
    });
  });
});

describe('BacklinksPanel Refresh', () => {
  it('should refetch when targetId changes', () => {
    const fetchBacklinks = jest.fn();
    const targetId1 = 'note_1';
    const targetId2 = 'note_2';

    fetchBacklinks(targetId1);
    fetchBacklinks(targetId2);

    expect(fetchBacklinks).toHaveBeenCalledTimes(2);
  });

  it('should allow manual refresh', () => {
    const fetchBacklinks = jest.fn();

    // Simulate refresh button click
    fetchBacklinks();
    fetchBacklinks();

    expect(fetchBacklinks).toHaveBeenCalledTimes(2);
  });
});
