import React, { useState } from 'react';
import { Box, Typography, Collapse, IconButton, Chip } from '@mui/material';
import { useTheme, alpha, keyframes } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;
const SERIF = `'Source Serif Pro', Georgia, 'Times New Roman', serif`;

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(3px); }
  to   { opacity: 1; transform: translateY(0); }
`;

function ScaffoldBlock({
  title,
  count,
  accent,
  defaultOpen = false,
  children,
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box
      sx={{
        bgcolor: alpha(accent, 0.06),
        borderRadius: '14px',
        border: `1px solid ${alpha(accent, 0.2)}`,
        overflow: 'hidden',
      }}
    >
      <Box
        onClick={() => setOpen((v) => !v)}
        role="button"
        aria-expanded={open}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          cursor: 'pointer',
        }}
      >
        <Typography
          sx={{
            fontFamily: MONO,
            fontSize: '0.72rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: accent,
          }}
        >
          {title}
        </Typography>
        <Typography
          sx={{
            flex: 1,
            fontSize: '0.85rem',
            color: theme.palette.text.secondary,
          }}
        >
          {count != null ? count : ''}
        </Typography>
        <IconButton size="small">
          {open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 2, pb: 2 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

function ComposeScaffolds({ scaffolds, accent }) {
  const theme = useTheme();
  if (!scaffolds) return null;
  const { gists = [], phrases = [], translation = '' } = scaffolds;
  const hasAny = gists.length || phrases.length || translation;
  if (!hasAny) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {gists.length > 0 && (
        <ScaffoldBlock
          title="Sentence gists"
          count={`${gists.length} ${gists.length === 1 ? 'sentence' : 'sentences'}`}
          accent={accent}
          defaultOpen
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {gists.map((g, i) => (
              <Box
                // eslint-disable-next-line react/no-array-index-key
                key={`gist-${i}`}
                sx={{
                  display: 'flex',
                  gap: 1.25,
                  opacity: 0,
                  animation: `${fadeInUp} 280ms ease-out ${Math.min(i * 50, 600)}ms forwards`,
                }}
              >
                <Typography
                  sx={{
                    fontFamily: MONO,
                    fontSize: '0.72rem',
                    color: accent,
                    minWidth: 16,
                    pt: '2px',
                  }}
                >
                  {i + 1}.
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.9rem',
                    color: theme.palette.text.primary,
                    lineHeight: 1.5,
                  }}
                >
                  {g}
                </Typography>
              </Box>
            ))}
          </Box>
        </ScaffoldBlock>
      )}

      {phrases.length > 0 && (
        <ScaffoldBlock
          title="Key phrases"
          count={`${phrases.length} to reuse`}
          accent={accent}
          defaultOpen
        >
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {phrases.map((p, i) => (
              <Chip
                // eslint-disable-next-line react/no-array-index-key
                key={`phr-${i}`}
                label={p}
                size="small"
                sx={{
                  fontFamily: SERIF,
                  fontSize: '0.85rem',
                  bgcolor: alpha(accent, 0.1),
                  color: theme.palette.text.primary,
                  border: `1px solid ${alpha(accent, 0.25)}`,
                  opacity: 0,
                  animation: `${fadeInUp} 280ms ease-out ${Math.min(i * 30, 400)}ms forwards`,
                }}
              />
            ))}
          </Box>
        </ScaffoldBlock>
      )}

      {translation && (
        <ScaffoldBlock
          title="Native translation"
          count="tap to reveal"
          accent={accent}
          defaultOpen={false}
        >
          <Typography
            sx={{
              fontSize: '0.95rem',
              lineHeight: 1.7,
              color: theme.palette.text.primary,
            }}
          >
            {translation}
          </Typography>
        </ScaffoldBlock>
      )}
    </Box>
  );
}

export default ComposeScaffolds;
