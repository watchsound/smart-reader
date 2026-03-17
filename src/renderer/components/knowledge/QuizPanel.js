/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
/* eslint-disable react/no-array-index-key */
/* eslint-disable no-nested-ternary */
/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * QuizPanel - Beautiful visualization for Quiz questions
 *
 * Displays multiple-choice quiz questions with interactive answer selection.
 * Shows correct/incorrect feedback after answering.
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  RadioGroup,
  FormControlLabel,
  Radio,
  Button,
  Chip,
  Collapse,
  IconButton,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RefreshIcon from '@mui/icons-material/Refresh';

/**
 * Single question card with answer options
 */
function QuestionCard({ question, index, onAnswer, userAnswer, showAnswer, compact }) {
  const options = question.options || {};
  const optionKeys = ['optionA', 'optionB', 'optionC', 'optionD'];
  const optionLabels = ['A', 'B', 'C', 'D'];

  const isCorrect = userAnswer === question.answer;
  const hasAnswered = userAnswer !== null && userAnswer !== undefined;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 1.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: hasAnswered
          ? isCorrect
            ? 'success.main'
            : 'error.main'
          : 'divider',
        bgcolor: hasAnswered
          ? isCorrect
            ? 'rgba(76, 175, 80, 0.05)'
            : 'rgba(244, 67, 54, 0.05)'
          : 'background.paper',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Question header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5 }}>
        <Box
          sx={{
            minWidth: 28,
            height: 28,
            borderRadius: '50%',
            bgcolor: hasAnswered
              ? isCorrect
                ? 'success.main'
                : 'error.main'
              : 'primary.main',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {hasAnswered ? (
            isCorrect ? (
              <CheckCircleIcon sx={{ fontSize: 18 }} />
            ) : (
              <CancelIcon sx={{ fontSize: 18 }} />
            )
          ) : (
            index + 1
          )}
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.5 }}>
          {question.question}
        </Typography>
      </Box>

      {/* Answer options */}
      <RadioGroup
        value={userAnswer || ''}
        onChange={(e) => !hasAnswered && onAnswer(e.target.value)}
        sx={{ ml: 4 }}
      >
        {optionKeys.map((key, idx) => {
          const optionLabel = optionLabels[idx];
          const optionText = options[key];
          if (!optionText) return null;

          const isThisCorrect = optionLabel === question.answer;
          const isThisSelected = userAnswer === optionLabel;

          return (
            <FormControlLabel
              key={key}
              value={optionLabel}
              disabled={hasAnswered}
              control={
                <Radio
                  size="small"
                  sx={{
                    py: 0.5,
                    color: hasAnswered && isThisCorrect ? 'success.main' : undefined,
                    '&.Mui-checked': {
                      color: hasAnswered
                        ? isThisCorrect
                          ? 'success.main'
                          : 'error.main'
                        : 'primary.main',
                    },
                  }}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={optionLabel}
                    size="small"
                    sx={{
                      height: 20,
                      minWidth: 20,
                      fontSize: 11,
                      fontWeight: 600,
                      bgcolor: hasAnswered && isThisCorrect
                        ? 'success.main'
                        : hasAnswered && isThisSelected && !isThisCorrect
                        ? 'error.main'
                        : 'action.hover',
                      color: hasAnswered && (isThisCorrect || isThisSelected)
                        ? 'white'
                        : 'text.primary',
                    }}
                  />
                  <Typography
                    variant="body2"
                    sx={{
                      color: hasAnswered && isThisCorrect
                        ? 'success.main'
                        : hasAnswered && isThisSelected && !isThisCorrect
                        ? 'error.main'
                        : 'text.primary',
                      fontWeight: hasAnswered && isThisCorrect ? 600 : 400,
                    }}
                  >
                    {optionText}
                  </Typography>
                </Box>
              }
              sx={{
                my: 0.25,
                mx: 0,
                borderRadius: 1,
                px: 1,
                py: 0.25,
                '&:hover': {
                  bgcolor: hasAnswered ? 'transparent' : 'action.hover',
                },
              }}
            />
          );
        })}
      </RadioGroup>

      {/* Show correct answer hint after wrong answer */}
      {hasAnswered && !isCorrect && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 1,
            ml: 4,
            color: 'success.main',
            fontWeight: 500,
          }}
        >
          Correct answer: {question.answer}
        </Typography>
      )}
    </Paper>
  );
}

/**
 * Main QuizPanel component
 */
export default function QuizPanel({
  quiz = [],
  questionCount,
  difficulty,
  compact = false,
}) {
  const [answers, setAnswers] = useState({});
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // Handle invalid data
  if (!quiz || !Array.isArray(quiz) || quiz.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No quiz questions generated.
        </Typography>
      </Box>
    );
  }

  const handleAnswer = (questionIndex, answer) => {
    setAnswers((prev) => ({
      ...prev,
      [questionIndex]: answer,
    }));
  };

  const handleReset = () => {
    setAnswers({});
  };

  const answeredCount = Object.keys(answers).length;
  const correctCount = Object.entries(answers).filter(
    ([idx, ans]) => quiz[parseInt(idx, 10)]?.answer === ans
  ).length;

  const displayQuiz = compact && !showAll ? quiz.slice(0, 3) : quiz;
  const hasMore = compact && quiz.length > 3;

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header with stats */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={500}>
            {quiz.length} question{quiz.length !== 1 ? 's' : ''}
            {difficulty && ` • ${difficulty}`}
          </Typography>
          {answeredCount > 0 && (
            <Chip
              size="small"
              label={`${correctCount}/${answeredCount} correct`}
              sx={{
                height: 20,
                fontSize: 10,
                bgcolor:
                  correctCount === answeredCount
                    ? 'success.main'
                    : correctCount > answeredCount / 2
                    ? 'warning.main'
                    : 'error.main',
                color: 'white',
              }}
            />
          )}
        </Box>
        <Box>
          {answeredCount > 0 && (
            <IconButton size="small" onClick={handleReset} title="Reset quiz">
              <RefreshIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>

      {/* Questions */}
      <Collapse in={expanded}>
        {displayQuiz.map((question, index) => (
          <QuestionCard
            key={index}
            question={question}
            index={index}
            onAnswer={(answer) => handleAnswer(index, answer)}
            userAnswer={answers[index]}
            showAnswer={answers[index] !== undefined}
            compact={compact}
          />
        ))}

        {/* Show more button */}
        {hasMore && !showAll && (
          <Box
            sx={{
              textAlign: 'center',
              mt: 1,
              cursor: 'pointer',
              color: 'primary.main',
              '&:hover': { textDecoration: 'underline' },
            }}
            onClick={() => setShowAll(true)}
          >
            <Typography variant="caption">
              Show {quiz.length - 3} more question{quiz.length - 3 !== 1 ? 's' : ''}...
            </Typography>
          </Box>
        )}

        {/* Final score */}
        {answeredCount === quiz.length && (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              mt: 2,
              borderRadius: 2,
              bgcolor:
                correctCount === quiz.length
                  ? 'rgba(76, 175, 80, 0.1)'
                  : correctCount >= quiz.length / 2
                  ? 'rgba(255, 152, 0, 0.1)'
                  : 'rgba(244, 67, 54, 0.1)',
              border: '1px solid',
              borderColor:
                correctCount === quiz.length
                  ? 'success.main'
                  : correctCount >= quiz.length / 2
                  ? 'warning.main'
                  : 'error.main',
              textAlign: 'center',
            }}
          >
            <Typography variant="h6" fontWeight={600}>
              {correctCount === quiz.length
                ? '🎉 Perfect Score!'
                : correctCount >= quiz.length / 2
                ? '👍 Good Job!'
                : '📚 Keep Studying!'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You got {correctCount} out of {quiz.length} correct (
              {Math.round((correctCount / quiz.length) * 100)}%)
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleReset}
              sx={{ mt: 1 }}
            >
              Try Again
            </Button>
          </Paper>
        )}
      </Collapse>
    </Box>
  );
}
