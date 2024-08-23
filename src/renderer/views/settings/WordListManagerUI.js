/* eslint-disable prettier/prettier */
import React, { useState, useEffect } from 'react';
import { Button, TextField, Paper, } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';


import SmallButton from '../../components/Button/SmallButton';
import customStorage from '../../store/customStorage';

function WordListManagerUI({studyModeForKeywords}) {
  const [words, setWords] = useState([]);
  const [input, setInput] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    async function t() {
      const v = customStorage.getKeyWordList(studyModeForKeywords);
      setWords(v || [])
    }
    t();
  }, [studyModeForKeywords]);

  const handleAddWord = async () => {
    if (!input) return;
    const v = input.trim();
   // const stemmer = natural.PorterStemmer;
   // const stem = stemmer.stem(v);
    if (v && !words.includes(v)) {
      await customStorage.addToKeyWordList(studyModeForKeywords, v);
      setWords([...words, v]);
      setInput('');
    }
  };

  const handleDeleteWord = async () => {
    if (selectedIndex >= 0) {
      const deleted = words.filter((_, index) => index === selectedIndex);
      await customStorage.removeFromKeyWordList(studyModeForKeywords, deleted);
      const newWords = words.filter((_, index) => index !== selectedIndex);
      setWords(newWords);
      setSelectedIndex(-1); // Reset selection
    }
  };

  const handleClear = async () => {
    await customStorage.setKeyWordList(studyModeForKeywords, []);
    setWords([]);
    setSelectedIndex(-1);
  };

  const handleSelectWord = (index) => {
    setSelectedIndex(index);
  };

  return (
    <div style={{ padding: 20 }}>
      <div
        style={{
          overflowY: 'auto',
          maxHeight: 300,
          backgroundColor: '#cceeff',
          padding: 20,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        {words.map((word, index) => (
          <Paper
            key={index}
            style={{
              padding: 10,
              cursor: 'pointer',
              backgroundColor: selectedIndex === index ? '#add8e6' : undefined,
            }}
            onClick={() => handleSelectWord(index)}
          >
            {word}
          </Paper>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', marginTop: 5 }}>
        <TextField
          label="Input here..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          variant="outlined"
          fullWidth
          margin="normal"
          size="small"
          sx={{   marginRight: '10px'}}
          InputProps={{
            sx: {
              height: '28px',
              '& .MuiOutlinedInput-input': {
                height: '28px',
                padding: '6px 14px',
              },
              '& .MuiOutlinedInput-root': {
                height: '28px',
              },
            },
          }}
        />
        <SmallButton
          onClick={handleAddWord}
          variant="contained"
          color="primary"
          style={{ marginRight: 10 }}
        >
          Add
        </SmallButton>
        <SmallButton
          onClick={handleDeleteWord}
          variant="contained"
          color="secondary"
          startIcon={<DeleteIcon />}
          disabled={selectedIndex === -1}
          style={{ marginRight: 10 }}
        >
          Delete
        </SmallButton>
         <SmallButton
          onClick={handleClear}
          variant="contained"
          color="secondary"
          startIcon={<DeleteForeverIcon />}
          style={{ marginRight: 10 }}
        >
          Clear
        </SmallButton>
      </div>
    </div>
  );
}

export default WordListManagerUI;
