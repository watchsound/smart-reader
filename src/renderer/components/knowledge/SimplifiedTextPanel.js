/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
/**
 * SimplifiedTextPanel - Display original and simplified text comparison
 *
 * Shows the simplified text with reading level indicator and
 * option to compare with original text.
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Collapse,
  IconButton,
  Divider,
  Tooltip,
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

// Reading level configurations
const LEVEL_CONFIG = {
  elementary: {
    label: 'Elementary',
    color: '#4caf50',
    bgColor: 'rgba(76, 175, 80, 0.1)',
    ages: '6-10',
    icon: '🌱',
  },
  middle: {
    label: 'Middle School',
    color: '#2196f3',
    bgColor: 'rgba(33, 150, 243, 0.1)',
    ages: '11-14',
    icon: '📚',
  },
  high: {
    label: 'High School',
    color: '#ff9800',
    bgColor: 'rgba(255, 152, 0, 0.1)',
    ages: '15-18',
    icon: '🎓',
  },
  college: {
    label: 'College',
    color: '#9c27b0',
    bgColor: 'rgba(156, 39, 176, 0.1)',
    ages: '18+',
    icon: '🏛️',
  },
};

/**
 * Main SimplifiedTextPanel component
 */
export default function SimplifiedTextPanel({
  originalText,
  simplifiedText,
  targetLevel = 'middle',
  simplificationRatio,
  compact = false,
}) {
  const [showOriginal, setShowOriginal] = useState(false);
  const [copied, setCopied] = useState(false);

  const levelConfig = LEVEL_CONFIG[targetLevel] || LEVEL_CONFIG.middle;

  // Handle invalid data
  if (!simplifiedText) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No simplified text available.
        </Typography>
      </Box>
    );
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(simplifiedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Calculate word count difference
  const originalWords = originalText?.split(/\s+/).length || 0;
  const simplifiedWords = simplifiedText.split(/\s+/).length;
  const wordDiff = originalWords - simplifiedWords;
  const percentChange = originalWords > 0
    ? Math.round(((originalWords - simplifiedWords) / originalWords) * 100)
    : 0;

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header with level indicator */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 1.5,
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            icon={<SchoolIcon sx={{ fontSize: 14 }} />}
            label={`${levelConfig.icon} ${levelConfig.label}`}
            size="small"
            sx={{
              bgcolor: levelConfig.bgColor,
              color: levelConfig.color,
              fontWeight: 600,
              fontSize: 11,
              '& .MuiChip-icon': { color: levelConfig.color },
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Ages {levelConfig.ages}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {/* Word count change */}
          {originalWords > 0 && (
            <Tooltip title={`${originalWords} → ${simplifiedWords} words`}>
              <Chip
                size="small"
                label={percentChange > 0 ? `-${percentChange}%` : `${Math.abs(percentChange)}%`}
                sx={{
                  height: 20,
                  fontSize: 10,
                  bgcolor: percentChange > 0 ? 'success.main' : 'info.main',
                  color: 'white',
                }}
              />
            </Tooltip>
          )}

          {/* Copy button */}
          <Tooltip title={copied ? 'Copied!' : 'Copy simplified text'}>
            <IconButton size="small" onClick={handleCopy}>
              {copied ? (
                <CheckIcon fontSize="small" sx={{ color: 'success.main' }} />
              ) : (
                <ContentCopyIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>

          {/* Toggle original */}
          {originalText && (
            <Tooltip title={showOriginal ? 'Hide original' : 'Compare with original'}>
              <IconButton size="small" onClick={() => setShowOriginal(!showOriginal)}>
                <CompareArrowsIcon
                  fontSize="small"
                  sx={{ color: showOriginal ? 'primary.main' : 'inherit' }}
                />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Simplified text */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: levelConfig.color,
          borderLeftWidth: 4,
          bgcolor: levelConfig.bgColor,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
          }}
        >
          {simplifiedText}
        </Typography>
      </Paper>

      {/* Original text comparison */}
      <Collapse in={showOriginal}>
        <Box sx={{ mt: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Divider sx={{ flex: 1 }} />
            <Typography variant="caption" color="text.secondary" fontWeight={500}>
              Original Text
            </Typography>
            <Divider sx={{ flex: 1 }} />
          </Box>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'action.hover',
            }}
          >
            <Typography
              variant="body2"
              sx={{
                lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
                color: 'text.secondary',
              }}
            >
              {originalText}
            </Typography>
          </Paper>
        </Box>
      </Collapse>

      {/* Stats footer */}
      {!compact && simplificationRatio && (
        <Box sx={{ mt: 1.5, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary">
            📊 Simplification ratio: {simplificationRatio}x
          </Typography>
          {wordDiff !== 0 && (
            <Typography variant="caption" color="text.secondary">
              ✂️ {Math.abs(wordDiff)} words {wordDiff > 0 ? 'reduced' : 'added'}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
