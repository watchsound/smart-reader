import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  Button,
  Typography,
  IconButton,
  Box,
  Menu,
  MenuItem,
} from '@mui/material';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PianoIcon from '@mui/icons-material/Piano';
// import InfoIcon from '@mui/icons-material/Info';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import TurnedInIcon from '@mui/icons-material/TurnedIn';
import customStorage from '../../../store/customStorage';

function VocabularyCard({ word, definition, examples }) {
  const [revealed, setRevealed] = useState(false);
  const [slideIn, setSlideIn] = useState(false);
  const [maxHeight, setMaxHeight] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const questionCardRef = useRef(null);
  const answerCardRef = useRef(null);

  useEffect(() => {
    // Calculate the heights of both cards after rendering
    const questionHeight = questionCardRef.current?.scrollHeight || 0;
    const answerHeight = answerCardRef.current?.scrollHeight || 0;

    // Set the maximum height as the height for both cards
    setMaxHeight(Math.max(questionHeight, answerHeight));
  }, [word, definition, examples]);

  const handleReveal = () => {
    setSlideIn(true);
    setTimeout(() => setRevealed(true), 300); // Delay to allow the slide animation
  };

  const handleBack = () => {
    setRevealed(false);
    setSlideIn(false);
    // setTimeout(() => setRevealed(false), 300);
  };

  const handleIconClick = (event) => {
    setAnchorEl(event.currentTarget); // Set the anchor for the menu
  };

  const handleMenuClose = () => {
    setAnchorEl(null); // Close the menu
  };

  const handleAction1 = async () => {
    await customStorage.createVocabulary({
      word,
      detail: {
        definition: definition || '',
        root: '',
        example: (examples || []).join('\n') || '',
      },
      setId: -1,
      score: 0,
    });
    handleMenuClose();
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
              <AutoStoriesIcon
                sx={{ marginRight: 1, fontSize: 16, color: '#f1c40f' }}
              />
              <Typography variant="h8" sx={{ fontWeight: 300 }}>
                Build your vocab
              </Typography>
              <Box sx={{ marginLeft: 'auto' }}>
                <IconButton onClick={handleIconClick}>
                  <TurnedInIcon
                    sx={{ marginRight: 1, fontSize: 16, color: '#f1c40f' }}
                  />
                </IconButton>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleMenuClose}
                >
                  <MenuItem onClick={handleAction1}>Add To Vocabulary</MenuItem>
                </Menu>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" sx={{ marginTop: 0, color: '#2f4f4f' }}>
                {word}
              </Typography>
              <Typography
                variant="h12"
                sx={{ marginTop: 0, fontWeight: 300, color: '#2f4f4f' }}
              >
                {definition}
              </Typography>
            </Box>
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
                Examples
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
            <>
              <Box sx={{ marginLeft: 'auto' }}>
                <PlayArrowIcon sx={{ fontSize: 16, color: 'white' }} />
              </Box>
              <Typography variant="body4" sx={{ fontWeight: 300 }}>
                {examples[0]}
              </Typography>
            </>
            {examples[1] && (
              <>
                <Box sx={{ marginLeft: 'auto' }}>
                  <PlayArrowIcon sx={{ fontSize: 16, color: 'white' }} />
                </Box>
                <Typography variant="body4" sx={{ fontWeight: 300 }}>
                  {examples[1]}
                </Typography>
              </>
            )}
            {examples[2] && (
              <>
                <Box sx={{ marginLeft: 'auto' }}>
                  <PlayArrowIcon sx={{ fontSize: 16, color: 'white' }} />
                </Box>
                <Typography variant="body4" sx={{ fontWeight: 300 }}>
                  {examples[2]}
                </Typography>
              </>
            )}
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

export default VocabularyCard;
