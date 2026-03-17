/**
 * EditorToolbar.tsx
 *
 * Formatting toolbar for the RichMarkdownEditor.
 * Provides buttons for text formatting, lists, tables, code, and math.
 */

import React, { useState, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import { styled, useTheme } from '@mui/material/styles';

// Icons
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import CodeIcon from '@mui/icons-material/Code';
import TableChartIcon from '@mui/icons-material/TableChart';
import FunctionsIcon from '@mui/icons-material/Functions';
import FormatColorTextIcon from '@mui/icons-material/FormatColorText';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import TitleIcon from '@mui/icons-material/Title';
import LinkIcon from '@mui/icons-material/Link';
import InsertLinkIcon from '@mui/icons-material/InsertLink';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import HighlightIcon from '@mui/icons-material/Highlight';

const ToolbarContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '2px',
  padding: '8px 12px',
  borderBottom: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
  background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
}));

const ToolbarButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'isActive',
})<{ isActive?: boolean }>(({ theme, isActive }) => ({
  width: 32,
  height: 32,
  borderRadius: '6px',
  color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
  background: isActive
    ? theme.palette.mode === 'dark'
      ? 'rgba(29, 155, 209, 0.15)'
      : 'rgba(29, 155, 209, 0.1)'
    : 'transparent',
  '&:hover': {
    background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
  },
  '& .MuiSvgIcon-root': {
    fontSize: 18,
  },
}));

const ToolbarDivider = styled(Divider)(({ theme }) => ({
  height: 24,
  margin: '0 6px',
  borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
}));

const ColorButton = styled('button')<{ color: string }>(({ color }) => ({
  width: 20,
  height: 20,
  borderRadius: '4px',
  border: '2px solid rgba(0,0,0,0.1)',
  background: color,
  cursor: 'pointer',
  transition: 'transform 0.1s ease',
  '&:hover': {
    transform: 'scale(1.15)',
  },
}));

// Common text colors
const TEXT_COLORS = [
  '#000000', '#424242', '#616161', '#9E9E9E',
  '#D32F2F', '#C2185B', '#7B1FA2', '#512DA8',
  '#303F9F', '#1976D2', '#0288D1', '#0097A7',
  '#00796B', '#388E3C', '#689F38', '#AFB42B',
  '#FBC02D', '#FFA000', '#F57C00', '#E64A19',
];

// Highlight colors
const HIGHLIGHT_COLORS = [
  '#FFEB3B', '#FFC107', '#FF9800', '#FF5722',
  '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
  '#2196F3', '#03A9F4', '#00BCD4', '#009688',
  '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B',
];

// Font families
const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Sans Serif', value: 'Arial, sans-serif' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Monospace', value: "'Fira Code', Consolas, monospace" },
  { label: 'Comic Sans', value: "'Comic Sans MS', cursive" },
];

interface EditorToolbarProps {
  editor: Editor;
}

export default function EditorToolbar({ editor }: EditorToolbarProps) {
  const theme = useTheme();
  const [headingAnchor, setHeadingAnchor] = useState<HTMLElement | null>(null);
  const [textColorAnchor, setTextColorAnchor] = useState<HTMLElement | null>(null);
  const [highlightAnchor, setHighlightAnchor] = useState<HTMLElement | null>(null);
  const [mathAnchor, setMathAnchor] = useState<HTMLElement | null>(null);
  const [mathInput, setMathInput] = useState('');
  const [mathInline, setMathInline] = useState(true);
  const [linkAnchor, setLinkAnchor] = useState<HTMLElement | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  // Heading menu
  const handleHeadingClick = (event: React.MouseEvent<HTMLElement>) => {
    setHeadingAnchor(event.currentTarget);
  };

  const handleHeadingClose = () => {
    setHeadingAnchor(null);
  };

  const setHeading = (level: 1 | 2 | 3) => {
    editor.chain().focus().toggleHeading({ level }).run();
    handleHeadingClose();
  };

  const setParagraph = () => {
    editor.chain().focus().setParagraph().run();
    handleHeadingClose();
  };

  // Text color menu
  const handleTextColorClick = (event: React.MouseEvent<HTMLElement>) => {
    setTextColorAnchor(event.currentTarget);
  };

  const handleTextColorClose = () => {
    setTextColorAnchor(null);
  };

  const setTextColor = (color: string) => {
    editor.chain().focus().setColor(color).run();
    handleTextColorClose();
  };

  // Highlight menu
  const handleHighlightClick = (event: React.MouseEvent<HTMLElement>) => {
    setHighlightAnchor(event.currentTarget);
  };

  const handleHighlightClose = () => {
    setHighlightAnchor(null);
  };

  const setHighlight = (color: string) => {
    editor.chain().focus().toggleHighlight({ color }).run();
    handleHighlightClose();
  };

  // Math dialog
  const handleMathClick = (event: React.MouseEvent<HTMLElement>) => {
    setMathAnchor(event.currentTarget);
    setMathInput('');
  };

  const handleMathClose = () => {
    setMathAnchor(null);
    setMathInput('');
  };

  const insertMath = () => {
    if (mathInput.trim()) {
      editor.commands.insertContent({
        type: 'mathJax',
        attrs: { content: mathInput, inline: mathInline },
      });
    }
    handleMathClose();
  };

  // Table insertion
  const insertTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

  // Hyperlink dialog
  const handleLinkClick = (event: React.MouseEvent<HTMLElement>) => {
    // Get current link if cursor is on a link
    const previousUrl = editor.getAttributes('link').href || '';
    setLinkUrl(previousUrl);
    // Get selected text for link text
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, '');
    setLinkText(selectedText);
    setLinkAnchor(event.currentTarget);
  };

  const handleLinkClose = () => {
    setLinkAnchor(null);
    setLinkUrl('');
    setLinkText('');
  };

  const insertLink = () => {
    if (linkUrl.trim()) {
      // Ensure URL has protocol
      let url = linkUrl.trim();
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }

      const { from, to } = editor.state.selection;
      const hasSelection = from !== to;

      if (hasSelection) {
        // Apply link to selected text
        editor.chain().focus().setLink({ href: url }).run();
      } else if (linkText.trim()) {
        // Insert new link with text
        editor
          .chain()
          .focus()
          .insertContent(`<a href="${url}">${linkText}</a>`)
          .run();
      } else {
        // Insert URL as both text and link
        editor
          .chain()
          .focus()
          .insertContent(`<a href="${url}">${url}</a>`)
          .run();
      }
    }
    handleLinkClose();
  };

  const removeLink = () => {
    editor.chain().focus().unsetLink().run();
    handleLinkClose();
  };

  // Font family change
  const handleFontChange = (event: any) => {
    const fontFamily = event.target.value;
    if (fontFamily) {
      editor.chain().focus().setFontFamily(fontFamily).run();
    } else {
      editor.chain().focus().unsetFontFamily().run();
    }
  };

  return (
    <ToolbarContainer>
      {/* Undo/Redo */}
      <Tooltip title="Undo (Ctrl+Z)">
        <span>
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            <UndoIcon />
          </ToolbarButton>
        </span>
      </Tooltip>
      <Tooltip title="Redo (Ctrl+Y)">
        <span>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          >
            <RedoIcon />
          </ToolbarButton>
        </span>
      </Tooltip>

      <ToolbarDivider orientation="vertical" flexItem />

      {/* Heading dropdown */}
      <Tooltip title="Heading">
        <ToolbarButton
          onClick={handleHeadingClick}
          isActive={
            editor.isActive('heading', { level: 1 }) ||
            editor.isActive('heading', { level: 2 }) ||
            editor.isActive('heading', { level: 3 })
          }
        >
          <TitleIcon />
        </ToolbarButton>
      </Tooltip>
      <Menu
        anchorEl={headingAnchor}
        open={Boolean(headingAnchor)}
        onClose={handleHeadingClose}
      >
        <MenuItem onClick={setParagraph}>Paragraph</MenuItem>
        <MenuItem onClick={() => setHeading(1)}>
          <span style={{ fontSize: '1.5em', fontWeight: 600 }}>Heading 1</span>
        </MenuItem>
        <MenuItem onClick={() => setHeading(2)}>
          <span style={{ fontSize: '1.25em', fontWeight: 600 }}>Heading 2</span>
        </MenuItem>
        <MenuItem onClick={() => setHeading(3)}>
          <span style={{ fontSize: '1.1em', fontWeight: 600 }}>Heading 3</span>
        </MenuItem>
      </Menu>

      {/* Font family (compact) */}
      <Select
        size="small"
        value=""
        onChange={handleFontChange}
        displayEmpty
        sx={{
          height: 32,
          minWidth: 80,
          fontSize: 12,
          '& .MuiSelect-select': { py: 0.5, px: 1 },
        }}
      >
        {FONT_FAMILIES.map((font) => (
          <MenuItem key={font.value} value={font.value} sx={{ fontFamily: font.value }}>
            {font.label}
          </MenuItem>
        ))}
      </Select>

      <ToolbarDivider orientation="vertical" flexItem />

      {/* Text formatting */}
      <Tooltip title="Bold (Ctrl+B)">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
        >
          <FormatBoldIcon />
        </ToolbarButton>
      </Tooltip>
      <Tooltip title="Italic (Ctrl+I)">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
        >
          <FormatItalicIcon />
        </ToolbarButton>
      </Tooltip>
      <Tooltip title="Underline (Ctrl+U)">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
        >
          <FormatUnderlinedIcon />
        </ToolbarButton>
      </Tooltip>
      <Tooltip title="Strikethrough">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
        >
          <StrikethroughSIcon />
        </ToolbarButton>
      </Tooltip>

      <ToolbarDivider orientation="vertical" flexItem />

      {/* Colors */}
      <Tooltip title="Text Color">
        <ToolbarButton onClick={handleTextColorClick}>
          <FormatColorTextIcon />
        </ToolbarButton>
      </Tooltip>
      <Popover
        open={Boolean(textColorAnchor)}
        anchorEl={textColorAnchor}
        onClose={handleTextColorClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 1.5, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.5 }}>
          {TEXT_COLORS.map((color) => (
            <ColorButton key={color} color={color} onClick={() => setTextColor(color)} />
          ))}
        </Box>
      </Popover>

      <Tooltip title="Highlight">
        <ToolbarButton onClick={handleHighlightClick} isActive={editor.isActive('highlight')}>
          <HighlightIcon />
        </ToolbarButton>
      </Tooltip>
      <Popover
        open={Boolean(highlightAnchor)}
        anchorEl={highlightAnchor}
        onClose={handleHighlightClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 1.5, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.5 }}>
          {HIGHLIGHT_COLORS.map((color) => (
            <ColorButton key={color} color={color} onClick={() => setHighlight(color)} />
          ))}
          <Button
            size="small"
            onClick={() => {
              editor.chain().focus().unsetHighlight().run();
              handleHighlightClose();
            }}
            sx={{ gridColumn: 'span 4', mt: 0.5, fontSize: 11 }}
          >
            Remove Highlight
          </Button>
        </Box>
      </Popover>

      <ToolbarDivider orientation="vertical" flexItem />

      {/* Lists */}
      <Tooltip title="Bullet List">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
        >
          <FormatListBulletedIcon />
        </ToolbarButton>
      </Tooltip>
      <Tooltip title="Numbered List">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
        >
          <FormatListNumberedIcon />
        </ToolbarButton>
      </Tooltip>
      <Tooltip title="Blockquote">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
        >
          <FormatQuoteIcon />
        </ToolbarButton>
      </Tooltip>

      <ToolbarDivider orientation="vertical" flexItem />

      {/* Code */}
      <Tooltip title="Code Block">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive('codeBlock')}
        >
          <CodeIcon />
        </ToolbarButton>
      </Tooltip>

      {/* Table */}
      <Tooltip title="Insert Table">
        <ToolbarButton onClick={insertTable}>
          <TableChartIcon />
        </ToolbarButton>
      </Tooltip>

      {/* Math */}
      <Tooltip title="Insert Math (LaTeX)">
        <ToolbarButton onClick={handleMathClick}>
          <FunctionsIcon />
        </ToolbarButton>
      </Tooltip>
      <Popover
        open={Boolean(mathAnchor)}
        anchorEl={mathAnchor}
        onClose={handleMathClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, width: 320 }}>
          <TextField
            fullWidth
            size="small"
            label="LaTeX Expression"
            placeholder="e.g., x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}"
            value={mathInput}
            onChange={(e) => setMathInput(e.target.value)}
            multiline
            rows={2}
            sx={{ mb: 1.5 }}
          />
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              size="small"
              variant={mathInline ? 'contained' : 'outlined'}
              onClick={() => setMathInline(true)}
            >
              Inline
            </Button>
            <Button
              size="small"
              variant={!mathInline ? 'contained' : 'outlined'}
              onClick={() => setMathInline(false)}
            >
              Block
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button size="small" onClick={handleMathClose}>
              Cancel
            </Button>
            <Button size="small" variant="contained" onClick={insertMath} disabled={!mathInput.trim()}>
              Insert
            </Button>
          </Box>
        </Box>
      </Popover>

      {/* Hyperlink (external URL) */}
      <Tooltip title="Insert Hyperlink (Ctrl+K)">
        <ToolbarButton onClick={handleLinkClick} isActive={editor.isActive('link')}>
          <InsertLinkIcon />
        </ToolbarButton>
      </Tooltip>
      <Popover
        open={Boolean(linkAnchor)}
        anchorEl={linkAnchor}
        onClose={handleLinkClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, width: 320 }}>
          <TextField
            fullWidth
            size="small"
            label="URL"
            placeholder="https://example.com"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            sx={{ mb: 1.5 }}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                insertLink();
              }
            }}
          />
          {!editor.state.selection.empty ? null : (
            <TextField
              fullWidth
              size="small"
              label="Link Text (optional)"
              placeholder="Click here"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              sx={{ mb: 1.5 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  insertLink();
                }
              }}
            />
          )}
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            {editor.isActive('link') && (
              <Button size="small" color="error" onClick={removeLink} startIcon={<LinkOffIcon />}>
                Remove
              </Button>
            )}
            <Button size="small" onClick={handleLinkClose}>
              Cancel
            </Button>
            <Button size="small" variant="contained" onClick={insertLink} disabled={!linkUrl.trim()}>
              {editor.isActive('link') ? 'Update' : 'Insert'}
            </Button>
          </Box>
        </Box>
      </Popover>

      {/* Wiki Link (internal notes/vocabulary/concepts) */}
      <Tooltip title="Insert Wiki Link [[...]]">
        <ToolbarButton
          onClick={() => {
            // Insert [[ to trigger suggestion
            editor.chain().focus().insertContent('[[').run();
          }}
        >
          <LinkIcon />
        </ToolbarButton>
      </Tooltip>
    </ToolbarContainer>
  );
}
