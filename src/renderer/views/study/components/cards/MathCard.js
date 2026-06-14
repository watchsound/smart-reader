/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/prop-types */
/**
 * MathCard — renders FormalConceptExtras for math / physics / chemistry /
 * biology domains. Uses KaTeX for LaTeX rendering (same pattern as
 * CardContentPanel / MarkdownManager).
 *
 * Front: item.front (typically the concept name).
 * Back: definitionLatex + workedExampleLatex + prerequisite chips +
 *       similarProblems (one) + commonMistakes + units chip.
 */

import React, { useMemo } from 'react';
import { Box, Typography, Chip, Stack } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import CardShell, { DOMAIN_COLORS } from './CardShell';
import { getDomainExtras } from '../../../../../commons/utils/learningPointExtras';

function renderLatex(latex, displayMode = false) {
  if (!latex || typeof latex !== 'string') return '';
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode,
      output: 'html',
    });
  } catch (_err) {
    return latex; // fall back to raw text on render failure
  }
}

function LatexBlock({ latex, displayMode = false, color }) {
  const html = useMemo(
    () => renderLatex(latex, displayMode),
    [latex, displayMode],
  );
  if (!latex) return null;
  return (
    <Box
      sx={{
        color,
        '& .katex-display': { margin: '0.5em 0', textAlign: 'left' },
      }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function MathCard(props) {
  const { item } = props;
  const theme = useTheme();
  const extras = getDomainExtras(item?.extras);
  const domain = item?.domain || 'math';
  const domainColor =
    DOMAIN_COLORS[domain]?.primary || DOMAIN_COLORS.math.primary;

  const questionBody = (
    <Typography
      sx={{
        fontWeight: 700,
        fontSize: '1.5rem',
        color: theme.palette.text.primary,
        textAlign: 'center',
        lineHeight: 1.3,
        wordBreak: 'break-word',
      }}
    >
      {item?.front}
    </Typography>
  );

  const prerequisites = Array.isArray(extras.prerequisites)
    ? extras.prerequisites
    : [];
  const similarProblems = Array.isArray(extras.similarProblems)
    ? extras.similarProblems
    : [];
  const commonMistakes = Array.isArray(extras.commonMistakes)
    ? extras.commonMistakes
    : [];

  const answerBody = (
    <Stack spacing={1.5}>
      {extras.units && (
        <Chip
          label={`Units: ${extras.units}`}
          size="small"
          sx={{
            alignSelf: 'flex-start',
            bgcolor: alpha(domainColor, 0.1),
            color: domainColor,
            fontSize: '0.7rem',
            height: 22,
          }}
        />
      )}

      {extras.definitionLatex ? (
        <Box>
          <Typography
            variant="caption"
            sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}
          >
            DEFINITION
          </Typography>
          <LatexBlock
            latex={extras.definitionLatex}
            color={theme.palette.text.primary}
          />
        </Box>
      ) : (
        // No structured definition — fall back to plain item.back text.
        <Typography
          sx={{
            color: theme.palette.text.primary,
            fontSize: '1rem',
            lineHeight: 1.6,
          }}
        >
          {item?.back}
        </Typography>
      )}

      {extras.workedExampleLatex && (
        <Box>
          <Typography
            variant="caption"
            sx={{ color: theme.palette.text.secondary, fontWeight: 600 }}
          >
            WORKED EXAMPLE
          </Typography>
          <LatexBlock
            latex={extras.workedExampleLatex}
            displayMode
            color={theme.palette.text.primary}
          />
        </Box>
      )}

      {prerequisites.length > 0 && (
        <Box>
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.secondary,
              fontWeight: 600,
              display: 'block',
              mb: 0.5,
            }}
          >
            PREREQUISITES
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {prerequisites.slice(0, 6).map((p) => (
              <Chip
                key={p}
                label={p}
                size="small"
                variant="outlined"
                sx={{
                  borderColor: alpha(domainColor, 0.4),
                  color: domainColor,
                  fontSize: '0.7rem',
                  height: 22,
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      {similarProblems.length > 0 && (
        <Box>
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.secondary,
              fontWeight: 600,
              display: 'block',
              mb: 0.5,
            }}
          >
            SIMILAR PROBLEM
          </Typography>
          <Box
            sx={{ pl: 1.5, borderLeft: `2px solid ${alpha(domainColor, 0.3)}` }}
          >
            <LatexBlock
              latex={similarProblems[0].promptLatex}
              color={theme.palette.text.primary}
            />
            {similarProblems[0].solutionLatex && (
              <LatexBlock
                latex={similarProblems[0].solutionLatex}
                displayMode
                color={theme.palette.text.secondary}
              />
            )}
          </Box>
        </Box>
      )}

      {commonMistakes.length > 0 && (
        <Box>
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.warning.main,
              fontWeight: 600,
              display: 'block',
              mb: 0.5,
            }}
          >
            ⚠ COMMON MISTAKES
          </Typography>
          {commonMistakes.slice(0, 3).map((m) => (
            <Typography
              key={m}
              variant="body2"
              sx={{
                color: theme.palette.text.primary,
                fontSize: '0.85rem',
                mb: 0.25,
              }}
            >
              • {m}
            </Typography>
          ))}
        </Box>
      )}
    </Stack>
  );

  return (
    <CardShell {...props} questionBody={questionBody} answerBody={answerBody} />
  );
}

export default MathCard;
