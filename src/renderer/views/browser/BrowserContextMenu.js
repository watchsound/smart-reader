/* eslint-disable react/require-default-props */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme, styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import ScreenshotMonitorIcon from '@mui/icons-material/ScreenshotMonitor';
import ImageIcon from '@mui/icons-material/Image';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import LinkIcon from '@mui/icons-material/Link';
import QuizIcon from '@mui/icons-material/Quiz';
import AccessibilityNewIcon from '@mui/icons-material/AccessibilityNew';
import AnalyticsIcon from '@mui/icons-material/Analytics';

// Overlay to capture clicks outside the menu
const Overlay = styled(Box)({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 9998,
  background: 'transparent',
});

// Glass-morphism styled menu container
const MenuContainer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  zIndex: 9999,
  minWidth: '220px',
  padding: '8px 0',
  borderRadius: '12px',
  background: theme.palette.mode === 'dark'
    ? 'rgba(30, 33, 38, 0.95)'
    : 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
  boxShadow: theme.palette.mode === 'dark'
    ? '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)'
    : '0 8px 32px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.02)',
  animation: 'menuSlideIn 0.15s ease-out',
  transformOrigin: 'top left',
  '@keyframes menuSlideIn': {
    '0%': {
      opacity: 0,
      transform: 'scale(0.95) translateY(-8px)',
    },
    '100%': {
      opacity: 1,
      transform: 'scale(1) translateY(0)',
    },
  },
}));

// Menu item styling
const MenuItem = styled(Box)(({ theme, disabled }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '10px 16px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  transition: 'all 0.15s ease',
  color: theme.palette.mode === 'dark' ? '#e8e8e8' : '#1a1a1a',
  fontSize: '13px',
  fontWeight: 500,
  fontFamily: "'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  '&:hover': {
    background: theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.08)'
      : 'rgba(0, 0, 0, 0.04)',
  },
  '&:active': {
    background: theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.12)'
      : 'rgba(0, 0, 0, 0.08)',
    transform: 'scale(0.98)',
  },
}));

// Icon wrapper with color tint
const IconWrapper = styled(Box)(({ iconcolor }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  borderRadius: '8px',
  background: iconcolor ? `${iconcolor}15` : 'rgba(29, 155, 209, 0.1)',
  color: iconcolor || '#1d9bd1',
  '& .MuiSvgIcon-root': {
    fontSize: '16px',
  },
}));

// Divider
const MenuDivider = styled(Box)(({ theme }) => ({
  height: '1px',
  margin: '6px 12px',
  background: theme.palette.mode === 'dark'
    ? 'rgba(255, 255, 255, 0.08)'
    : 'rgba(0, 0, 0, 0.06)',
}));

// Menu header for selected text preview
const MenuHeader = styled(Box)(({ theme }) => ({
  padding: '8px 16px 12px',
  borderBottom: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)'}`,
  marginBottom: '4px',
}));

const SelectedTextPreview = styled(Box)(({ theme }) => ({
  fontSize: '12px',
  color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.45)',
  fontStyle: 'italic',
  maxWidth: '220px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontFamily: "'Lato', sans-serif",
}));

const MenuLabel = styled(Box)(({ theme }) => ({
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.35)',
  marginBottom: '4px',
}));

// Keyboard shortcut indicator
const Shortcut = styled(Box)(({ theme }) => ({
  marginLeft: 'auto',
  fontSize: '11px',
  color: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
  fontFamily: 'monospace',
  padding: '2px 6px',
  borderRadius: '4px',
  background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
}));

// Helper function to count words in text
const countWords = (text) => {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
};

// Thresholds for different menu options
const VOCABULARY_MAX_WORDS = 3; // Show "Add to Vocabulary" for 1-3 words
const ANALYSIS_MIN_WORDS = 15; // Show summary/mindmap/entity links for 15+ words

/**
 * BrowserContextMenu - A beautiful glass-morphism context menu for the browser view
 *
 * @param {boolean} visible - Whether the menu is visible
 * @param {Object} position - Menu position { x, y }
 * @param {string} menuType - Type of menu: 'word', 'selection', 'regular', 'image', 'paragraph'
 * @param {string} selectedText - Selected text content
 * @param {string} imageUrl - Image URL (for image menu)
 * @param {string} sourceElementId - ID of source element for paragraph actions
 * @param {function} onClose - Callback when menu closes
 * @param {function} onCommand - Callback when command is triggered (command, text, imageUrl, sourceElementId)
 */
function BrowserContextMenu({
  visible,
  position,
  menuType,
  selectedText,
  imageUrl,
  sourceElementId,
  onClose,
  onCommand,
}) {
  const theme = useTheme();
  const menuRef = useRef(null);
  const [adjustedPosition, setAdjustedPosition] = useState({ x: 0, y: 0 });

  // Calculate adjusted position after menu renders
  useEffect(() => {
    if (!visible || !position || !menuRef.current) return;

    const menu = menuRef.current;
    const menuRect = menu.getBoundingClientRect();
    const padding = 10;

    let x = position.x;
    let y = position.y;

    // Adjust horizontal position - keep menu within viewport
    if (x + menuRect.width > window.innerWidth - padding) {
      x = Math.max(padding, window.innerWidth - menuRect.width - padding);
    }
    if (x < padding) {
      x = padding;
    }

    // Adjust vertical position - keep menu within viewport
    if (y + menuRect.height > window.innerHeight - padding) {
      y = Math.max(padding, window.innerHeight - menuRect.height - padding);
    }
    if (y < padding) {
      y = padding;
    }

    setAdjustedPosition({ x, y });
  }, [visible, position, menuType]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && visible) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [visible, onClose]);

  const handleItemClick = useCallback((command) => {
    onCommand(command, selectedText, imageUrl, sourceElementId);
    onClose();
  }, [onCommand, selectedText, imageUrl, sourceElementId, onClose]);

  const handleOverlayClick = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!visible) return null;

  // Initial position (before adjustment) - place off-screen initially to measure
  const initialStyle = {
    top: adjustedPosition.y || position?.y || -9999,
    left: adjustedPosition.x || position?.x || -9999,
    visibility: adjustedPosition.x === 0 && adjustedPosition.y === 0 ? 'hidden' : 'visible',
  };

  // Word selection menu (single word - for vocabulary)
  if (menuType === 'word') {
    return (
      <>
        <Overlay onClick={handleOverlayClick} />
        <MenuContainer ref={menuRef} style={initialStyle}>
          <MenuHeader>
            <MenuLabel>Selected Word</MenuLabel>
            <SelectedTextPreview>"{selectedText}"</SelectedTextPreview>
          </MenuHeader>
          <MenuItem onClick={() => handleItemClick('addToWordList')}>
            <IconWrapper iconcolor="#2eb67d">
              <AutoStoriesIcon />
            </IconWrapper>
            Save for Study
          </MenuItem>
        </MenuContainer>
      </>
    );
  }

  // Text selection menu (multiple words)
  if (menuType === 'selection') {
    const wordCount = countWords(selectedText);
    const isShortText = wordCount <= VOCABULARY_MAX_WORDS;
    const isLongText = wordCount >= ANALYSIS_MIN_WORDS;

    return (
      <>
        <Overlay onClick={handleOverlayClick} />
        <MenuContainer ref={menuRef} style={initialStyle}>
          <MenuHeader>
            <MenuLabel>Selected Text ({wordCount} word{wordCount !== 1 ? 's' : ''})</MenuLabel>
            <SelectedTextPreview>
              "{selectedText?.length > 30 ? selectedText.substring(0, 30) + '...' : selectedText}"
            </SelectedTextPreview>
          </MenuHeader>

          <MenuItem onClick={() => handleItemClick('copy')}>
            <IconWrapper iconcolor="#1d9bd1">
              <ContentCopyIcon />
            </IconWrapper>
            Copy
            <Shortcut>Ctrl+C</Shortcut>
          </MenuItem>

          <MenuItem onClick={() => handleItemClick('tts-for-selection')}>
            <IconWrapper iconcolor="#611f69">
              <VolumeUpIcon />
            </IconWrapper>
            Read Aloud
          </MenuItem>

          <MenuDivider />

          <MenuItem onClick={() => handleItemClick('createCard')}>
            <IconWrapper iconcolor="#ecb22e">
              <NoteAddIcon />
            </IconWrapper>
            Create Note Card
          </MenuItem>

          <MenuItem onClick={() => handleItemClick('presentation')}>
            <IconWrapper iconcolor="#e01e5a">
              <SlideshowIcon />
            </IconWrapper>
            Slide Show
          </MenuItem>

          {/* AI analysis options - only show for longer text */}
          {isLongText && (
            <>
              <MenuItem onClick={() => handleItemClick('smartSummary')}>
                <IconWrapper iconcolor="#9c27b0">
                  <AutoAwesomeIcon />
                </IconWrapper>
                Smart Summary
              </MenuItem>

              <MenuItem onClick={() => handleItemClick('mindmap')}>
                <IconWrapper iconcolor="#00bcd4">
                  <AccountTreeIcon />
                </IconWrapper>
                Mind Map
              </MenuItem>

              <MenuItem onClick={() => handleItemClick('entityLinks')}>
                <IconWrapper iconcolor="#FF6B6B">
                  <LinkIcon />
                </IconWrapper>
                Entity Links
              </MenuItem>

              <MenuDivider />

              <MenuItem onClick={() => handleItemClick('quizGenerate')}>
                <IconWrapper iconcolor="#4CAF50">
                  <QuizIcon />
                </IconWrapper>
                Generate Quiz
              </MenuItem>

              <MenuItem onClick={() => handleItemClick('simplifyText')}>
                <IconWrapper iconcolor="#FF9800">
                  <AccessibilityNewIcon />
                </IconWrapper>
                Simplify Text
              </MenuItem>

              <MenuItem onClick={() => handleItemClick('analyzeStructure')}>
                <IconWrapper iconcolor="#3F51B5">
                  <AnalyticsIcon />
                </IconWrapper>
                5W Analysis
              </MenuItem>
            </>
          )}

          {/* Vocabulary option - only show for short text (1-3 words) */}
          {isShortText && (
            <>
              <MenuDivider />
              <MenuItem onClick={() => handleItemClick('addToWordList')}>
                <IconWrapper iconcolor="#2eb67d">
                  <AutoStoriesIcon />
                </IconWrapper>
                Add to Vocabulary
              </MenuItem>
            </>
          )}
        </MenuContainer>
      </>
    );
  }

  // Paragraph action menu (from paragraph icons)
  if (menuType === 'paragraph') {
    const wordCount = countWords(selectedText);

    return (
      <>
        <Overlay onClick={handleOverlayClick} />
        <MenuContainer ref={menuRef} style={initialStyle}>
          <MenuHeader>
            <MenuLabel>Paragraph ({wordCount} words)</MenuLabel>
            <SelectedTextPreview>
              "{selectedText?.length > 30 ? selectedText.substring(0, 30) + '...' : selectedText}"
            </SelectedTextPreview>
          </MenuHeader>

          <MenuItem onClick={() => handleItemClick('copy')}>
            <IconWrapper iconcolor="#1d9bd1">
              <ContentCopyIcon />
            </IconWrapper>
            Copy
          </MenuItem>

          <MenuItem onClick={() => handleItemClick('tts-for-selection')}>
            <IconWrapper iconcolor="#611f69">
              <VolumeUpIcon />
            </IconWrapper>
            Read Aloud
          </MenuItem>

          <MenuDivider />

          <MenuItem onClick={() => handleItemClick('createCard')}>
            <IconWrapper iconcolor="#ecb22e">
              <NoteAddIcon />
            </IconWrapper>
            Create Note Card
          </MenuItem>

          <MenuItem onClick={() => handleItemClick('presentation')}>
            <IconWrapper iconcolor="#e01e5a">
              <SlideshowIcon />
            </IconWrapper>
            Slide Show
          </MenuItem>

          <MenuItem onClick={() => handleItemClick('smartSummary')}>
            <IconWrapper iconcolor="#9c27b0">
              <AutoAwesomeIcon />
            </IconWrapper>
            Smart Summary
          </MenuItem>

          <MenuItem onClick={() => handleItemClick('mindmap')}>
            <IconWrapper iconcolor="#00bcd4">
              <AccountTreeIcon />
            </IconWrapper>
            Mind Map
          </MenuItem>

          <MenuItem onClick={() => handleItemClick('entityLinks')}>
            <IconWrapper iconcolor="#FF6B6B">
              <LinkIcon />
            </IconWrapper>
            Entity Links
          </MenuItem>

          <MenuDivider />

          <MenuItem onClick={() => handleItemClick('quizGenerate')}>
            <IconWrapper iconcolor="#4CAF50">
              <QuizIcon />
            </IconWrapper>
            Generate Quiz
          </MenuItem>

          <MenuItem onClick={() => handleItemClick('simplifyText')}>
            <IconWrapper iconcolor="#FF9800">
              <AccessibilityNewIcon />
            </IconWrapper>
            Simplify Text
          </MenuItem>

          <MenuItem onClick={() => handleItemClick('analyzeStructure')}>
            <IconWrapper iconcolor="#3F51B5">
              <AnalyticsIcon />
            </IconWrapper>
            5W Analysis
          </MenuItem>
        </MenuContainer>
      </>
    );
  }

  // Regular right-click menu (no selection)
  if (menuType === 'regular') {
    return (
      <>
        <Overlay onClick={handleOverlayClick} />
        <MenuContainer ref={menuRef} style={initialStyle}>
          <MenuItem onClick={() => handleItemClick('screenshot')}>
            <IconWrapper iconcolor="#1d9bd1">
              <ScreenshotMonitorIcon />
            </IconWrapper>
            Screenshot Area
          </MenuItem>
          <MenuItem onClick={() => handleItemClick('bookmark')}>
            <IconWrapper iconcolor="#ecb22e">
              <BookmarkAddIcon />
            </IconWrapper>
            Bookmark Page
          </MenuItem>
        </MenuContainer>
      </>
    );
  }

  // Image context menu
  if (menuType === 'image') {
    return (
      <>
        <Overlay onClick={handleOverlayClick} />
        <MenuContainer ref={menuRef} style={initialStyle}>
          <MenuHeader>
            <MenuLabel>Image</MenuLabel>
            <SelectedTextPreview>
              {imageUrl?.length > 30 ? '...' + imageUrl.substring(imageUrl.length - 30) : imageUrl}
            </SelectedTextPreview>
          </MenuHeader>
          <MenuItem onClick={() => handleItemClick('saveImage')}>
            <IconWrapper iconcolor="#2eb67d">
              <ImageIcon />
            </IconWrapper>
            Save Image
          </MenuItem>
          <MenuItem onClick={() => handleItemClick('copyImage')}>
            <IconWrapper iconcolor="#1d9bd1">
              <ContentCopyIcon />
            </IconWrapper>
            Copy Image
          </MenuItem>
        </MenuContainer>
      </>
    );
  }

  return null;
}

export default BrowserContextMenu;
