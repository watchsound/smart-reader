import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  Button,
  Typography,
  IconButton,
  Box,
} from '@mui/material';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PianoIcon from '@mui/icons-material/Piano';
import InfoIcon from '@mui/icons-material/Info';

function TapToReveal({ title, question, answer }) {
  const [revealed, setRevealed] = useState(false);
  const [slideIn, setSlideIn] = useState(false);
  const [maxHeight, setMaxHeight] = useState(0);

  const questionCardRef = useRef(null);
  const answerCardRef = useRef(null);

  useEffect(() => {
    // Calculate the heights of both cards after rendering
    const questionHeight = questionCardRef.current?.scrollHeight || 0;
    const answerHeight = answerCardRef.current?.scrollHeight || 0;

    // Set the maximum height as the height for both cards
    setMaxHeight(Math.max(questionHeight, answerHeight));
  }, [title, question, answer]);

  const handleReveal = () => {
    setSlideIn(true);
    setTimeout(() => setRevealed(true), 300); // Delay to allow the slide animation
  };

  const handleBack = () => {
    setRevealed(false);
    setSlideIn(false);
  };

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        maxWidth: 600,
        margin: '0 auto',
        padding: 2,
        borderRadius: '10px',
        transition: 'height 0.3s ease-in-out',
        overflow: 'hidden',
        height: maxHeight > 0 ? `${maxHeight}px` : 'auto', // Apply max height dynamically
      }}
    >
      {/* First Card */}
      {!revealed && (
        <Card
          ref={questionCardRef} // Reference to measure height
          sx={{
            position: 'relative',
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            transition: 'transform 0.3s ease-in-out',
            transform: slideIn ? 'translateX(-100%)' : 'translateX(0)',
          }}
        >
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <LightbulbIcon
                sx={{ marginRight: 1, fontSize: 16, color: '#f1c40f' }}
              />
              <Typography variant="h8" sx={{ fontWeight: 300 }}>
                Stop & think
              </Typography>
              <Box sx={{ marginLeft: 'auto' }}>
                <InfoIcon sx={{ fontSize: 16, color: '#2f4f4f' }} />
              </Box>
            </Box>
            <Typography variant="body4" sx={{ marginTop: 2, color: '#2f4f4f' }}>
              {title}
            </Typography>
            <Typography
              variant="h9"
              sx={{ marginTop: 2, fontWeight: 300, color: '#2f4f4f' }}
            >
              {question}
            </Typography>
            <Box
              sx={{
                marginTop: 3,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <Button
                onClick={handleReveal}
                variant="contained"
                sx={{
                  backgroundColor: '#2f4f4f',
                  color: 'white',
                  paddingX: 4,
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <PianoIcon
                  sx={{ marginRight: 1, fontSize: 16, color: '#f1c40f' }}
                />
                Tap to reveal
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Second Card (Answer) */}
      {revealed && (
        <Card
          ref={answerCardRef} // Reference to measure height
          sx={{
            position: 'relative',
            backgroundColor: '#2f4f4f',
            color: '#ffffff',
            borderRadius: '10px',
            transition: 'transform 0.3s ease-in-out',
            transform: slideIn ? 'translateX(0)' : 'translateX(100%)',
          }}
        >
          <CardContent>
            <Typography variant="body4" sx={{ fontWeight: 300 }}>
              {answer}
            </Typography>
            <IconButton
              onClick={handleBack}
              sx={{
                position: 'absolute',
                bottom: 10,
                right: 10,
                backgroundColor: '#ffffff',
                borderRadius: '50%',
              }}
            >
              <ArrowBackIcon sx={{ color: '#2f4f4f' }} />
            </IconButton>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

export default TapToReveal;
