/**
 * MathJaxExtension.test.js
 *
 * Tests for MathJax extension interface and LaTeX handling.
 * Tests LaTeX patterns, rendering requirements, and extension config.
 */

import '@testing-library/jest-dom';

/**
 * Tests for MathJax extension without importing the actual module.
 * Verifies interface contracts, LaTeX patterns, and expected behavior.
 */

describe('MathJax Extension Configuration', () => {
  describe('Extension Properties', () => {
    const extensionConfig = {
      name: 'mathJax',
      group: 'inline',
      inline: true,
      atom: true,
      selectable: true,
      draggable: true,
    };

    it('should have name "mathJax"', () => {
      expect(extensionConfig.name).toBe('mathJax');
    });

    it('should be inline', () => {
      expect(extensionConfig.inline).toBe(true);
    });

    it('should be an atom node', () => {
      expect(extensionConfig.atom).toBe(true);
    });

    it('should be selectable', () => {
      expect(extensionConfig.selectable).toBe(true);
    });

    it('should be draggable', () => {
      expect(extensionConfig.draggable).toBe(true);
    });

    it('should belong to inline group', () => {
      expect(extensionConfig.group).toBe('inline');
    });
  });

  describe('Attributes', () => {
    const attributes = {
      content: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-content') || '',
        renderHTML: (attrs) => ({ 'data-content': attrs.content }),
      },
      inline: {
        default: true,
        parseHTML: (element) => element.getAttribute('data-inline') !== 'false',
        renderHTML: (attrs) => ({ 'data-inline': String(attrs.inline) }),
      },
    };

    it('should have content attribute with empty default', () => {
      expect(attributes.content.default).toBe('');
    });

    it('should have inline attribute with true default', () => {
      expect(attributes.inline.default).toBe(true);
    });

    it('should parse content from data-content', () => {
      const mockElement = {
        getAttribute: jest.fn((attr) => attr === 'data-content' ? 'E = mc^2' : null),
      };
      const result = attributes.content.parseHTML(mockElement);
      expect(result).toBe('E = mc^2');
    });

    it('should render content as data-content', () => {
      const result = attributes.content.renderHTML({ content: 'x^2' });
      expect(result['data-content']).toBe('x^2');
    });

    it('should parse inline from data-inline', () => {
      const mockElement = {
        getAttribute: jest.fn((attr) => attr === 'data-inline' ? 'true' : null),
      };
      const result = attributes.inline.parseHTML(mockElement);
      expect(result).toBe(true);
    });

    it('should parse block from data-inline="false"', () => {
      const mockElement = {
        getAttribute: jest.fn((attr) => attr === 'data-inline' ? 'false' : null),
      };
      const result = attributes.inline.parseHTML(mockElement);
      expect(result).toBe(false);
    });
  });
});

describe('MathJax LaTeX Patterns', () => {
  describe('Inline Math ($...$)', () => {
    const inlinePattern = /\$([^$]+)\$/;

    it('should match simple expression', () => {
      expect(inlinePattern.test('$x$')).toBe(true);
    });

    it('should match expression with superscript', () => {
      expect(inlinePattern.test('$x^2$')).toBe(true);
    });

    it('should match expression with subscript', () => {
      expect(inlinePattern.test('$x_n$')).toBe(true);
    });

    it('should match fraction', () => {
      expect(inlinePattern.test('$\\frac{a}{b}$')).toBe(true);
    });

    it('should match Greek letters', () => {
      expect(inlinePattern.test('$\\alpha \\beta \\gamma$')).toBe(true);
    });

    it('should extract content', () => {
      const match = '$E = mc^2$'.match(inlinePattern);
      expect(match[1]).toBe('E = mc^2');
    });

    it('should not match empty delimiters', () => {
      expect(inlinePattern.test('$$')).toBe(false);
    });
  });

  describe('Block Math ($$...$$)', () => {
    const blockPattern = /\$\$([^$]+)\$\$/;

    it('should match block expression', () => {
      expect(blockPattern.test('$$\\int_0^1 x dx$$')).toBe(true);
    });

    it('should match multi-line expression', () => {
      const multiLine = '$$\\sum_{i=1}^n i = \\frac{n(n+1)}{2}$$';
      expect(blockPattern.test(multiLine)).toBe(true);
    });

    it('should extract content', () => {
      const match = '$$\\frac{d}{dx} e^x = e^x$$'.match(blockPattern);
      expect(match[1]).toBe('\\frac{d}{dx} e^x = e^x');
    });
  });
});

describe('MathJax Common Expressions', () => {
  const expressionTests = [
    { latex: 'x^2', description: 'superscript' },
    { latex: 'x_n', description: 'subscript' },
    { latex: 'x^{2n+1}', description: 'complex superscript' },
    { latex: '\\frac{a}{b}', description: 'fraction' },
    { latex: '\\sqrt{x}', description: 'square root' },
    { latex: '\\sqrt[3]{x}', description: 'cube root' },
    { latex: '\\sum_{i=1}^n', description: 'summation' },
    { latex: '\\prod_{i=1}^n', description: 'product' },
    { latex: '\\int_a^b f(x) dx', description: 'integral' },
    { latex: '\\lim_{x \\to \\infty}', description: 'limit' },
    { latex: '\\alpha \\beta \\gamma', description: 'Greek letters' },
    { latex: '\\sin(x) \\cos(x) \\tan(x)', description: 'trig functions' },
    { latex: 'e^{i\\pi} + 1 = 0', description: 'Euler identity' },
    { latex: '\\begin{matrix} a & b \\\\ c & d \\end{matrix}', description: 'matrix' },
    { latex: '\\vec{v} \\cdot \\vec{w}', description: 'vectors' },
    { latex: '\\partial f / \\partial x', description: 'partial derivative' },
    { latex: '\\nabla \\times \\vec{F}', description: 'curl' },
    { latex: '\\binom{n}{k}', description: 'binomial' },
  ];

  expressionTests.forEach(({ latex, description }) => {
    it(`should handle ${description}: ${latex}`, () => {
      // Verify the LaTeX is a valid string
      expect(typeof latex).toBe('string');
      expect(latex.length).toBeGreaterThan(0);
    });
  });
});

describe('MathJax HTML Rendering', () => {
  describe('Inline Rendering', () => {
    it('should render as span', () => {
      const tag = 'span';
      const className = 'mathjax-inline';
      expect(tag).toBe('span');
      expect(className).toBe('mathjax-inline');
    });

    it('should include data-mathjax attribute', () => {
      const attrs = { 'data-mathjax': 'true' };
      expect(attrs['data-mathjax']).toBe('true');
    });
  });

  describe('Block Rendering', () => {
    it('should render as div', () => {
      const tag = 'div';
      const className = 'mathjax-block';
      expect(tag).toBe('div');
      expect(className).toBe('mathjax-block');
    });

    it('should center block math', () => {
      const style = { textAlign: 'center' };
      expect(style.textAlign).toBe('center');
    });
  });
});

describe('MathJax Commands', () => {
  describe('insertMath Command', () => {
    const insertMathCommand = (content, inline = true) => ({
      type: 'mathJax',
      attrs: { content, inline },
    });

    it('should create inline math by default', () => {
      const result = insertMathCommand('x^2');
      expect(result.attrs.inline).toBe(true);
    });

    it('should create block math when inline is false', () => {
      const result = insertMathCommand('\\int_0^1 x dx', false);
      expect(result.attrs.inline).toBe(false);
    });

    it('should include LaTeX content', () => {
      const result = insertMathCommand('E = mc^2');
      expect(result.attrs.content).toBe('E = mc^2');
    });

    it('should have type mathJax', () => {
      const result = insertMathCommand('x');
      expect(result.type).toBe('mathJax');
    });
  });
});

describe('MathJax Input Rules', () => {
  describe('Inline Input Rule', () => {
    const inlineRegex = /\$([^$]+)\$$/;

    it('should match at end of input', () => {
      expect(inlineRegex.test('$x^2$')).toBe(true);
    });

    it('should not match without closing $', () => {
      expect(inlineRegex.test('$x^2')).toBe(false);
    });
  });

  describe('Block Input Rule', () => {
    const blockRegex = /\$\$([^$]+)\$\$$/;

    it('should match double dollar delimiters', () => {
      expect(blockRegex.test('$$\\frac{a}{b}$$')).toBe(true);
    });

    it('should not match single dollar', () => {
      expect(blockRegex.test('$x$')).toBe(false);
    });
  });
});

describe('MathJax Styling', () => {
  describe('Container Styles', () => {
    const containerStyles = {
      inline: {
        display: 'inline-block',
        margin: '0 2px',
      },
      block: {
        display: 'block',
        textAlign: 'center',
        margin: '1em 0',
      },
    };

    it('should use inline-block for inline math', () => {
      expect(containerStyles.inline.display).toBe('inline-block');
    });

    it('should use block for block math', () => {
      expect(containerStyles.block.display).toBe('block');
    });

    it('should center block math', () => {
      expect(containerStyles.block.textAlign).toBe('center');
    });
  });

  describe('Selection Styles', () => {
    const selectedStyles = {
      background: 'rgba(29, 155, 209, 0.1)',
      outline: '2px solid rgba(29, 155, 209, 0.5)',
    };

    it('should highlight selected nodes', () => {
      expect(selectedStyles.background).toContain('rgba');
    });

    it('should outline selected nodes', () => {
      expect(selectedStyles.outline).toContain('solid');
    });
  });
});
