import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { styled, useTheme, alpha } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

const ContentCard = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  borderRadius: 16,
  border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  overflow: 'hidden',
}));

const RowContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  marginBottom: theme.spacing(2),
  '&:last-child': {
    marginBottom: 0,
  },
}));

const WordRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  alignItems: 'center',
}));

const LabelCell = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'variant',
})(({ theme, variant }) => ({
  padding: theme.spacing(1, 1.5),
  borderRadius: 8,
  minWidth: 80,
  textAlign: 'center',
  fontWeight: 600,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  ...(variant === 'origin' && {
    backgroundColor: alpha(theme.palette.success.main, 0.12),
    color: theme.palette.success.main,
  }),
  ...(variant === 'mine' && {
    backgroundColor: alpha(theme.palette.info.main, 0.12),
    color: theme.palette.info.main,
  }),
}));

const WordCell = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'match' && prop !== 'row',
})(({ theme, match, row }) => ({
  padding: theme.spacing(0.75, 1.25),
  borderRadius: 6,
  fontSize: '0.875rem',
  fontWeight: 500,
  minWidth: 32,
  textAlign: 'center',
  transition: 'all 0.2s ease',
  ...(match && {
    backgroundColor: alpha(theme.palette.success.main, 0.12),
    color: theme.palette.success.main,
    border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
  }),
  ...(!match &&
    row === 'origin' && {
      backgroundColor: alpha(theme.palette.error.main, 0.08),
      color: theme.palette.error.main,
      border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
    }),
  ...(!match &&
    row === 'mine' && {
      backgroundColor: alpha(theme.palette.info.main, 0.08),
      color: theme.palette.info.main,
      border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
    }),
}));

const StatsBar = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: alpha(theme.palette.background.default, 0.5),
  borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  display: 'flex',
  justifyContent: 'center',
  gap: theme.spacing(3),
}));

const StatItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
}));

export default function AlignmentDisplay({
  alignment,
  label1 = 'Original',
  label2 = 'Your Version',
  maxWordsPerLine = 12,
  colors,
}) {
  const theme = useTheme();

  if (!alignment || alignment.length === 0) return null;

  // Calculate stats
  const matchCount = alignment.filter((item) => item.match).length;
  const totalCount = alignment.length;
  const matchPercentage = Math.round((matchCount / totalCount) * 100);

  // Function to chunk the alignment array into rows
  const chunkAlignment = (arr, size) => {
    const chunked = [];
    for (let i = 0; i < arr.length; i += size) {
      chunked.push(arr.slice(i, i + size));
    }
    return chunked;
  };

  const alignmentRows = chunkAlignment(alignment, maxWordsPerLine);

  return (
    <ContentCard>
      <Box sx={{ p: 3 }}>
        {alignmentRows.map((row, rowIndex) => (
          <RowContainer key={rowIndex}>
            {/* Origin Row */}
            <WordRow sx={{ mb: 1 }}>
              <LabelCell variant="origin">{label1}</LabelCell>
              {row.map((item, index) => (
                <WordCell key={`word1-${index}`} match={item.match} row="origin">
                  {item.word1 || '—'}
                </WordCell>
              ))}
            </WordRow>

            {/* User Row */}
            <WordRow>
              <LabelCell variant="mine">{label2}</LabelCell>
              {row.map((item, index) => (
                <WordCell key={`word2-${index}`} match={item.match} row="mine">
                  {item.word2 || '—'}
                </WordCell>
              ))}
            </WordRow>
          </RowContainer>
        ))}
      </Box>

      {/* Stats Footer */}
      <StatsBar>
        <StatItem>
          <CheckIcon
            sx={{ fontSize: 18, color: theme.palette.success.main }}
          />
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            <Box component="span" sx={{ color: theme.palette.success.main }}>
              {matchCount}
            </Box>{' '}
            matching
          </Typography>
        </StatItem>
        <StatItem>
          <CloseIcon sx={{ fontSize: 18, color: theme.palette.error.main }} />
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            <Box component="span" sx={{ color: theme.palette.error.main }}>
              {totalCount - matchCount}
            </Box>{' '}
            different
          </Typography>
        </StatItem>
        <Chip
          label={`${matchPercentage}% match`}
          size="small"
          sx={{
            bgcolor:
              matchPercentage >= 70
                ? alpha(theme.palette.success.main, 0.12)
                : matchPercentage >= 40
                  ? alpha(theme.palette.warning.main, 0.12)
                  : alpha(theme.palette.error.main, 0.12),
            color:
              matchPercentage >= 70
                ? theme.palette.success.main
                : matchPercentage >= 40
                  ? theme.palette.warning.main
                  : theme.palette.error.main,
            fontWeight: 600,
            fontSize: '0.75rem',
          }}
        />
      </StatsBar>
    </ContentCard>
  );
}
