/**
 * RichMarkdownEditor.tsx
 *
 * A WYSIWYG markdown editor built on TipTap (ProseMirror).
 * Features:
 * - Full formatting toolbar (bold, italic, headers, lists, tables, code)
 * - LaTeX/MathJax support for math expressions
 * - [[wiki-link]] syntax for linking notes/vocabulary/concepts
 * - Vocabulary word detection with hover tooltips
 * - Code syntax highlighting via lowlight
 */

import React, { useEffect, useCallback, useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import Box from '@mui/material/Box';
import { styled, useTheme } from '@mui/material/styles';

// BubbleMenu disabled due to tippyOptions prop warning issue
// The BubbleMenu passes tippyOptions to DOM elements which causes React warnings
// Users can still use the toolbar for formatting
const BubbleMenu: React.ComponentType<any> | null = null;

import EditorToolbar from './EditorToolbar';
import { MathJaxExtension } from './extensions/MathJaxExtension';
import { WikiLinkExtension } from './extensions/WikiLinkExtension';
import LinkPreviewPopover from './popovers/LinkPreviewPopover';
import './editor.styles.css';

// Create lowlight instance with common languages
const lowlight = createLowlight(common);

// Styled container for the editor
const EditorContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
  borderRadius: '12px',
  overflow: 'hidden',
  background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#fff',
  transition: 'all 0.2s ease',
  '&:focus-within': {
    borderColor: theme.palette.primary.main,
    boxShadow: `0 0 0 2px ${theme.palette.mode === 'dark' ? 'rgba(29, 155, 209, 0.2)' : 'rgba(29, 155, 209, 0.15)'}`,
  },
}));

const EditorContentWrapper = styled(Box)(({ theme }) => ({
  flex: 1,
  overflow: 'auto',
  padding: '16px',
  minHeight: '200px',
  maxHeight: '400px',
  '& .ProseMirror': {
    outline: 'none',
    minHeight: '168px',
    fontFamily: 'inherit',
    fontSize: '14px',
    lineHeight: 1.6,
    color: theme.palette.text.primary,
    '& p': {
      margin: '0 0 0.75em',
    },
    '& h1, & h2, & h3': {
      margin: '1em 0 0.5em',
      fontWeight: 600,
    },
    '& h1': { fontSize: '1.75em' },
    '& h2': { fontSize: '1.5em' },
    '& h3': { fontSize: '1.25em' },
    '& ul, & ol': {
      margin: '0.5em 0',
      paddingLeft: '1.5em',
    },
    '& li': {
      margin: '0.25em 0',
    },
    '& blockquote': {
      borderLeft: `3px solid ${theme.palette.primary.main}`,
      margin: '0.5em 0',
      paddingLeft: '1em',
      color: theme.palette.text.secondary,
      fontStyle: 'italic',
    },
    '& code': {
      background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
      borderRadius: '4px',
      padding: '0.2em 0.4em',
      fontSize: '0.9em',
      fontFamily: "'Fira Code', 'Consolas', monospace",
    },
    '& pre': {
      background: theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
      borderRadius: '8px',
      padding: '12px 16px',
      margin: '0.5em 0',
      overflow: 'auto',
      '& code': {
        background: 'transparent',
        padding: 0,
        fontSize: '13px',
      },
    },
    '& table': {
      borderCollapse: 'collapse',
      margin: '0.5em 0',
      width: '100%',
      '& th, & td': {
        border: `1px solid ${theme.palette.divider}`,
        padding: '8px 12px',
        textAlign: 'left',
      },
      '& th': {
        background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        fontWeight: 600,
      },
    },
    '& a, & .editor-link': {
      color: theme.palette.primary.main,
      textDecoration: 'none',
      cursor: 'pointer',
      '&:hover': {
        textDecoration: 'underline',
      },
    },
    '& .wiki-link': {
      cursor: 'pointer',
      textDecoration: 'none',
      borderRadius: '4px',
      padding: '0 2px',
      transition: 'all 0.15s ease',
      '&:hover': {
        textDecoration: 'underline',
      },
    },
    '& .wiki-link--vocabulary': {
      color: '#4CAF50',
      background: 'rgba(76, 175, 80, 0.1)',
    },
    '& .wiki-link--concept': {
      color: '#2196F3',
      background: 'rgba(33, 150, 243, 0.1)',
    },
    '& .wiki-link--note': {
      color: theme.palette.mode === 'dark' ? '#9E9E9E' : '#616161',
      background: theme.palette.mode === 'dark' ? 'rgba(158, 158, 158, 0.1)' : 'rgba(97, 97, 97, 0.1)',
    },
    '& .mathjax-inline, & .mathjax-block': {
      display: 'inline-block',
      margin: '0 2px',
    },
    '& .mathjax-block': {
      display: 'block',
      textAlign: 'center',
      margin: '1em 0',
    },
    // Placeholder
    '& p.is-editor-empty:first-of-type::before': {
      color: theme.palette.text.disabled,
      content: 'attr(data-placeholder)',
      float: 'left',
      height: 0,
      pointerEvents: 'none',
    },
  },
}));

export interface RichMarkdownEditorProps {
  content?: string;
  onChange?: (html: string, text: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  readOnly?: boolean;
  autoFocus?: boolean;
  onLinkClick?: (type: string, id: string) => void;
}

export interface RichMarkdownEditorRef {
  getHTML: () => string;
  getText: () => string;
  getJSON: () => any;
  setContent: (content: string) => void;
  focus: () => void;
  clear: () => void;
  insertMath: (latex: string, inline?: boolean) => void;
  insertWikiLink: (type: string, id: string, text: string) => void;
}

const RichMarkdownEditor = forwardRef<RichMarkdownEditorRef, RichMarkdownEditorProps>(
  (
    {
      content = '',
      onChange,
      placeholder = 'Write your note here... Use [[]] to link to other notes',
      minHeight = 200,
      maxHeight = 400,
      readOnly = false,
      autoFocus = false,
      onLinkClick,
    },
    ref
  ) => {
    const theme = useTheme();
    const [previewState, setPreviewState] = useState<{
      type: string;
      id: string;
      element: HTMLElement;
    } | null>(null);

    // Track the last content we sent via onChange to avoid loop
    const lastSentContent = useRef('');

    // Handle wiki-link hover
    const handleLinkHover = useCallback((data: { type: string; id: string; element: HTMLElement }) => {
      setPreviewState(data);
    }, []);

    // Handle wiki-link click
    const handleLinkClick = useCallback(
      (data: { type: string; id: string }) => {
        if (onLinkClick) {
          onLinkClick(data.type, data.id);
        }
      },
      [onLinkClick]
    );

    // Handle external hyperlink click - open in browser
    const handleEditorClick = useCallback((event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      const link = target.closest('a.editor-link');
      if (link && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        const href = link.getAttribute('href');
        if (href) {
          // Open in external browser via Electron shell
          window.electron?.ipcRenderer?.invoke('open-external-link', href).catch(() => {
            // Fallback to window.open
            window.open(href, '_blank', 'noopener,noreferrer');
          });
        }
      }
    }, []);

    // Initialize TipTap editor
    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          codeBlock: false, // We use CodeBlockLowlight instead
        }),
        Placeholder.configure({
          placeholder,
        }),
        Underline,
        TextStyle,
        Color,
        FontFamily,
        Highlight.configure({
          multicolor: true,
        }),
        Link.configure({
          openOnClick: false, // We handle click manually to open in external browser
          autolink: true, // Auto-detect URLs when typing
          linkOnPaste: true, // Auto-link when pasting URLs
          HTMLAttributes: {
            class: 'editor-link',
            rel: 'noopener noreferrer',
            target: '_blank',
          },
        }).extend({
          // Prevent link from extending when typing at the end
          inclusive: false,
        }),
        Table,
        TableRow,
        TableCell,
        TableHeader,
        CodeBlockLowlight.configure({
          lowlight,
        }),
        MathJaxExtension,
        WikiLinkExtension.configure({
          onHover: handleLinkHover,
          onClick: handleLinkClick,
        }),
      ],
      content,
      editable: !readOnly,
      autofocus: autoFocus,
      onUpdate: ({ editor: ed }) => {
        const html = ed.getHTML();
        // Track what we're sending to avoid re-applying it
        lastSentContent.current = html;
        if (onChange) {
          onChange(html, ed.getText());
        }
      },
    });

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      getHTML: () => editor?.getHTML() || '',
      getText: () => editor?.getText() || '',
      getJSON: () => editor?.getJSON() || {},
      setContent: (newContent: string) => {
        editor?.commands.setContent(newContent);
      },
      focus: () => {
        editor?.commands.focus();
      },
      clear: () => {
        editor?.commands.clearContent();
      },
      insertMath: (latex: string, inline = true) => {
        editor?.commands.insertContent({
          type: 'mathJax',
          attrs: { content: latex, inline },
        });
      },
      insertWikiLink: (type: string, id: string, text: string) => {
        editor?.commands.insertContent({
          type: 'wikiLink',
          attrs: { type, id, text },
        });
      },
    }));

    // Update content when prop changes (only for truly external updates)
    useEffect(() => {
      if (!editor) return;

      // Skip if this is content we just sent out via onChange
      // This prevents the loop: type → onChange → state update → content prop → setContent
      if (content === lastSentContent.current) {
        return;
      }

      // This is genuinely new external content (e.g., switching sides, initial load)
      if (content === '') {
        const currentHTML = editor.getHTML();
        if (currentHTML !== '<p></p>') {
          editor.commands.clearContent();
        }
      } else {
        editor.commands.setContent(content);
      }
      // Track this as the last sent content to avoid re-triggering
      lastSentContent.current = content;
    }, [content, editor]);

    // Update editable state
    useEffect(() => {
      if (editor) {
        editor.setEditable(!readOnly);
      }
    }, [readOnly, editor]);

    if (!editor) {
      return null;
    }

    return (
      <EditorContainer>
        {!readOnly && <EditorToolbar editor={editor} />}

        <EditorContentWrapper
          sx={{
            minHeight,
            maxHeight,
          }}
          onClick={handleEditorClick}
        >
          <EditorContent editor={editor} />
        </EditorContentWrapper>

        {/* Bubble menu disabled - use toolbar instead */}

        {/* Link preview popover on hover */}
        {previewState && (
          <LinkPreviewPopover
            type={previewState.type}
            id={previewState.id}
            anchorEl={previewState.element}
            onClose={() => setPreviewState(null)}
          />
        )}
      </EditorContainer>
    );
  }
);

RichMarkdownEditor.displayName = 'RichMarkdownEditor';

export default RichMarkdownEditor;
