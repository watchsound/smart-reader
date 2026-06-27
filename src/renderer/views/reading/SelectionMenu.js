/* eslint-disable react/require-default-props */
/**
 * SelectionMenu - Quick action menu for text selection in EPUB/PDF readers
 *
 * A floating menu that appears when text is selected, providing quick AI actions
 * like summarize, explain, grammar check, etc.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTheme, styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SummarizeIcon from '@mui/icons-material/Summarize';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SpellcheckIcon from '@mui/icons-material/Spellcheck';
import TranslateIcon from '@mui/icons-material/Translate';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ForumIcon from '@mui/icons-material/Forum';

// Floating toolbar container
const ToolbarContainer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  padding: '6px 8px',
  borderRadius: '24px',
  background: theme.palette.mode === 'dark'
    ? 'rgba(30, 33, 38, 0.95)'
    : 'rgba(255, 255, 255, 0.95)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
  boxShadow: theme.palette.mode === 'dark'
    ? '0 4px 24px rgba(0, 0, 0, 0.4)'
    : '0 4px 24px rgba(0, 0, 0, 0.12)',
  animation: 'toolbarSlideIn 0.15s ease-out',
  '@keyframes toolbarSlideIn': {
    '0%': {
      opacity: 0,
      transform: 'translateY(8px)',
    },
    '100%': {
      opacity: 1,
      transform: 'translateY(0)',
    },
  },
}));

// Icon button styling
const IconButton = styled(Box)(({ theme, iconcolor, disabled }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '32px',
  height: '32px',
  borderRadius: '50%',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  transition: 'all 0.15s ease',
  color: iconcolor || (theme.palette.mode === 'dark' ? '#e8e8e8' : '#1a1a1a'),
  '&:hover': {
    background: theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.12)'
      : 'rgba(0, 0, 0, 0.06)',
    transform: disabled ? 'none' : 'scale(1.1)',
  },
  '&:active': {
    transform: disabled ? 'none' : 'scale(0.95)',
  },
  '& .MuiSvgIcon-root': {
    fontSize: '18px',
  },
}));

// Divider between icon groups
const Divider = styled(Box)(({ theme }) => ({
  width: '1px',
  height: '20px',
  background: theme.palette.mode === 'dark'
    ? 'rgba(255, 255, 255, 0.15)'
    : 'rgba(0, 0, 0, 0.1)',
  margin: '0 4px',
}));

// Overlay to capture clicks outside
const Overlay = styled(Box)({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 9998,
  background: 'transparent',
});

/**
 * SelectionMenu - A floating toolbar for text selection actions
 *
 * @param {boolean} visible - Whether the menu is visible
 * @param {Object} position - Menu position { x, y }
 * @param {string} selectedText - Selected text content
 * @param {function} onClose - Callback when menu closes
 * @param {function} onAction - Callback when action is triggered (action, text)
 * @param {boolean} isLoading - Whether an action is in progress
 */
function SelectionMenu({
  visible,
  position,
  selectedText,
  onClose,
  onAction,
  isLoading = false,
}) {
  const theme = useTheme();
  const menuRef = useRef(null);
  const [adjustedPosition, setAdjustedPosition] = useState({ x: 0, y: 0 });

  // Calculate adjusted position to keep menu in viewport
  useEffect(() => {
    if (!visible || !position || !menuRef.current) return;

    const menu = menuRef.current;
    const menuRect = menu.getBoundingClientRect();
    const padding = 10;

    let x = position.x - menuRect.width / 2; // Center above selection
    let y = position.y - menuRect.height - 10; // Position above selection

    // Keep within horizontal bounds
    if (x + menuRect.width > window.innerWidth - padding) {
      x = window.innerWidth - menuRect.width - padding;
    }
    if (x < padding) {
      x = padding;
    }

    // If not enough space above, position below selection
    if (y < padding) {
      y = position.y + 20;
    }

    setAdjustedPosition({ x, y });
  }, [visible, position]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && visible) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [visible, onClose]);

  const handleAction = useCallback((action) => {
    if (isLoading) return;
    onAction(action, selectedText);
  }, [onAction, selectedText, isLoading]);

  const handleCopy = useCallback(() => {
    if (selectedText) {
      navigator.clipboard.writeText(selectedText);
    }
    onClose();
  }, [selectedText, onClose]);

  if (!visible) return null;

  const wordCount = selectedText?.trim().split(/\s+/).filter(w => w.length > 0).length || 0;
  const isLongText = wordCount >= 15;

  const style = {
    top: adjustedPosition.y || position?.y || -9999,
    left: adjustedPosition.x || position?.x || -9999,
    visibility: adjustedPosition.x === 0 && adjustedPosition.y === 0 ? 'hidden' : 'visible',
  };

  return (
    <>
      <Overlay onClick={onClose} />
      <ToolbarContainer ref={menuRef} style={style}>
        {/* Copy */}
        <Tooltip title="Copy" placement="top" arrow>
          <IconButton onClick={handleCopy} iconcolor="#1d9bd1">
            <ContentCopyIcon />
          </IconButton>
        </Tooltip>

        {/* Read Aloud */}
        <Tooltip title="Read Aloud" placement="top" arrow>
          <IconButton
            onClick={() => handleAction('tts')}
            iconcolor="#611f69"
            disabled={isLoading}
          >
            <VolumeUpIcon />
          </IconButton>
        </Tooltip>

        <Divider />

        {/* Summarize - only for longer text */}
        {isLongText && (
          <Tooltip title="Summarize" placement="top" arrow>
            <IconButton
              onClick={() => handleAction('summarize')}
              iconcolor="#9c27b0"
              disabled={isLoading}
            >
              <SummarizeIcon />
            </IconButton>
          </Tooltip>
        )}

        {/* Explain */}
        <Tooltip title="Explain" placement="top" arrow>
          <IconButton
            onClick={() => handleAction('explain')}
            iconcolor="#2196f3"
            disabled={isLoading}
          >
            <HelpOutlineIcon />
          </IconButton>
        </Tooltip>

        {/* Grammar Check */}
        <Tooltip title="Grammar Check" placement="top" arrow>
          <IconButton
            onClick={() => handleAction('grammar')}
            iconcolor="#4caf50"
            disabled={isLoading}
          >
            <SpellcheckIcon />
          </IconButton>
        </Tooltip>

        {/* Translate */}
        <Tooltip title="Translate" placement="top" arrow>
          <IconButton
            onClick={() => handleAction('translate')}
            iconcolor="#ff9800"
            disabled={isLoading}
          >
            <TranslateIcon />
          </IconButton>
        </Tooltip>

        <Divider />

        {/* Discuss — opens Study Forum thread anchored to this selection */}
        <Tooltip title="Discuss" placement="top" arrow>
          <IconButton
            onClick={() => handleAction('discuss')}
            iconcolor="#7E57C2"
            disabled={isLoading}
          >
            <ForumIcon />
          </IconButton>
        </Tooltip>

        {/* Smart Summary with animation */}
        {isLongText && (
          <Tooltip title="Smart Summary (with animation)" placement="top" arrow>
            <IconButton
              onClick={() => handleAction('smartSummary')}
              iconcolor="#e91e63"
              disabled={isLoading}
            >
              <AutoAwesomeIcon />
            </IconButton>
          </Tooltip>
        )}
      </ToolbarContainer>
    </>
  );
}

export default SelectionMenu;
