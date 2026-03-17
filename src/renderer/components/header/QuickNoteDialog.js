import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  IconButton,
  CircularProgress,
  Snackbar,
  Alert,
  Box,
  Typography,
} from '@mui/material';
import { styled, alpha, useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

import { useCreateNoteMutation } from '../../store/api/noteApiSlice';
import { NoteType } from '../../../commons/model/Note';
import { instanceInRender as aiProviderManager } from '../../../commons/service/AIProviderManager';
import getSummaryChatHistoryPrompt from '../../../commons/utils/AIPrompts';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: '12px',
    minWidth: 400,
    maxWidth: 500,
    background: theme.palette.background.paper,
    boxShadow:
      theme.palette.mode === 'dark'
        ? '0 16px 48px rgba(0, 0, 0, 0.5)'
        : '0 16px 48px rgba(0, 0, 0, 0.15)',
  },
  '& .MuiBackdrop-root': {
    backdropFilter: 'blur(4px)',
    background:
      theme.palette.mode === 'dark'
        ? 'rgba(0, 0, 0, 0.6)'
        : 'rgba(0, 0, 0, 0.3)',
  },
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: theme.shape.borderRadius * 1.5,
    transition: 'all 0.2s ease',
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: alpha(theme.palette.primary.main, 0.5),
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.palette.primary.main,
      borderWidth: 2,
    },
  },
}));

const GradientButton = styled(Button)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
  color: '#fff',
  fontWeight: 600,
  padding: '8px 20px',
  borderRadius: theme.shape.borderRadius * 1.5,
  textTransform: 'none',
  boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.4)}`,
  transition: 'all 0.2s ease',
  '&:hover': {
    background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
    boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.5)}`,
    transform: 'translateY(-1px)',
  },
  '&:disabled': {
    background: theme.palette.action.disabledBackground,
    color: theme.palette.action.disabled,
    boxShadow: 'none',
  },
}));

/**
 * Count sentences in text by counting sentence-ending punctuation.
 */
function countSentences(text) {
  if (!text || !text.trim()) return 0;
  // Match sentence-ending punctuation (. ! ?)
  // Also handle Chinese/Japanese sentence endings (。！？)
  const matches = text.match(/[.!?。！？]+/g);
  return matches ? matches.length : 0;
}

/**
 * Generate a default title from content (first 50 characters).
 */
function generateDefaultTitle(content) {
  if (!content) return 'Quick Note';
  const trimmed = content.trim();
  if (trimmed.length <= 50) return trimmed;
  return `${trimmed.substring(0, 50)}...`;
}

function QuickNoteDialog({ open, onClose, onSaved = null }) {
  const theme = useTheme();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });
  const inputRef = useRef(null);

  const [CreateNote] = useCreateNoteMutation();

  useEffect(() => {
    if (open) {
      setContent('');
      // Auto-focus input when dialog opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleClose = () => {
    if (!loading) {
      setContent('');
      onClose();
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSave = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      showSnackbar('Please enter some content', 'warning');
      return;
    }

    setLoading(true);
    try {
      const sentenceCount = countSentences(trimmedContent);
      let title = generateDefaultTitle(trimmedContent);
      let tags = [];

      // If 2+ sentences, use AI to generate title and tags
      if (sentenceCount >= 2) {
        try {
          const prompt = getSummaryChatHistoryPrompt(trimmedContent, []);
          const result = await aiProviderManager.sendChatMessage(
            prompt,
            '',
            {},
            true,
          );

          if (result && typeof result === 'object') {
            if (result.title) title = result.title;
            if (result.keywords && Array.isArray(result.keywords)) {
              tags = result.keywords;
            }
          }
        } catch (aiError) {
          console.warn(
            'AI metadata generation failed, using defaults:',
            aiError,
          );
          // Continue with default title/tags
        }
      }

      // Create the note
      const note = {
        sourceKey: '',
        title,
        cards: [
          { text: trimmedContent, html: '', image: '' },
          { text: '', html: '', image: '' },
          { text: '', html: '', image: '' },
        ],
        sourceType: NoteType.Note,
        color: '',
        tags,
        rate: 0,
        position: [],
        emoji: '',
        highlightOnly: false,
        highlightType: '',
        hasQuiz: false,
      };

      const result = await CreateNote(note);

      if (result && !result.error) {
        const savedTitle =
          title.length > 30 ? `${title.substring(0, 30)}...` : title;
        showSnackbar(`Note "${savedTitle}" saved!`, 'success');
        onSaved?.(result);
        handleClose();
      } else {
        showSnackbar('Failed to save note', 'error');
      }
    } catch (error) {
      console.error('Error saving note:', error);
      showSnackbar('An error occurred. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    // Save on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !loading) {
      e.preventDefault();
      handleSave();
    }
  };

  const sentenceCount = countSentences(content);
  const willUseAI = sentenceCount >= 2;

  return (
    <>
      <StyledDialog
        open={open}
        onClose={handleClose}
        aria-labelledby="quick-note-dialog-title"
      >
        <DialogTitle
          id="quick-note-dialog-title"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NoteAddOutlinedIcon
              sx={{ color: theme.palette.primary.main, fontSize: 20 }}
            />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Quick Note
            </Typography>
          </Box>
          <IconButton
            aria-label="close"
            onClick={handleClose}
            disabled={loading}
            size="small"
            sx={{ color: theme.palette.text.secondary }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Jot down your thoughts. Press Ctrl+Enter to save.
          </Typography>
          <StyledTextField
            inputRef={inputRef}
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            placeholder="Write your note here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
          {willUseAI && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                mt: 1,
                color: theme.palette.info.main,
              }}
            >
              <AutoAwesomeIcon sx={{ fontSize: 14 }} />
              <Typography variant="caption">
                AI will generate title & tags for this note
              </Typography>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={handleClose}
            disabled={loading}
            sx={{ textTransform: 'none' }}
          >
            Cancel
          </Button>
          <GradientButton
            onClick={handleSave}
            disabled={loading || !content.trim()}
            startIcon={
              loading ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            {loading ? 'Saving...' : 'Save'}
          </GradientButton>
        </DialogActions>
      </StyledDialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

QuickNoteDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func,
};

export default QuickNoteDialog;
