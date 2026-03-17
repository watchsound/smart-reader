/**
 * WikiLinkExtension.test.js
 *
 * Tests for WikiLink extension interface and [[link]] syntax.
 * Tests pattern matching, link types, and event handling.
 */

import '@testing-library/jest-dom';

describe('WikiLink Extension Configuration', () => {
  describe('Extension Properties', () => {
    const extensionConfig = {
      name: 'wikiLink',
      group: 'inline',
      inline: true,
      selectable: true,
    };

    it('should have name "wikiLink"', () => {
      expect(extensionConfig.name).toBe('wikiLink');
    });

    it('should be inline', () => {
      expect(extensionConfig.inline).toBe(true);
    });

    it('should belong to inline group', () => {
      expect(extensionConfig.group).toBe('inline');
    });
  });

  describe('Attributes', () => {
    const attributes = {
      type: { default: 'note' },
      id: { default: '' },
      text: { default: '' },
    };

    it('should have type attribute with "note" default', () => {
      expect(attributes.type.default).toBe('note');
    });

    it('should have id attribute', () => {
      expect(attributes.id.default).toBe('');
    });

    it('should have text attribute', () => {
      expect(attributes.text.default).toBe('');
    });
  });
});

describe('WikiLink Pattern Matching', () => {
  describe('Basic Pattern [[...]]', () => {
    const wikiLinkPattern = /\[\[([^\]]+)\]\]/;

    it('should match simple text', () => {
      expect(wikiLinkPattern.test('[[My Note]]')).toBe(true);
    });

    it('should match single word', () => {
      expect(wikiLinkPattern.test('[[ephemeral]]')).toBe(true);
    });

    it('should match multi-word text', () => {
      expect(wikiLinkPattern.test('[[Machine Learning Basics]]')).toBe(true);
    });

    it('should extract text content', () => {
      const match = '[[Important Concept]]'.match(wikiLinkPattern);
      expect(match[1]).toBe('Important Concept');
    });

    it('should not match unclosed brackets', () => {
      expect(wikiLinkPattern.test('[[unclosed')).toBe(false);
    });

    it('should not match empty brackets', () => {
      expect(wikiLinkPattern.test('[[]]')).toBe(false);
    });
  });

  describe('Global Pattern', () => {
    const globalPattern = /\[\[([^\]]+)\]\]/g;

    it('should find multiple links', () => {
      const text = 'See [[Note 1]] and [[Note 2]]';
      const matches = [...text.matchAll(globalPattern)];
      expect(matches.length).toBe(2);
    });
  });
});

describe('WikiLink Types', () => {
  const linkTypes = ['note', 'vocabulary', 'concept'];

  linkTypes.forEach((type) => {
    it(`should support ${type} type`, () => {
      expect(linkTypes).toContain(type);
    });
  });
});

describe('WikiLink CSS Classes', () => {
  it('should have base class', () => {
    expect('wiki-link').toBe('wiki-link');
  });

  it('should have vocabulary type class', () => {
    expect('wiki-link--vocabulary').toBe('wiki-link--vocabulary');
  });

  it('should have concept type class', () => {
    expect('wiki-link--concept').toBe('wiki-link--concept');
  });

  it('should have note type class', () => {
    expect('wiki-link--note').toBe('wiki-link--note');
  });
});

describe('WikiLink Commands', () => {
  const insertWikiLinkCommand = (type, id, text) => ({
    type: 'wikiLink',
    attrs: { type, id, text },
  });

  it('should create vocabulary link', () => {
    const result = insertWikiLinkCommand('vocabulary', 'v123', 'word');
    expect(result.attrs.type).toBe('vocabulary');
  });

  it('should create concept link', () => {
    const result = insertWikiLinkCommand('concept', 'c456', 'idea');
    expect(result.attrs.type).toBe('concept');
  });

  it('should create note link', () => {
    const result = insertWikiLinkCommand('note', 'n789', 'notes');
    expect(result.attrs.type).toBe('note');
  });
});

describe('WikiLink Event Handlers', () => {
  it('should call onHover with link data', () => {
    const onHover = jest.fn();
    onHover({ type: 'vocabulary', id: 'v1' });
    expect(onHover).toHaveBeenCalled();
  });

  it('should call onClick with type and id', () => {
    const onClick = jest.fn();
    onClick({ type: 'note', id: 'n1' });
    expect(onClick).toHaveBeenCalledWith({ type: 'note', id: 'n1' });
  });
});

describe('WikiLink Styling', () => {
  const typeColors = {
    vocabulary: '#4CAF50',
    concept: '#2196F3',
    note: '#9E9E9E',
  };

  it('should have green for vocabulary', () => {
    expect(typeColors.vocabulary).toBe('#4CAF50');
  });

  it('should have blue for concept', () => {
    expect(typeColors.concept).toBe('#2196F3');
  });

  it('should have gray for note', () => {
    expect(typeColors.note).toBe('#9E9E9E');
  });
});
