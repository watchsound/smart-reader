/**
 * MathJaxExtension.ts
 *
 * TipTap extension for LaTeX/KaTeX rendering.
 * Supports both inline ($...$) and block ($$...$$) math expressions.
 * Uses KaTeX which is already installed and works offline.
 */

import { Node, mergeAttributes, InputRule } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore - katex doesn't have proper TypeScript declarations
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Make KaTeX available globally immediately
if (typeof window !== 'undefined') {
  (window as any).katex = katex;
}

// KaTeX types
declare global {
  interface Window {
    katex?: {
      render: (tex: string, element: HTMLElement, options?: any) => void;
      renderToString: (tex: string, options?: any) => string;
    };
  }
}

// React component for rendering KaTeX
interface MathNodeViewProps {
  node: {
    attrs: {
      content: string;
      inline: boolean;
    };
  };
  updateAttributes: (attrs: Partial<{ content: string; inline: boolean }>) => void;
  selected: boolean;
}

function MathNodeView({ node, selected }: MathNodeViewProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const { content, inline } = node.attrs;

  useEffect(() => {
    if (!content) {
      setRenderedHtml('');
      setError(null);
      return;
    }

    // Render with KaTeX to string (imported directly, always available)
    try {
      const html = katex.renderToString(content, {
        displayMode: !inline,
        throwOnError: false,
        errorColor: '#ff9800',
        trust: true,
      });
      setRenderedHtml(html);
      setError(null);
    } catch (err: any) {
      console.error('KaTeX rendering error:', err);
      setError(err.message || 'Render error');
      setRenderedHtml('');
    }
  }, [content, inline]);

  // Fallback display when KaTeX hasn't rendered or on error
  const fallbackContent = inline ? `$${content}$` : `$$${content}$$`;

  return (
    <NodeViewWrapper
      as={inline ? 'span' : 'div'}
      className={`katex-container ${inline ? 'katex-inline' : 'katex-block'} ${selected ? 'selected' : ''}`}
      style={{
        display: inline ? 'inline-block' : 'block',
        textAlign: inline ? undefined : 'center',
        margin: inline ? '0 2px' : '1em 0',
        padding: '2px 4px',
        borderRadius: '4px',
        background: selected ? 'rgba(29, 155, 209, 0.15)' : (error ? 'rgba(255, 152, 0, 0.1)' : 'rgba(29, 155, 209, 0.05)'),
        outline: selected ? '2px solid rgba(29, 155, 209, 0.5)' : 'none',
        cursor: 'default',
        fontFamily: error ? "'Fira Code', 'Consolas', monospace" : 'inherit',
        fontSize: error ? '0.9em' : 'inherit',
        color: error ? '#ff9800' : 'inherit',
      }}
    >
      {renderedHtml ? (
        <span
          ref={containerRef}
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      ) : (
        <span ref={containerRef} style={{ fontFamily: "'Fira Code', 'Consolas', monospace", opacity: 0.7 }}>
          {error ? fallbackContent : (content ? fallbackContent : '')}
        </span>
      )}
    </NodeViewWrapper>
  );
}

// The TipTap extension
export const MathJaxExtension = Node.create({
  name: 'mathJax',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      content: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-content') || '',
        renderHTML: (attributes) => ({
          'data-content': attributes.content,
        }),
      },
      inline: {
        default: true,
        parseHTML: (element) => element.getAttribute('data-inline') !== 'false',
        renderHTML: (attributes) => ({
          'data-inline': String(attributes.inline),
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-mathjax]',
      },
      {
        tag: 'div[data-mathjax]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { inline, content } = node.attrs;
    return [
      inline ? 'span' : 'div',
      mergeAttributes(HTMLAttributes, {
        'data-mathjax': 'true',
        'data-content': content,
        'data-inline': String(inline),
        class: inline ? 'mathjax-inline' : 'mathjax-block',
      }),
      // Include the raw LaTeX as text content for serialization
      inline ? `$${content}$` : `$$${content}$$`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathNodeView as any);
  },

  addCommands() {
    return {
      insertMath:
        (content: string, inline = true) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { content, inline },
          });
        },
    };
  },

  // Input rules to detect $...$ and $$...$$
  addInputRules() {
    const nodeType = this.type;

    // Block math: $$...$$ (must be checked first, before inline)
    const blockMathRule = new InputRule({
      find: /\$\$([^$]+)\$\$\s$/,
      handler: ({ state, range, match, chain }) => {
        const content = match[1];
        if (!content || !content.trim()) return null;
        chain().deleteRange(range).insertContentAt(range.from, {
          type: nodeType.name,
          attrs: { content: content.trim(), inline: false },
        }).run();
      },
    });

    // Inline math: $...$ (triggered by space after closing $)
    const inlineMathRule = new InputRule({
      find: /(?:^|[^$])\$([^$\n]+)\$\s$/,
      handler: ({ state, range, match, chain }) => {
        const content = match[1];
        if (!content || !content.trim()) return null;
        // Adjust range to not include the leading non-$ character
        const startOffset = match[0].startsWith('$') ? 0 : 1;
        const adjustedRange = { from: range.from + startOffset, to: range.to };
        chain().deleteRange(adjustedRange).insertContentAt(adjustedRange.from, {
          type: nodeType.name,
          attrs: { content: content.trim(), inline: true },
        }).run();
      },
    });

    return [blockMathRule, inlineMathRule];
  },
});

// Type augmentation for commands
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mathJax: {
      insertMath: (content: string, inline?: boolean) => ReturnType;
    };
  }
}

export default MathJaxExtension;
