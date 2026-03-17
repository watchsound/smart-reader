import React, { useState } from 'react';
import {
  Button,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Tooltip,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';

function InputButton({
  label,
  className,
  onSave,
  icon,
  size = 'medium',
  variant = 'default',
  tooltip = 'Add new',
  dialogTitle = 'Enter Name',
  placeholder = 'Enter name...',
  sx = {},
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setText('');
  };

  const handleSave = () => {
    if (text.trim()) {
      onSave(text.trim());
    }
    setOpen(false);
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && text.trim()) {
      handleSave();
    }
  };

  // Icon-only button variant (subtle design)
  if (variant === 'icon' || (!label && icon)) {
    return (
      <>
        <Tooltip title={tooltip} arrow placement="top">
          <IconButton
            size="small"
            onClick={handleClickOpen}
            className={className}
            sx={{
              width: 28,
              height: 28,
              borderRadius: '8px',
              color: theme.palette.text.secondary,
              bgcolor: 'transparent',
              border: `1px dashed ${alpha(theme.palette.text.disabled, 0.3)}`,
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                borderColor: theme.palette.primary.main,
                borderStyle: 'solid',
                color: theme.palette.primary.main,
              },
              ...sx,
            }}
          >
            {icon || <AddIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
        <Dialog
          open={open}
          onClose={handleClose}
          PaperProps={{
            sx: {
              borderRadius: '12px',
              minWidth: 320,
            },
          }}
        >
          <DialogTitle sx={{ pb: 1 }}>{dialogTitle}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              placeholder={placeholder}
              type="text"
              fullWidth
              variant="outlined"
              size="small"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={handleClose} size="small">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              variant="contained"
              size="small"
              disabled={!text.trim()}
              disableElevation
            >
              Create
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  // Default button variant (original style, improved)
  return (
    <>
      <Button
        variant="contained"
        color="primary"
        className={className}
        size={size}
        startIcon={icon}
        onClick={handleClickOpen}
        disableElevation
        sx={{
          height: size === 'small' ? 32 : 36,
          borderRadius: '8px',
          textTransform: 'none',
          fontWeight: 500,
          ...sx,
        }}
      >
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            borderRadius: '12px',
            minWidth: 320,
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>{dialogTitle}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            placeholder={placeholder}
            type="text"
            fullWidth
            variant="outlined"
            size="small"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} size="small">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            size="small"
            disabled={!text.trim()}
            disableElevation
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default InputButton;
