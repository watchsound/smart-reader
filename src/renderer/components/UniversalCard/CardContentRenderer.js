/**
 * CardContentRenderer.js
 *
 * Renders content based on item type and rendering mode.
 * Handles: text, STEM (formula/problem), quiz, mindmap, image
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { Box, Typography, TextField, Button, CircularProgress, Alert } from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Check as CheckIcon,
  Close as CloseIcon,
  ArrowForward as NextIcon,
} from '@mui/icons-material';
import MindmapSurface from '../mindmap/MindmapSurface';

/**
 * Load MathJax if needed
 */
const loadMathJax = () => {
  if (window.MathJax) return Promise.resolve();

  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src*="mathjax"]')) {
      // Already loading. Bound the poll so a failed/blocked CDN load
      // doesn't leave setInterval running forever — 10s should be plenty
      // for MathJax to call startup.ready or for the request to give up.
      let attempts = 0;
      const maxAttempts = 100; // 100 * 100ms = 10s
      const checkLoaded = setInterval(() => {
        attempts += 1;
        if (window.MathJax) {
          clearInterval(checkLoaded);
          resolve();
        } else if (attempts >= maxAttempts) {
          clearInterval(checkLoaded);
          reject(new Error('MathJax failed to load within 10s'));
        }
      }, 100);
      return;
    }

    window.MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']],
      },
      startup: {
        ready: () => {
          window.MathJax.startup.defaultReady();
          resolve();
        },
      },
    };

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
    script.async = true;
    document.head.appendChild(script);
  });
};

/**
 * Render MathJax in a container
 */
const renderMathJax = async (containerRef) => {
  try {
    await loadMathJax();
  } catch (err) {
    console.warn('MathJax load failed; skipping math render:', err.message);
    return;
  }
  if (window.MathJax?.typesetPromise && containerRef?.current) {
    try {
      await window.MathJax.typesetPromise([containerRef.current]);
    } catch (err) {
      console.warn('MathJax rendering error:', err);
    }
  }
};

/**
 * Dynamic font size based on content length
 */
const getContentFontSize = (text, isLong = false) => {
  if (!text) return '1.5rem';
  const len = typeof text === 'string' ? text.length : 50;

  if (isLong) {
    if (len <= 50) return '1.1rem';
    if (len <= 100) return '1rem';
    if (len <= 200) return '0.95rem';
    return '0.9rem';
  }

  if (len <= 20) return '2rem';
  if (len <= 40) return '1.6rem';
  if (len <= 60) return '1.3rem';
  if (len <= 100) return '1.1rem';
  return '1rem';
};

/**
 * Get text content from item (handles string or object)
 */
const getTextContent = (content) => {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (typeof content === 'object') {
    return content.text || content.html || '';
  }
  return '';
};

/**
 * Check if content contains LaTeX
 */
const hasLatex = (text) => {
  if (!text) return false;
  return (
    text.includes('$') ||
    text.includes('\\(') ||
    text.includes('\\[') ||
    text.includes('\\frac') ||
    text.includes('\\sqrt')
  );
};

/**
 * Text Mode Renderer - Simple text display
 */
function TextModeRenderer({ item, side, domainColor }) {
  const text = side === 'front' ? getTextContent(item.front) : getTextContent(item.back);
  const contentRef = useRef(null);

  // Render MathJax if content has LaTeX
  useEffect(() => {
    if (hasLatex(text)) {
      renderMathJax(contentRef);
    }
  }, [text]);

  return (
    <Box ref={contentRef} sx={{ textAlign: 'center', width: '100%' }}>
      <Typography
        sx={{
          fontWeight: side === 'front' ? 700 : 400,
          fontSize: getContentFontSize(text, side === 'back'),
          lineHeight: 1.6,
          wordBreak: 'break-word',
        }}
      >
        {text}
      </Typography>

      {/* Show extra info on back (examples, related words) */}
      {side === 'back' && item.extras?.example && (
        <Typography
          variant="body2"
          sx={{ mt: 2, color: 'text.secondary', fontStyle: 'italic' }}
        >
          Example: {item.extras.example}
        </Typography>
      )}

      {side === 'back' && item.extras?.relatedWords && (
        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
          Related: {item.extras.relatedWords}
        </Typography>
      )}
    </Box>
  );
}

/**
 * STEM Mode Renderer - Formula/problem with answer input
 */
function STEMModeRenderer({
  item,
  side,
  domainColor,
  answer,
  onAnswerChange,
  onVerify,
  verificationResult,
  isVerifying,
  showSolution,
  currentSolutionStep,
  onRevealNextStep,
}) {
  const contentRef = useRef(null);
  const frontText = getTextContent(item.front);
  const backText = getTextContent(item.back);

  // Render MathJax
  useEffect(() => {
    renderMathJax(contentRef);
  }, [frontText, backText, side, showSolution, currentSolutionStep]);

  // Parse solution steps
  const solutionSteps = useMemo(() => {
    const solution = item.extras?.solution;
    if (!solution) return [];

    // Parse markdown-style steps: ## Step 1: Title\nContent
    const stepRegex = /##\s*Step\s*(\d+)[:\s]*([^\n]*)\n([\s\S]*?)(?=##\s*Step|$)/gi;
    const steps = [];
    let match;

    while ((match = stepRegex.exec(solution)) !== null) {
      steps.push({
        number: parseInt(match[1], 10),
        title: match[2].trim(),
        content: match[3].trim(),
      });
    }

    // If no step format found, treat whole solution as one step
    if (steps.length === 0 && solution) {
      steps.push({
        number: 1,
        title: 'Solution',
        content: solution,
      });
    }

    return steps;
  }, [item.extras?.solution]);

  // Front side - Problem + answer input
  if (side === 'front') {
    return (
      <Box ref={contentRef} sx={{ width: '100%' }}>
        {/* Problem statement */}
        <Typography
          sx={{
            fontWeight: 600,
            fontSize: getContentFontSize(frontText),
            textAlign: 'center',
            mb: 2,
          }}
        >
          {frontText}
        </Typography>

        {/* Variables table if available */}
        {item.extras?.variables?.length > 0 && (
          <Box
            sx={{
              mb: 2,
              p: 1.5,
              bgcolor: alpha(domainColor, 0.05),
              borderRadius: 1,
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600, color: domainColor }}>
              Variables:
            </Typography>
            {item.extras.variables.map((v, i) => (
              <Typography key={i} variant="body2" sx={{ mt: 0.5 }}>
                <strong>${v.symbol}$</strong>: {v.meaning}
              </Typography>
            ))}
          </Box>
        )}

        {/* Answer input */}
        <TextField
          fullWidth
          multiline
          minRows={2}
          maxRows={4}
          placeholder="Enter your answer..."
          value={answer}
          onChange={(e) => onAnswerChange?.(e.target.value)}
          disabled={isVerifying}
          sx={{ mt: 2 }}
        />

        {/* Verify button */}
        <Button
          variant="contained"
          onClick={onVerify}
          disabled={!answer?.trim() || isVerifying}
          sx={{
            mt: 2,
            bgcolor: domainColor,
            '&:hover': { bgcolor: alpha(domainColor, 0.9) },
          }}
          startIcon={isVerifying ? <CircularProgress size={16} color="inherit" /> : <CheckIcon />}
        >
          {isVerifying ? 'Checking...' : 'Check Answer'}
        </Button>

        {/* Verification result */}
        {verificationResult && (
          <Alert
            severity={verificationResult.correct ? 'success' : 'error'}
            icon={verificationResult.correct ? <CheckIcon /> : <CloseIcon />}
            sx={{ mt: 2 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {verificationResult.correct ? 'Correct!' : 'Not quite...'}
            </Typography>
            {verificationResult.explanation && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {verificationResult.explanation}
              </Typography>
            )}
            {verificationResult.feedback && (
              <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                {verificationResult.feedback}
              </Typography>
            )}
          </Alert>
        )}
      </Box>
    );
  }

  // Back side - Answer + step-by-step solution
  return (
    <Box ref={contentRef} sx={{ width: '100%' }}>
      {/* Main answer */}
      <Typography
        sx={{
          fontSize: getContentFontSize(backText, true),
          lineHeight: 1.7,
          mb: 2,
        }}
      >
        {backText}
      </Typography>

      {/* Step-by-step solution */}
      {solutionSteps.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography
            variant="subtitle2"
            sx={{ fontWeight: 600, color: domainColor, mb: 1 }}
          >
            Step-by-Step Solution:
          </Typography>

          {solutionSteps.map((step, index) => {
            const isRevealed = showSolution || index < currentSolutionStep;
            const isCurrent = index === currentSolutionStep;

            return (
              <Box
                key={step.number}
                sx={{
                  mb: 1.5,
                  p: 1.5,
                  bgcolor: isRevealed
                    ? alpha(domainColor, 0.05)
                    : alpha('#000', 0.02),
                  borderRadius: 1,
                  border: isCurrent
                    ? `2px solid ${domainColor}`
                    : '1px solid transparent',
                  opacity: isRevealed ? 1 : 0.5,
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 600, color: domainColor }}
                >
                  Step {step.number}: {step.title}
                </Typography>
                {isRevealed ? (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {step.content}
                  </Typography>
                ) : (
                  <Typography
                    variant="body2"
                    sx={{ mt: 0.5, color: 'text.disabled' }}
                  >
                    Click "Next Step" to reveal...
                  </Typography>
                )}
              </Box>
            );
          })}

          {/* Reveal next step button */}
          {!showSolution && currentSolutionStep < solutionSteps.length && (
            <Button
              variant="outlined"
              size="small"
              onClick={onRevealNextStep}
              startIcon={<NextIcon />}
              sx={{
                mt: 1,
                color: domainColor,
                borderColor: domainColor,
              }}
            >
              Reveal Next Step
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
}

/**
 * Quiz Mode Renderer - Embedded quiz display
 */
function QuizModeRenderer({ item, side, domainColor }) {
  const quizData = item.extras?.quiz || item.extras?.cards?.find((c) => c.quiz);

  if (side === 'front') {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontWeight: 600, fontSize: '1.3rem' }}>
          {getTextContent(item.front) || 'Quiz Question'}
        </Typography>
        {quizData && (
          <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
            Answer the quiz to test your knowledge
          </Typography>
        )}
      </Box>
    );
  }

  // Back side - show quiz answer/explanation
  return (
    <Box>
      <Typography sx={{ fontSize: '1rem', lineHeight: 1.7 }}>
        {getTextContent(item.back)}
      </Typography>
    </Box>
  );
}

/**
 * Mindmap Mode Renderer - Visual concept map
 */
function MindmapModeRenderer({ item, side, domainColor }) {
  const mindmapData =
    item.extras?.mindmap || item.extras?.cards?.find((c) => c.type === 'mindmap');

  if (side === 'front') {
    return (
      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontWeight: 600, fontSize: '1.3rem' }}>
          {getTextContent(item.front) || 'Concept Map'}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
          Visual representation of concepts
        </Typography>
      </Box>
    );
  }

  // Back side: render the actual mindmap if available, else fall back to text.
  if (mindmapData) {
    return (
      <Box sx={{ width: '100%' }}>
        <MindmapSurface data={mindmapData} mode="card" readOnly />
      </Box>
    );
  }
  return (
    <Typography sx={{ fontSize: '1rem', lineHeight: 1.7 }}>
      {getTextContent(item.back)}
    </Typography>
  );
}

/**
 * Image Mode Renderer - Image with caption
 */
function ImageModeRenderer({ item, side, domainColor }) {
  const images = item.extras?.images || [];
  const frontImage =
    typeof item.front === 'object' ? item.front.image : null;

  if (side === 'front') {
    return (
      <Box sx={{ textAlign: 'center' }}>
        {frontImage ? (
          <img
            src={frontImage}
            alt="Question"
            style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }}
          />
        ) : (
          <Typography sx={{ fontWeight: 600, fontSize: '1.3rem' }}>
            {getTextContent(item.front)}
          </Typography>
        )}
      </Box>
    );
  }

  // Back side
  return (
    <Box>
      {images.map((img, i) => (
        <Box key={i} sx={{ mb: 1 }}>
          <img
            src={img.data || img.url || img}
            alt={img.caption || `Image ${i + 1}`}
            style={{ maxWidth: '100%', borderRadius: 8 }}
          />
          {img.caption && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              {img.caption}
            </Typography>
          )}
        </Box>
      ))}
      <Typography sx={{ fontSize: '1rem', lineHeight: 1.7, mt: 1 }}>
        {getTextContent(item.back)}
      </Typography>
    </Box>
  );
}

/**
 * CardContentRenderer - Main component
 */
function CardContentRenderer({
  item,
  mode,
  side,
  domainColor,
  // STEM props
  answer,
  onAnswerChange,
  onVerify,
  verificationResult,
  isVerifying,
  showSolution,
  currentSolutionStep,
  onRevealNextStep,
}) {
  const props = {
    item,
    side,
    domainColor,
    answer,
    onAnswerChange,
    onVerify,
    verificationResult,
    isVerifying,
    showSolution,
    currentSolutionStep,
    onRevealNextStep,
  };

  switch (mode) {
    case 'stem':
      return <STEMModeRenderer {...props} />;
    case 'quiz':
      return <QuizModeRenderer {...props} />;
    case 'mindmap':
      return <MindmapModeRenderer {...props} />;
    case 'image':
      return <ImageModeRenderer {...props} />;
    case 'text':
    default:
      return <TextModeRenderer {...props} />;
  }
}

export default CardContentRenderer;
