/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/prop-types */
/**
 * CodeCard — renders ProgrammingExtras (language, snippet, expectedOutput,
 * gotchas, variations, versionContext). Uses highlight.js to syntax-color
 * the snippet — matches the pattern in MarkdownManager.js.
 */

import React, { useMemo } from 'react';
import { Box, Typography, Chip, Stack } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import CardShell, { DOMAIN_COLORS } from './CardShell';
import { getDomainExtras } from '../../../../../commons/utils/learningPointExtras';

function highlight(code, language) {
  if (!code || typeof code !== 'string') return '';
  if (language && hljs.getLanguage(language)) {
    try {
      return hljs.highlight(code, { language, ignoreIllegals: true }).value;
    } catch (_err) {
      // fall through to auto
    }
  }
  try {
    return hljs.highlightAuto(code).value;
  } catch (_err) {
    return code;
  }
}

function CodeBlock({ code, language, mono = true }) {
  const html = useMemo(() => highlight(code, language), [code, language]);
  if (!code) return null;
  return (
    <Box
      component="pre"
      sx={{
        m: 0,
        p: 1.5,
        borderRadius: 1,
        bgcolor: 'rgba(0,0,0,0.04)',
        overflow: 'auto',
        fontFamily: mono
          ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
          : 'inherit',
        fontSize: '0.85rem',
        lineHeight: 1.5,
        '& code': { fontFamily: 'inherit' },
      }}
    >
      <code
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Box>
  );
}

function CodeCard(props) {
  const { item } = props;
  const theme = useTheme();
  const extras = getDomainExtras(item?.extras);
  const domainColor = DOMAIN_COLORS.programming.primary;
  const language = extras.language || '';

  const questionBody = (
    <Stack alignItems="center" spacing={1}>
      <Typography
        sx={{
          fontWeight: 700,
          fontSize: '1.3rem',
          color: theme.palette.text.primary,
          textAlign: 'center',
          lineHeight: 1.3,
          wordBreak: 'break-word',
        }}
      >
        {item?.front}
      </Typography>
      {language && (
        <Chip
          label={language}
          size="small"
          sx={{
            bgcolor: alpha(domainColor, 0.1),
            color: domainColor,
            fontSize: '0.7rem',
            height: 22,
            fontFamily: 'monospace',
          }}
        />
      )}
    </Stack>
  );

  const variations = Array.isArray(extras.variations) ? extras.variations : [];
  const gotchas = Array.isArray(extras.gotchas) ? extras.gotchas : [];

  const answerBody = (
    <Stack spacing={1.5}>
      {extras.snippet ? (
        <CodeBlock code={extras.snippet} language={language} />
      ) : (
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

      {extras.expectedOutput && (
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
            OUTPUT
          </Typography>
          <CodeBlock code={extras.expectedOutput} language="plaintext" />
        </Box>
      )}

      {variations.length > 0 && (
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
            VARIATION
          </Typography>
          <CodeBlock code={variations[0].snippet} language={language} />
          {variations[0].note && (
            <Typography
              variant="caption"
              sx={{ color: theme.palette.text.secondary, fontStyle: 'italic' }}
            >
              {variations[0].note}
            </Typography>
          )}
        </Box>
      )}

      {gotchas.length > 0 && (
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
            ⚠ GOTCHAS
          </Typography>
          {gotchas.slice(0, 3).map((g) => (
            <Typography
              key={g}
              variant="body2"
              sx={{
                color: theme.palette.text.primary,
                fontSize: '0.85rem',
                mb: 0.25,
              }}
            >
              • {g}
            </Typography>
          ))}
        </Box>
      )}

      {extras.versionContext && (
        <Typography
          variant="caption"
          sx={{ color: theme.palette.text.secondary, fontStyle: 'italic' }}
        >
          Version context: {extras.versionContext}
        </Typography>
      )}
    </Stack>
  );

  return (
    <CardShell {...props} questionBody={questionBody} answerBody={answerBody} />
  );
}

export default CodeCard;
