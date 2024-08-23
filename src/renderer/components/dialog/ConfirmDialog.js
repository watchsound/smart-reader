import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import SmallButton from '../Button/SmallButton';

// ConfirmDialog Component
function ConfirmDialog({ isOpen, onClose, onConfirm, title, message }) {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">{title}</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <SmallButton onClick={onClose}>Disagree</SmallButton>
        <SmallButton onClick={onConfirm} autoFocus>
          Agree
        </SmallButton>
      </DialogActions>
    </Dialog>
  );
}
export default ConfirmDialog;
