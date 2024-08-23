import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from '@mui/material';

function CreateVocabularyModal({ word, open, onClose, onSave }) {
  const [vocabulary, setVocabulary] = useState({
    name: word || '',
    definition: '',
    relatedWord: '',
    example: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setVocabulary({ ...vocabulary, [name]: value });
  };

  const handleSave = () => {
    onSave(vocabulary);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Create Vocabulary</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          name="name"
          label="Name"
          type="text"
          fullWidth
          value={vocabulary.name}
          onChange={handleChange}
        />
        <TextField
          margin="dense"
          name="definition"
          label="Definition"
          type="text"
          fullWidth
          multiline
          rows={4}
          value={vocabulary.definition}
          onChange={handleChange}
        />
        <TextField
          margin="dense"
          name="relatedWord"
          label="Related Word"
          type="text"
          fullWidth
          value={vocabulary.relatedWord}
          onChange={handleChange}
        />
        <TextField
          margin="dense"
          name="example"
          label="Example"
          type="text"
          fullWidth
          multiline
          rows={4}
          value={vocabulary.example}
          onChange={handleChange}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Cancel
        </Button>
        <Button onClick={handleSave} color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CreateVocabularyModal;
