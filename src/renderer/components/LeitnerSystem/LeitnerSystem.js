import React, { useState, useEffect } from 'react';
import { Grid, Container, Typography, Box, Paper } from '@mui/material';
import { useSelector } from 'react-redux';

import FlipCard from './FlipCard';
import customStorage from '../../store/customStorage';
import { LeitnerSpeed, StudyMode } from '../../../commons/model/DataTypes';

import './FlipCard.css'; // Ensure this import for flip animations
import './LeitnerSystem.css'; // Import the new CSS file

import { dateToSQLiteString } from '../../../commons/utils/SqliteHelper';

function LeitnerSystem({ addVocabulary, isVocabulary }) {
  const [cards, setCards] = useState([]);
  const [leitnerSpeed, setLeitnerSpeed] = useState(LeitnerSpeed.Normal);

  useEffect(() => {
    if (addVocabulary) {
      setCards([...cards, addVocabulary]);
    }
  }, [addVocabulary]);

  useEffect(() => {
    async function t() {
      const l = await customStorage.getLeitnerSpeed();
      setLeitnerSpeed(l);
      if (isVocabulary) {
        const cardList = await customStorage.getVocabulariesByDueReview({
          dueTime: new Date(),
          page: 0,
          limit: 300,
        });
        setCards(cardList.data);
      } else {
        const cardList = await customStorage.getNotesByDueReview({
          dueTime: new Date(),
          page: 0,
          limit: 300,
        });
        setCards(cardList.data);
      }
    }
    t();
  }, []);

  const updateReviewDate = async (leitnerItem) => {
    const currentDate = new Date();
    if (leitnerItem.fullyLearned) {
      return;
    }
    if (leitnerItem.box === 5 && leitnerItem.skips >= 5 * leitnerSpeed) {
      leitnerItem.fullyLearned = true;
      await customStorage.updateLeitnerItem({
        id: leitnerItem.id,
        field: 'fully_learned',
        value: 1,
      });
    } else {
      let nextReviewDate = new Date();
      switch (leitnerItem.box) {
        case 1:
          nextReviewDate = new Date(
            currentDate.setDate(currentDate.getDate() + 1),
          );
          break;
        case 2:
          nextReviewDate = new Date(
            currentDate.setDate(currentDate.getDate() + 2),
          );
          break;
        case 3:
          nextReviewDate = new Date(
            currentDate.setDate(currentDate.getDate() + 4),
          );
          break;
        case 4:
          nextReviewDate = new Date(
            currentDate.setDate(currentDate.getDate() + 7),
          );
          break;
        case 5:
          nextReviewDate = new Date(
            currentDate.setDate(currentDate.getDate() + 14),
          );
          break;
        default:
          nextReviewDate = new Date();
      }
      const d = dateToSQLiteString(nextReviewDate);
      await customStorage.updateLeitnerItem({
        id: leitnerItem.id,
        field: 'next_review',
        value: d,
      });
    }
  };

  const handleCorrect = async (id) => {
    const c1 = cards.filter((m) => m.id === id)[0];
    if (!c1) return;
    const leitnerItem = { ...c1.leitnerItem, skips: c1.leitnerItem.skips + 1 };
    const card = {
      ...c1,
      leitnerItem,
    };
    await customStorage.updateLeitnerItem({
      id: leitnerItem.id,
      field: 'skips',
      value: leitnerItem.skips,
    });
    if (leitnerItem.skips % leitnerSpeed === 0) {
      if (leitnerItem.box < 5) leitnerItem.box += 1;
      await updateReviewDate(leitnerItem);
    }
    if (leitnerItem.box === 5 && leitnerItem.skips >= leitnerSpeed * 5) {
      await updateReviewDate(leitnerItem);
    }
    const cs = cards.filter((m) => m.id !== id);
    setCards([...cs, card]);
  };

  const handleIncorrect = async (id, isFlip) => {
    const c1 = cards.filter((m) => m.id === id)[0];
    if (!c1) return;
    const leitnerItem = { ...c1.leitnerItem, flips: c1.leitnerItem.flips + 1 };
    const card = { ...c1, leitnerItem };
    await customStorage.updateLeitnerItem({
      id: leitnerItem.id,
      field: 'flips',
      value: leitnerItem.flips,
    });
    if (!isFlip) {
      const cs = cards.filter((m) => m.id !== id);
      setCards([...cs, card]);
    }
  };

  const numCardsInStack = (boxNumber) => {
    const v = cards.filter((card) => card.leitnerItem.box === boxNumber).length;
    return v;
  };

  const renderCards = (boxNumber) => {
    const cs = cards.filter((card) => card.leitnerItem.box === boxNumber);
    return cs.length === 0 ? null : (
      <Grid item xs={12} key={cs[0].id}>
        <FlipCard
          card={cs[0]}
          onCorrect={handleCorrect}
          onIncorrect={handleIncorrect}
          isVocabulary={isVocabulary}
        />
      </Grid>
    );
  };

  return (
    <Container>
      <Typography
        variant="h7"
        sx={{
          marginLeft: '5px',
          marginTop: '25px',
          marginBottom: '25px',
          textDecoration: 'underline #DE3163',
        }}
      >
        Leitner Flashcards System ({isVocabulary ? 'Words' : 'Knowledge'} In
        Review)
      </Typography>
      <Grid container spacing={2}>
        {[1, 2, 3, 4, 5].map((boxNumber) => (
          <Grid item xs={12} md={4} key={boxNumber}>
            <Paper elevation={3}>
              <Box p={2} className="box-container">
                <div className="two_end_container">
                  <div className="two_end_start" style={{ border: 'none' }}>
                    <Typography
                      variant="caption"
                      sx={{
                        margin: '5px',
                        textDecoration: 'underline #6495ED',
                      }}
                    >
                      Stack {boxNumber}
                    </Typography>
                  </div>
                  <div className="two_end_end" style={{ border: 'none' }}>
                    <Typography
                      variant="caption"
                      sx={{
                        margin: '5px',
                        textDecoration: 'underline #40E0D0',
                      }}
                    >
                      {numCardsInStack(boxNumber)} Cards
                    </Typography>
                  </div>
                </div>
                {renderCards(boxNumber)}
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}

export default LeitnerSystem;
