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
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

import customStorage from '../../store/customStorage';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: '12px',
    minWidth: 360,
    maxWidth: 420,
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

function QuickWordDialog({ open, onClose, onSaved = null }) {
  const theme = useTheme();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success',
  });
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setInput('');
      // Auto-focus input when dialog opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleClose = () => {
    if (!loading) {
      setInput('');
      onClose();
    }
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSave = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      showSnackbar('Please enter a word', 'warning');
      return;
    }

    setLoading(true);
    try {
      // Check if input contains "=" for word=definition format
      if (trimmedInput.includes('=')) {
        const [word, definition] = trimmedInput.split('=').map((s) => s.trim());
        if (!word) {
          showSnackbar('Please enter a valid word', 'warning');
          setLoading(false);
          return;
        }
        // Save directly with provided definition
        const result = await customStorage.createVocabulary({
          word,
          definition: definition || '',
          relatedWords: '',
          example: '',
          setId: -1,
          score: 0,
        });
        if (result) {
          showSnackbar(`"${word}" saved successfully!`, 'success');
          onSaved?.(result);
          handleClose();
        } else {
          showSnackbar('Failed to save word', 'error');
        }
      } else {
        // Use LLM to fetch definition
        const result = await customStorage.addToVocabulary(trimmedInput);
        if (result) {
          showSnackbar(
            `"${trimmedInput}" saved with AI definition!`,
            'success',
          );
          onSaved?.(result);
          handleClose();
        } else {
          showSnackbar('Failed to get definition. Try again.', 'error');
        }
      }
    } catch (error) {
      console.error('Error saving vocabulary:', error);
      showSnackbar('An error occurred. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !loading) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <>
      <StyledDialog
        open={open}
        onClose={handleClose}
        aria-labelledby="quick-word-dialog-title"
      >
        <DialogTitle
          id="quick-word-dialog-title"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeIcon
              sx={{ color: theme.palette.primary.main, fontSize: 20 }}
            />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Quick Add Word
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
            Enter a word to look up with AI, or use &quot;word=definition&quot;
            to save directly.
          </Typography>
          <StyledTextField
            inputRef={inputRef}
            fullWidth
            variant="outlined"
            placeholder="ephemeral or ephemeral=short-lived"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            InputProps={{
              endAdornment: loading && (
                <CircularProgress size={20} sx={{ mr: 1 }} />
              ),
            }}
          />
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
            disabled={loading || !input.trim()}
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

QuickWordDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func,
};

export default QuickWordDialog;
