/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/prop-types */
/**
 * KnowledgeCard — renders KnowledgeExtras for knowledge / history /
 * geography / reading domains (sources, relatedConcepts, evidence, dates,
 * locations).
 */

import React from 'react';
import { Box, Typography, Chip, Stack, Link } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import CardShell, { DOMAIN_COLORS } from './CardShell';
import { getDomainExtras } from '../../../../../commons/utils/learningPointExtras';

function KnowledgeCard(props) {
  const { item } = props;
  const theme = useTheme();
  const extras = getDomainExtras(item?.extras);
  const domain = item?.domain || 'knowledge';
  const domainColor =
    DOMAIN_COLORS[domain]?.primary || DOMAIN_COLORS.knowledge.primary;

  const questionBody = (
    <Typography
      sx={{
        fontWeight: 700,
        fontSize: '1.4rem',
        color: theme.palette.text.primary,
        textAlign: 'center',
        lineHeight: 1.4,
        wordBreak: 'break-word',
      }}
    >
      {item?.front}
    </Typography>
  );

  const sources = Array.isArray(extras.sources) ? extras.sources : [];
  const relatedConcepts = Array.isArray(extras.relatedConcepts)
    ? extras.relatedConcepts
    : [];
  const evidence = Array.isArray(extras.evidence) ? extras.evidence : [];
  const dates = Array.isArray(extras.dates) ? extras.dates : [];
  const locations = Array.isArray(extras.locations) ? extras.locations : [];

  const answerBody = (
    <Stack spacing={1.5}>
      <Typography
        sx={{
          color: theme.palette.text.primary,
          fontSize: '1rem',
          lineHeight: 1.6,
        }}
      >
        {item?.back}
      </Typography>

      {evidence.length > 0 && (
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
            KEY POINTS
          </Typography>
          {evidence.slice(0, 5).map((e) => (
            <Typography
              key={e}
              variant="body2"
              sx={{
                color: theme.palette.text.primary,
                pl: 1.5,
                borderLeft: `2px solid ${alpha(domainColor, 0.3)}`,
                mb: 0.5,
                fontSize: '0.85rem',
              }}
            >
              {e}
            </Typography>
          ))}
        </Box>
      )}

      {(dates.length > 0 || locations.length > 0) && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {dates.slice(0, 5).map((d) => (
            <Chip
              key={`date-${d}`}
              label={d}
              size="small"
              sx={{
                bgcolor: alpha(domainColor, 0.08),
                color: domainColor,
                fontSize: '0.7rem',
                height: 22,
              }}
            />
          ))}
          {locations.slice(0, 5).map((l) => (
            <Chip
              key={`loc-${l}`}
              label={`📍 ${l}`}
              size="small"
              sx={{
                bgcolor: alpha(domainColor, 0.08),
                color: domainColor,
                fontSize: '0.7rem',
                height: 22,
              }}
            />
          ))}
        </Box>
      )}

      {relatedConcepts.length > 0 && (
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
            RELATED
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {relatedConcepts.slice(0, 6).map((c) => (
              <Chip
                key={c}
                label={c}
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

      {sources.length > 0 && (
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
            SOURCES
          </Typography>
          {sources.slice(0, 3).map((s) => (
            <Typography
              key={s.title}
              variant="body2"
              sx={{
                color: theme.palette.text.secondary,
                fontSize: '0.8rem',
                mb: 0.25,
              }}
            >
              {s.url ? (
                <Link
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  sx={{ color: domainColor }}
                >
                  {s.title}
                </Link>
              ) : (
                s.title
              )}
              {s.cite ? ` (${s.cite})` : ''}
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

export default KnowledgeCard;
