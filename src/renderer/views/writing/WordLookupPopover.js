import React, { useEffect, useRef, useState } from 'react';
import {
  Popover,
  Box,
  Typography,
  Button,
  CircularProgress,
  Chip,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import nlp from 'compromise';
import spineApi from '../../api/spineApi';
import { langstudyDictionaryLookupPrompt } from '../../../commons/utils/AIPrompts';
import customStorage from '../../store/customStorage';

const SERIF = `'Source Serif Pro', Georgia, 'Times New Roman', serif`;
const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

// Tags that mean "function word — never offer dictionary lookup."
const STOP_TAGS = new Set([
  'Determiner',
  'Preposition',
  'Conjunction',
  'Pronoun',
  'Modal',
  'Copula',
  'Auxiliary',
  'Negative',
  'QuestionWord',
]);

// A selection counts as a lookup candidate when:
//  - one word only (no whitespace inside the trimmed selection)
//  - 3+ characters (skip 'a', 'in', 'to')
//  - made of letters / apostrophe / hyphen
//  - compromise doesn't tag it as a function/stop word
function isLookupCandidate(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 3) return false;
  if (!/^[A-Za-z][A-Za-z'-]*$/.test(trimmed)) return false;
  const doc = nlp(trimmed);
  const tags = new Set();
  doc.terms().forEach((t) => {
    const docTags = t.docs?.[0]?.[0]?.tags;
    if (docTags) docTags.forEach((tag) => tags.add(tag));
  });
  for (const stopTag of STOP_TAGS) {
    if (tags.has(stopTag)) return false;
  }
  return true;
}

function WordLookupPopover({ contextText, accent }) {
  const theme = useTheme();
  const [anchor, setAnchor] = useState(null); // { x, y, word }
  const [stage, setStage] = useState('menu'); // 'menu' | 'tooltip'
  const [explanation, setExplanation] = useState(null);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState(null);
  const ourPopoverRef = useRef(null);

  useEffect(() => {
    function onMouseUp(e) {
      // Don't fire inside our own popover (user clicking buttons).
      if (
        ourPopoverRef.current &&
        ourPopoverRef.current.contains(e.target)
      ) {
        return;
      }
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const text = sel.toString();
      if (!isLookupCandidate(text)) return;
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setAnchor({
        x: rect.left + rect.width / 2,
        y: rect.bottom,
        word: text.trim(),
      });
      setStage('menu');
      setExplanation(null);
      setError(null);
      setAdded(false);
    }
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, []);

  const handleLookup = async () => {
    if (!anchor) return;
    setLoadingLookup(true);
    setError(null);
    try {
      const res = await spineApi.generateContentWithJson(
        langstudyDictionaryLookupPrompt(anchor.word, contextText),
        null,
        { label: 'writing-dictionary-lookup' },
      );
      setExplanation(res || {});
      setStage('tooltip');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Dictionary lookup failed', err);
      setError(err?.message || 'Lookup failed.');
      setStage('tooltip');
    } finally {
      setLoadingLookup(false);
    }
  };

  const handleAdd = async () => {
    if (!anchor) return;
    setAdding(true);
    try {
      // Direct-save with the data we already fetched for the tooltip,
      // so we don't pay for a second LLM call inside addToVocabulary.
      const result = await customStorage.addVocabularyDirect({
        word: anchor.word,
        definition: explanation?.definition || '',
        example: explanation?.example || '',
        related: explanation?.related || '',
      });
      if (result) setAdded(true);
      else setError('Could not save — are you logged in?');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Add to vocabulary failed', err);
      setError(err?.message || 'Save failed.');
    } finally {
      setAdding(false);
    }
  };

  const handleClose = () => {
    setAnchor(null);
    setStage('menu');
  };

  const isOpen = !!anchor;

  return (
    <Popover
      open={isOpen}
      anchorReference="anchorPosition"
      anchorPosition={anchor ? { left: anchor.x, top: anchor.y + 6 } : undefined}
      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      onClose={handleClose}
      slotProps={{
        paper: {
          ref: ourPopoverRef,
          sx: {
            borderRadius: '12px',
            border: `1px solid ${alpha(accent || theme.palette.primary.main, 0.25)}`,
            boxShadow: `0 8px 24px ${alpha('#000', 0.16)}`,
          },
        },
      }}
    >
      {stage === 'menu' && (
        <Box sx={{ p: 0.75 }}>
          <Button
            startIcon={<MenuBookIcon sx={{ fontSize: 16 }} />}
            onClick={handleLookup}
            disabled={loadingLookup}
            sx={{
              fontFamily: MONO,
              fontSize: '0.75rem',
              textTransform: 'none',
              color: accent || theme.palette.primary.main,
              px: 1.5,
              py: 0.5,
              '&:hover': {
                bgcolor: alpha(accent || theme.palette.primary.main, 0.08),
              },
            }}
          >
            {loadingLookup ? (
              <CircularProgress
                size={14}
                sx={{ color: accent || theme.palette.primary.main }}
              />
            ) : (
              `Dictionary: ${anchor?.word}`
            )}
          </Button>
        </Box>
      )}

      {stage === 'tooltip' && (
        <Box sx={{ p: 2, maxWidth: 360, minWidth: 240 }}>
          <Box
            sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}
          >
            <Typography
              sx={{
                fontFamily: SERIF,
                fontSize: '1.1rem',
                fontWeight: 600,
                color: theme.palette.text.primary,
              }}
            >
              {anchor?.word}
            </Typography>
            {explanation?.partOfSpeech && (
              <Typography
                sx={{
                  fontFamily: MONO,
                  fontSize: '0.7rem',
                  color: theme.palette.text.secondary,
                  fontStyle: 'italic',
                }}
              >
                {explanation.partOfSpeech}
              </Typography>
            )}
          </Box>

          {error ? (
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          ) : (
            <>
              {explanation?.definition && (
                <Typography
                  sx={{
                    fontSize: '0.9rem',
                    color: theme.palette.text.primary,
                    lineHeight: 1.5,
                  }}
                >
                  {explanation.definition}
                </Typography>
              )}
              {explanation?.example && (
                <Typography
                  sx={{
                    fontFamily: SERIF,
                    fontSize: '0.9rem',
                    color: theme.palette.text.secondary,
                    fontStyle: 'italic',
                    mt: 1,
                    pl: 1,
                    borderLeft: `2px solid ${alpha(accent || theme.palette.primary.main, 0.3)}`,
                  }}
                >
                  &ldquo;{explanation.example}&rdquo;
                </Typography>
              )}
              {explanation?.related && (
                <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {String(explanation.related)
                    .split(/,|;/)
                    .map((w) => w.trim())
                    .filter(Boolean)
                    .map((w) => (
                      <Chip
                        key={w}
                        label={w}
                        size="small"
                        sx={{
                          fontSize: '0.72rem',
                          bgcolor: alpha(
                            accent || theme.palette.primary.main,
                            0.08,
                          ),
                        }}
                      />
                    ))}
                </Box>
              )}
            </>
          )}

          <Box
            sx={{
              mt: 2,
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 1,
            }}
          >
            {added ? (
              <Typography
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  color: theme.palette.success.main,
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                <CheckCircleOutlineIcon sx={{ fontSize: 16 }} /> Added
              </Typography>
            ) : (
              <Button
                variant="contained"
                size="small"
                onClick={handleAdd}
                disabled={adding || !!error}
                sx={{
                  textTransform: 'none',
                  bgcolor: accent || theme.palette.primary.main,
                  '&:hover': {
                    bgcolor: accent
                      ? alpha(accent, 0.85)
                      : theme.palette.primary.dark,
                  },
                }}
              >
                {adding ? 'Adding…' : 'Add to dictionary'}
              </Button>
            )}
          </Box>
        </Box>
      )}
    </Popover>
  );
}

export default WordLookupPopover;
