/**
 * WikiLinkExtension.ts
 *
 * TipTap extension for [[wiki-link]] syntax.
 * Supports linking to notes, vocabulary, and concepts.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { Plugin, PluginKey } from 'prosemirror-state';
import React from 'react';

// Link types
export type WikiLinkType = 'note' | 'vocabulary' | 'concept';

// Node attributes interface
interface WikiLinkAttrs {
  type: WikiLinkType;
  id: string;
  text: string;
}

// Extension options
interface WikiLinkOptions {
  onHover?: (data: { type: string; id: string; element: HTMLElement }) => void;
  onClick?: (data: { type: string; id: string }) => void;
}

// React component for rendering wiki links
interface WikiLinkNodeViewProps {
  node: {
    attrs: WikiLinkAttrs;
  };
  selected: boolean;
  extension: {
    options: WikiLinkOptions;
  };
}

function WikiLinkNodeView({ node, selected, extension }: WikiLinkNodeViewProps) {
  const { type, id, text } = node.attrs;

  const handleMouseEnter = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (extension.options.onHover) {
      extension.options.onHover({
        type,
        id,
        element: e.currentTarget,
      });
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLSpanElement>) => {
    e.preventDefault();
    if (extension.options.onClick) {
      extension.options.onClick({ type, id });
    }
  };

  // Icon based on type
  const getIcon = () => {
    switch (type) {
      case 'vocabulary':
        return 'V';
      case 'concept':
        return 'C';
      case 'note':
      default:
        return 'N';
    }
  };

  return (
    <NodeViewWrapper
      as="span"
      className={`wiki-link wiki-link--${type} ${selected ? 'selected' : ''}`}
      data-wiki-link="true"
      data-type={type}
      data-id={id}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
      style={{
        cursor: 'pointer',
        outline: selected ? '2px solid rgba(29, 155, 209, 0.5)' : 'none',
      }}
    >
      <span className="wiki-link-icon" style={{ fontSize: '0.7em', opacity: 0.7 }}>
        {getIcon()}
      </span>
      {text}
    </NodeViewWrapper>
  );
}

// The TipTap extension
export const WikiLinkExtension = Node.create<WikiLinkOptions>({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      onHover: undefined,
      onClick: undefined,
    };
  },

  addAttributes() {
    return {
      type: {
        default: 'note',
        parseHTML: (element) => element.getAttribute('data-type') || 'note',
        renderHTML: (attributes) => ({
          'data-type': attributes.type,
        }),
      },
      id: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-id') || '',
        renderHTML: (attributes) => ({
          'data-id': attributes.id,
        }),
      },
      text: {
        default: '',
        parseHTML: (element) => {
          // Extract text from [[text]] or just the text content
          const content = element.textContent || '';
          const match = content.match(/\[\[(.+?)\]\]/);
          return match ? match[1] : content;
        },
        renderHTML: (attributes) => ({}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-wiki-link]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-wiki-link': 'true',
        class: `wiki-link wiki-link--${node.attrs.type}`,
      }),
      `[[${node.attrs.text}]]`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WikiLinkNodeView as any);
  },

  addCommands() {
    return {
      setWikiLink:
        (attrs: Partial<WikiLinkAttrs>) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              type: attrs.type || 'note',
              id: attrs.id || '',
              text: attrs.text || '',
            },
          });
        },
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: new PluginKey('wikiLinkEvents'),
        props: {
          handleDOMEvents: {
            mouseover(view, event) {
              const target = event.target as HTMLElement;
              const wikiLink = target.closest('[data-wiki-link]') as HTMLElement;

              if (wikiLink && extension.options.onHover) {
                const type = wikiLink.getAttribute('data-type') || 'note';
                const id = wikiLink.getAttribute('data-id') || '';

                extension.options.onHover({
                  type,
                  id,
                  element: wikiLink,
                });
              }
              return false;
            },
            click(view, event) {
              const target = event.target as HTMLElement;
              const wikiLink = target.closest('[data-wiki-link]') as HTMLElement;

              if (wikiLink && extension.options.onClick) {
                const type = wikiLink.getAttribute('data-type') || 'note';
                const id = wikiLink.getAttribute('data-id') || '';

                extension.options.onClick({ type, id });
                event.preventDefault();
                return true;
              }
              return false;
            },
          },
        },
      }),
    ];
  },

  // Input rule to detect [[...]] and trigger suggestion
  // Note: The actual suggestion popup is handled separately
  addInputRules() {
    return [];
  },
});

// Type augmentation for commands
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikiLink: {
      setWikiLink: (attrs: Partial<WikiLinkAttrs>) => ReturnType;
    };
  }
}

export default WikiLinkExtension;
