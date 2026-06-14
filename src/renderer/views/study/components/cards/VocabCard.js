/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/prop-types */
/**
 * VocabCard — renders VocabularyExtras (ipa, partOfSpeech, examples,
 * collocations, translations).
 *
 * Front: the headword + IPA + (optional) pronounce button.
 * Back: definition (item.back) + part-of-speech chip + example sentences +
 *       collocation chips + translations.
 */

import React from 'react';
import { Box, Typography, Chip, IconButton, Stack } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { VolumeUp as PronounceIcon } from '@mui/icons-material';
import CardShell, { DOMAIN_COLORS } from './CardShell';
import { getDomainExtras } from '../../../../../commons/utils/learningPointExtras';

function VocabCard(props) {
  const { item, onPronounce } = props;
  const theme = useTheme();
  const extras = getDomainExtras(item?.extras);
  const domainColor = DOMAIN_COLORS.vocabulary.primary;

  const questionBody = (
    <Stack alignItems="center" spacing={1.5}>
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: '2rem',
          color: theme.palette.text.primary,
          textAlign: 'center',
          lineHeight: 1.2,
          wordBreak: 'break-word',
        }}
      >
        {item?.front}
      </Typography>
      {extras.ipa && (
        <Typography
          variant="body2"
          sx={{ color: theme.palette.text.secondary, fontFamily: 'serif' }}
        >
          {extras.ipa}
        </Typography>
      )}
      {onPronounce && (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onPronounce(item);
          }}
          aria-label="pronounce"
          sx={{ color: domainColor }}
        >
          <PronounceIcon fontSize="small" />
        </IconButton>
      )}
    </Stack>
  );

  const examples = Array.isArray(extras.examples) ? extras.examples : [];
  const collocations = Array.isArray(extras.collocations)
    ? extras.collocations
    : [];
  const translations =
    extras.translations && typeof extras.translations === 'object'
      ? Object.entries(extras.translations)
      : [];

  const answerBody = (
    <Box>
      {extras.partOfSpeech && (
        <Chip
          label={extras.partOfSpeech}
          size="small"
          sx={{
            mb: 1.5,
            bgcolor: alpha(domainColor, 0.1),
            color: domainColor,
            fontStyle: 'italic',
            fontSize: '0.7rem',
            height: 22,
          }}
        />
      )}
      <Typography
        sx={{
          color: theme.palette.text.primary,
          fontSize: '1.05rem',
          lineHeight: 1.6,
          mb:
            examples.length || collocations.length || translations.length
              ? 1.5
              : 0,
        }}
      >
        {item?.back}
      </Typography>

      {examples.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.secondary,
              fontWeight: 600,
              display: 'block',
              mb: 0.5,
            }}
          >
            EXAMPLES
          </Typography>
          {examples.slice(0, 3).map((ex, i) => (
            <Typography
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              variant="body2"
              sx={{
                color: theme.palette.text.primary,
                fontStyle: 'italic',
                pl: 1.5,
                borderLeft: `2px solid ${alpha(domainColor, 0.3)}`,
                mb: 0.5,
                fontSize: '0.85rem',
              }}
            >
              {ex}
            </Typography>
          ))}
        </Box>
      )}

      {collocations.length > 0 && (
        <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {collocations.slice(0, 5).map((c) => (
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
      )}

      {translations.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.secondary,
              fontWeight: 600,
              display: 'block',
              mb: 0.5,
            }}
          >
            TRANSLATIONS
          </Typography>
          {translations.map(([lang, value]) => (
            <Typography
              key={lang}
              variant="body2"
              sx={{ color: theme.palette.text.primary, fontSize: '0.85rem' }}
            >
              <strong>{lang}:</strong> {value}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );

  return (
    <CardShell {...props} questionBody={questionBody} answerBody={answerBody} />
  );
}

export default VocabCard;
