import * as React from 'react';
import { useState } from 'react';
import { styled, alpha, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';

// Icons
import EditNoteIcon from '@mui/icons-material/EditNote';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import BorderColorIcon from '@mui/icons-material/BorderColor';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import RemoveIcon from '@mui/icons-material/Remove';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import BalanceIcon from '@mui/icons-material/Balance';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

import { markTypes } from './AnnotationNoteUtil';
import EmojiList from '../../components/emoji/EmojiList';

export const SelectionType = Object.freeze({
  Note: 'note',
  // Inline note created via the expand-in-place flow: saved alongside the
  // highlight without opening CreateNoteModal. Carries only the typed text.
  QuickNote: 'quick-note',
  Image: 'image',
  Highlight: 'highlight',
  Presentation: 'presentation',
  SmartSummary: 'smartSummary',
  MindMap: 'mindmap',
  ArgumentXray: 'argumentXray',
  Cancel: 'cancel',
});

// Professional styled container
// 320 fits the 6-icon Quick Actions row (6×40 + 5×8 gap = 280, plus
// 14×2 Section padding = 308). The previous 280 left the rightmost
// Argument X-ray icon clipped against the panel edge.
const PanelContainer = styled(Box)(({ theme }) => ({
  width: 320,
  borderRadius: 12,
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.palette.mode === 'dark'
    ? '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)'
    : '0 8px 32px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
  overflow: 'hidden',
}));

// Section styling
const Section = styled(Box)(({ theme }) => ({
  padding: '12px 14px',
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  '&:last-child': {
    borderBottom: 'none',
  },
}));

const SectionLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.65rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: theme.palette.text.secondary,
  marginBottom: 8,
}));

// Style button (for highlight types)
const StyleButton = styled(Box)(({ theme, selected }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  borderRadius: 8,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  backgroundColor: selected
    ? alpha(theme.palette.primary.main, 0.12)
    : 'transparent',
  border: selected
    ? `2px solid ${theme.palette.primary.main}`
    : `1px solid ${alpha(theme.palette.divider, 0.15)}`,
  color: selected ? theme.palette.primary.main : theme.palette.text.secondary,
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
    borderColor: alpha(theme.palette.primary.main, 0.5),
  },
}));

// Color dot
const ColorDot = styled(Box)(({ color, selected, theme }) => ({
  width: 24,
  height: 24,
  borderRadius: '50%',
  backgroundColor: color,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  border: selected
    ? `3px solid ${theme.palette.primary.main}`
    : '2px solid transparent',
  boxShadow: selected
    ? `0 0 0 2px ${alpha(theme.palette.primary.main, 0.3)}`
    : 'none',
  '&:hover': {
    transform: 'scale(1.15)',
  },
}));

// Action button
const ActionButton = styled(Box)(({ theme, variant, disabled }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 14px',
  borderRadius: 8,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  transition: 'all 0.15s ease',
  backgroundColor: variant === 'primary'
    ? theme.palette.primary.main
    : variant === 'secondary'
    ? alpha(theme.palette.secondary.main, 0.1)
    : 'transparent',
  color: variant === 'primary'
    ? theme.palette.primary.contrastText
    : variant === 'secondary'
    ? theme.palette.secondary.main
    : theme.palette.text.primary,
  '&:hover': {
    backgroundColor: variant === 'primary'
      ? theme.palette.primary.dark
      : variant === 'secondary'
      ? alpha(theme.palette.secondary.main, 0.2)
      : alpha(theme.palette.action.hover, 0.8),
  },
}));

// Quick action icon button
const QuickAction = styled(IconButton)(({ theme, actioncolor }) => ({
  width: 40,
  height: 40,
  borderRadius: 10,
  color: actioncolor || theme.palette.text.secondary,
  backgroundColor: actioncolor
    ? alpha(actioncolor, 0.1)
    : alpha(theme.palette.action.hover, 0.5),
  transition: 'all 0.15s ease',
  '&:hover': {
    backgroundColor: actioncolor
      ? alpha(actioncolor, 0.2)
      : alpha(theme.palette.action.hover, 0.8),
    transform: 'scale(1.05)',
  },
}));

// Predefined colors
const HIGHLIGHT_COLORS = [
  '#FFEB3B', // Yellow
  '#4CAF50', // Green
  '#2196F3', // Blue
  '#E91E63', // Pink
  '#FF9800', // Orange
  '#9C27B0', // Purple
];

function CreateAnnotationPanel({
  handleWindowClose,
  setMarkColor,
  setMarkType,
  setEmoji,
  showImageOption,
  showPresentOption,
  showSmartSummaryOption = true,
  showMindMapOption = true,
}) {
  const theme = useTheme();
  const [selectedStyle, setSelectedStyle] = useState('highlight');
  const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0]);
  const [selectedEmoji, setSelectedEmoji] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  // Quick Note expand-in-place state. When `noteExpanded` is true the
  // panel grows downward with a textarea; saving with non-empty text
  // dispatches SelectionType.QuickNote (annotation + inline note, no
  // modal). When false the save button behaves as plain "Save Highlight".
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [noteText, setNoteText] = useState('');

  const handleStyleSelect = (style) => {
    setSelectedStyle(style);
    setMarkType(markTypes[style.charAt(0).toUpperCase() + style.slice(1)] || markTypes.Highlight);
  };

  const handleColorSelect = (color) => {
    setSelectedColor(color);
    setMarkColor(color);
  };

  const handleEmojiSelect = (emoji) => {
    const emojiChar = emoji.native || emoji;
    setSelectedEmoji(emojiChar);
    setEmoji(emojiChar);
  };

  const handleClose = (selectionType, extraText) => {
    handleWindowClose(
      selectionType,
      selectedStyle,
      selectedColor,
      selectedEmoji,
      extraText,
    );
  };

  // Note quick-action: toggle the expanded textarea instead of immediately
  // opening the modal. The "Open full editor →" link inside the expanded
  // section provides the modal escape hatch.
  const handleNoteIconClick = () => {
    setNoteExpanded((v) => !v);
  };

  // Save button: dispatches QuickNote when the panel is expanded and the
  // user has typed something; otherwise behaves as Save Highlight.
  const handleSaveClick = () => {
    const text = noteText.trim();
    if (noteExpanded && text) {
      handleClose(SelectionType.QuickNote, text);
    } else {
      handleClose(SelectionType.Highlight);
    }
  };

  const styles = [
    { id: 'highlight', icon: <FormatColorFillIcon sx={{ fontSize: 18 }} />, label: 'Highlight' },
    { id: 'underline', icon: <BorderColorIcon sx={{ fontSize: 18 }} />, label: 'Underline' },
    { id: 'strikeline', icon: <StrikethroughSIcon sx={{ fontSize: 18 }} />, label: 'Strike' },
    { id: 'dashline', icon: <RemoveIcon sx={{ fontSize: 18 }} />, label: 'Dash' },
  ];

  return (
    <PanelContainer>
      {/* Quick Actions Row */}
      <Section sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
            Annotate
          </Typography>
          <Tooltip title="Cancel">
            <IconButton size="small" onClick={() => handleClose(SelectionType.Cancel)} sx={{ p: 0.5 }}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Primary Actions */}
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
          <Tooltip title={noteExpanded ? 'Hide note' : 'Add a note'}>
            <QuickAction
              data-testid="quick-note-toggle"
              actioncolor="#2196F3"
              onClick={handleNoteIconClick}
            >
              <EditNoteIcon sx={{ fontSize: 20 }} />
            </QuickAction>
          </Tooltip>
          {showImageOption && (
            <Tooltip title="Screenshot Note">
              <QuickAction actioncolor="#4CAF50" onClick={() => handleClose(SelectionType.Image)}>
                <CameraAltIcon sx={{ fontSize: 20 }} />
              </QuickAction>
            </Tooltip>
          )}
          {showPresentOption && (
            <Tooltip title="Present">
              <QuickAction actioncolor="#FF9800" onClick={() => handleClose(SelectionType.Presentation)}>
                <SlideshowIcon sx={{ fontSize: 20 }} />
              </QuickAction>
            </Tooltip>
          )}
          {showSmartSummaryOption && (
            <Tooltip title="Smart Summary">
              <QuickAction actioncolor="#E91E63" onClick={() => handleClose(SelectionType.SmartSummary)}>
                <AutoAwesomeIcon sx={{ fontSize: 20 }} />
              </QuickAction>
            </Tooltip>
          )}
          {showMindMapOption && (
            <Tooltip title="Mind Map">
              <QuickAction actioncolor="#00BCD4" onClick={() => handleClose(SelectionType.MindMap)}>
                <AccountTreeIcon sx={{ fontSize: 20 }} />
              </QuickAction>
            </Tooltip>
          )}
          <Tooltip title="Argument X-ray (highlight claims vs evidence)">
            <QuickAction
              actioncolor="#d4b86a"
              onClick={() => handleClose(SelectionType.ArgumentXray)}
            >
              <BalanceIcon sx={{ fontSize: 20 }} />
            </QuickAction>
          </Tooltip>
        </Box>
      </Section>

      {/* Quick Note Section — placed directly under the Quick Actions row
          so the textarea appears right next to the Note icon click target.
          Collapsed by default; expanded when the user clicks the Note
          quick-action. Save Highlight commits both. */}
      <Collapse in={noteExpanded} unmountOnExit>
        <Section>
          <SectionLabel>Your note</SectionLabel>
          <TextField
            data-testid="quick-note-textarea"
            multiline
            minRows={3}
            fullWidth
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note (optional)"
            inputProps={{ 'aria-label': 'Add a note (optional)' }}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontSize: '0.85rem',
              },
            }}
          />
          <Box sx={{ textAlign: 'right', mt: 0.75 }}>
            <Box
              component="button"
              type="button"
              data-testid="quick-note-full-editor"
              onClick={() => handleClose(SelectionType.Note)}
              sx={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: theme.palette.text.secondary,
                '&:hover': {
                  color: theme.palette.primary.main,
                  textDecoration: 'underline',
                },
              }}
            >
              Open full editor →
            </Box>
          </Box>
        </Section>
      </Collapse>

      {/* Highlight Style Section */}
      <Section>
        <SectionLabel>Style</SectionLabel>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {styles.map((style) => (
            <Tooltip key={style.id} title={style.label}>
              <StyleButton
                data-testid={`style-${style.id}`}
                selected={selectedStyle === style.id}
                onClick={() => handleStyleSelect(style.id)}
              >
                {style.icon}
              </StyleButton>
            </Tooltip>
          ))}
        </Box>
      </Section>

      {/* Color Section */}
      <Section>
        <SectionLabel>Color</SectionLabel>
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-start' }}>
          {HIGHLIGHT_COLORS.map((color) => (
            <Tooltip key={color} title={color}>
              <ColorDot
                color={color}
                selected={selectedColor === color}
                onClick={() => handleColorSelect(color)}
              />
            </Tooltip>
          ))}
        </Box>
      </Section>

      {/* Emoji Section */}
      <Section>
        <SectionLabel>Emoji</SectionLabel>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {selectedEmoji && (
            <Box
              sx={{
                fontSize: '1.2rem',
                padding: '4px 8px',
                borderRadius: 1,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
              }}
            >
              {selectedEmoji}
            </Box>
          )}
          <Box sx={{ flex: 1 }}>
            <EmojiList onEmojiClick={handleEmojiSelect} />
          </Box>
        </Box>
      </Section>

      {/* Save Button — label tracks the currently selected style so the
          user knows whether they're saving a highlight, underline, etc.
          When the Quick Note section is expanded with text typed, the
          label reads "+ Note" to signal the inline save will include it. */}
      <Section sx={{ pt: 1 }}>
        <ActionButton
          data-testid="save-annotation"
          variant="primary"
          onClick={handleSaveClick}
          sx={{ width: '100%', justifyContent: 'center' }}
        >
          <CheckIcon sx={{ fontSize: 18 }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Save{' '}
            {styles.find((s) => s.id === selectedStyle)?.label || 'Highlight'}
            {noteExpanded && noteText.trim() ? ' + Note' : ''}
          </Typography>
        </ActionButton>
      </Section>
    </PanelContainer>
  );
}

export default CreateAnnotationPanel;
