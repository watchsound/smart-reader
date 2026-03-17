/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
/* eslint-disable react/no-array-index-key */
/* eslint-disable no-plusplus */
/**
 * FiveWAnalysisPanel - Beautiful visualization for 5W Analysis results
 *
 * Displays Who, What, When, Where, Why analysis for each sentence
 * in an engaging, card-based layout with color-coded categories.
 */

import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Divider,
  Collapse,
  IconButton,
  Tooltip,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import EventIcon from '@mui/icons-material/Event';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PlaceIcon from '@mui/icons-material/Place';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';

// 5W categories with icons and colors
const FIVE_W_CONFIG = {
  who: {
    label: 'Who',
    icon: PersonIcon,
    color: '#2196f3',
    bgColor: 'rgba(33, 150, 243, 0.1)',
    description: 'Subject/Actor',
  },
  what: {
    label: 'What',
    icon: EventIcon,
    color: '#4caf50',
    bgColor: 'rgba(76, 175, 80, 0.1)',
    description: 'Action/Event',
  },
  when: {
    label: 'When',
    icon: AccessTimeIcon,
    color: '#ff9800',
    bgColor: 'rgba(255, 152, 0, 0.1)',
    description: 'Time',
  },
  where: {
    label: 'Where',
    icon: PlaceIcon,
    color: '#e91e63',
    bgColor: 'rgba(233, 30, 99, 0.1)',
    description: 'Location',
  },
  why: {
    label: 'Why',
    icon: HelpOutlineIcon,
    color: '#9c27b0',
    bgColor: 'rgba(156, 39, 176, 0.1)',
    description: 'Reason/Purpose',
  },
};

/**
 * Single 5W element chip
 */
function FiveWChip({ type, value }) {
  const config = FIVE_W_CONFIG[type];
  if (!config || !value || value === '-') return null;

  const Icon = config.icon;

  return (
    <Tooltip title={config.description} arrow placement="top">
      <Chip
        icon={
          <Icon sx={{ fontSize: 16, color: `${config.color} !important` }} />
        }
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: config.color,
                textTransform: 'uppercase',
              }}
            >
              {config.label}:
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.primary' }}>
              {value}
            </Typography>
          </Box>
        }
        sx={{
          bgcolor: config.bgColor,
          border: `1px solid ${config.color}30`,
          borderRadius: '12px',
          height: 'auto',
          py: 0.5,
          '& .MuiChip-label': { px: 1 },
        }}
      />
    </Tooltip>
  );
}

/**
 * Single sentence card with 5W breakdown
 */
function SentenceCard({ data, index, expanded, onToggle }) {
  const hasContent = ['who', 'what', 'when', 'where', 'why'].some(
    (key) => data[key] && data[key] !== '-',
  );

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 1.5,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      }}
    >
      {/* Sentence header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
        onClick={onToggle}
      >
        <Box
          sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flex: 1 }}
        >
          <Box
            sx={{
              minWidth: 24,
              height: 24,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
              mt: 0.25,
            }}
          >
            {index + 1}
          </Box>
          <Typography
            variant="body2"
            sx={{
              fontStyle: 'italic',
              color: 'text.secondary',
              lineHeight: 1.6,
              display: '-webkit-box',
              WebkitLineClamp: expanded ? 'unset' : 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            <FormatQuoteIcon
              sx={{
                fontSize: 14,
                mr: 0.5,
                opacity: 0.5,
                verticalAlign: 'text-top',
              }}
            />
            {data.sentence}
          </Typography>
        </Box>
        <IconButton size="small" sx={{ ml: 1 }}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      {/* 5W breakdown */}
      <Collapse in={expanded}>
        <Divider sx={{ my: 1.5 }} />
        {hasContent ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {['who', 'what', 'when', 'where', 'why'].map((key) => (
              <FiveWChip key={key} type={key} value={data[key]} />
            ))}
          </Box>
        ) : (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontStyle: 'italic' }}
          >
            No distinct 5W elements identified in this sentence.
          </Typography>
        )}
      </Collapse>
    </Paper>
  );
}

/**
 * Overview summary showing aggregate 5W distribution
 */
function OverviewSummary({ data }) {
  const counts = { who: 0, what: 0, when: 0, where: 0, why: 0 };

  data.forEach((sentence) => {
    ['who', 'what', 'when', 'where', 'why'].forEach((key) => {
      if (sentence[key] && sentence[key] !== '-') {
        counts[key]++;
      }
    });
  });

  const total = data.length;

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        mb: 2,
        p: 1.5,
        borderRadius: 2,
        bgcolor: 'action.hover',
        justifyContent: 'space-around',
        flexWrap: 'wrap',
      }}
    >
      {Object.entries(FIVE_W_CONFIG).map(([key, config]) => {
        const Icon = config.icon;
        const count = counts[key];
        const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

        return (
          <Tooltip
            key={key}
            title={`${count} of ${total} sentences have "${config.label}"`}
            arrow
          >
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: 50,
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  bgcolor: config.bgColor,
                  border: `2px solid ${config.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 0.5,
                }}
              >
                <Icon sx={{ fontSize: 20, color: config.color }} />
              </Box>
              <Typography
                variant="caption"
                fontWeight={600}
                color={config.color}
              >
                {percentage}%
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: 10 }}
              >
                {config.label}
              </Typography>
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}

/**
 * Main FiveWAnalysisPanel component
 */
export default function FiveWAnalysisPanel({
  data,
  sentenceCount,
  compact = false,
}) {
  const [expandedIndex, setExpandedIndex] = React.useState(0);
  const [showAll, setShowAll] = React.useState(false);

  // Handle invalid data
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No analysis data available.
        </Typography>
      </Box>
    );
  }

  const displayData = compact && !showAll ? data.slice(0, 3) : data;
  const hasMore = compact && data.length > 3;

  return (
    <Box sx={{ width: '100%' }}>
      {/* Overview section */}
      {!compact && <OverviewSummary data={data} />}

      {/* Sentence count */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'block', mb: 1.5, fontWeight: 500 }}
      >
        {sentenceCount || data.length} sentence
        {(sentenceCount || data.length) !== 1 ? 's' : ''} analyzed
      </Typography>

      {/* Sentence cards */}
      {displayData.map((sentence, index) => (
        <SentenceCard
          key={index}
          data={sentence}
          index={sentence.sentenceIndex ?? index}
          expanded={expandedIndex === index}
          onToggle={() =>
            setExpandedIndex(expandedIndex === index ? -1 : index)
          }
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
            Show {data.length - 3} more sentence
            {data.length - 3 !== 1 ? 's' : ''}...
          </Typography>
        </Box>
      )}
    </Box>
  );
}
