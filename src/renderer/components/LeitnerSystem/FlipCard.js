import React, { useRef, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  CardActions,
  Tooltip,
  IconButton,
} from '@mui/material';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import PsychologyAltIcon from '@mui/icons-material/PsychologyAlt';

import './FlipCard.css'; // Import the CSS file for flip animation
// import DiagramNoteUI from '../MoodBoard/diagram/DiagramNoteUI';
import NoteUI from '../note/NoteUI';

// Debounce function
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};


function FlipCard({ card, isVocabulary, onCorrect, onIncorrect }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const updateSize = () => {
    if (containerRef.current) {
      const { offsetWidth, offsetHeight } = containerRef.current;
      setSize({ width: offsetWidth, height: offsetHeight });
    }
  };
  const debouncedUpdateSize = debounce(updateSize, 200);

  useEffect(() => {
    updateSize();
    window.addEventListener('resize', debouncedUpdateSize);
    return () => {
      window.removeEventListener('resize', debouncedUpdateSize);
    };
  }, []);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
    onIncorrect(card.id, true);
  };
  if (isVocabulary)
    return (
      <div className={`flip-card ${isFlipped ? 'flipped' : ''}`}>
        <div className="flip-card-inner">
          <div className="flip-card-front">
            <Card sx={{ mb: 2 }}>
              <CardContent sx={{ maxHeight: 320, overflowY: 'auto' }}>
                <Typography variant="h5" component="div">
                  {card.word}
                </Typography>
              </CardContent>
              <CardActions>
                <div className="two_end_container">
                  <div className="two_end_start" style={{ border: 'none' }}>
                    <Tooltip title="Got it!">
                      <IconButton
                        size="small"
                        onClick={() => onCorrect(card.id)}
                        aria-label="yes"
                      >
                        <HowToRegIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </div>
                  <div className="two_end_end" style={{ border: 'none' }}>
                    <Tooltip title="Flip">
                      <IconButton
                        size="small"
                        onClick={() => handleFlip()}
                        aria-label="edit"
                      >
                        <AutoStoriesIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </div>
                </div>
              </CardActions>
            </Card>
          </div>
          <div className="flip-card-back">
            <Card>
              <CardContent sx={{ maxHeight: 320, overflowY: 'auto' }}>
                <Typography
                  sx={{ fontSize: 14, textDecoration: 'underline green' }}
                  color="text.secondary"
                  gutterBottom
                >
                  Definition
                </Typography>
                <Typography variant="h7" component="div">
                  {card.definition ? card.definition : ''}
                </Typography>
                <Typography
                  sx={{ mb: 1.5, textDecoration: 'underline green' }}
                  color="text.secondary"
                >
                  {card.relatedWords ? `Related::  ${card.relatedWords}` : ''}
                </Typography>
                <Typography variant="body2">
                  {card.example ? `Example::  ${card.example}` : ''}
                </Typography>
              </CardContent>
              <CardActions>
                <div className="two_end_container">
                  <div className="two_end_start" style={{ border: 'none' }}>
                    <Tooltip title="Got it!">
                      <IconButton
                        size="small"
                        onClick={() => onCorrect(card.id)}
                        aria-label="yes"
                      >
                        <HowToRegIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Not Yet!">
                      <IconButton
                        size="small"
                        onClick={() => onIncorrect(card.id, false)}
                        aria-label="no"
                      >
                        <PsychologyAltIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </div>
                  <div className="two_end_end" style={{ border: 'none' }}>
                    <Tooltip title="Flip">
                      <IconButton
                        size="small"
                        onClick={() => handleFlip()}
                        aria-label="edit"
                      >
                        <AutoStoriesIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </div>
                </div>
              </CardActions>
            </Card>
          </div>
        </div>
      </div>
    );
  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ overflowY: 'auto' }}>
          <NoteUI
            key={card.id}
            selectedNoteKey={card.id}
            selectHandler={() => {}}
            compactView
            showControl={false}
            useBgColor
            cardWidth={size.width - 20}
            cardHeight={size.height - 20}
          />
        </CardContent>
        <CardActions>
          <div className="two_end_container">
            <div className="two_end_start" style={{ border: 'none' }}>
              <Tooltip title="Got it!">
                <IconButton
                  size="small"
                  onClick={() => onCorrect(card.id)}
                  aria-label="yes"
                >
                  <HowToRegIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </div>
            <div className="two_end_end" style={{ border: 'none' }}>
              <Tooltip title="Not Sure">
                <IconButton
                  size="small"
                  onClick={() => onIncorrect(card.id)}
                  aria-label="edit"
                >
                  <AutoStoriesIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </div>
          </div>
        </CardActions>
      </Card>
    </div>
  );
}

export default FlipCard;
