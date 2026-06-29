import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  Drawer,
  IconButton,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CloseIcon from '@mui/icons-material/Close';
import MultilineTextField from './MultilineTextField';
import FiveWRail from './FiveWRail';
import ComposeScaffolds from './ComposeScaffolds';
import ExpressionDiffPanel from './ExpressionDiffPanel';
import spineApi from '../../api/spineApi';
import {
  langstudy5wPrompt,
  langstudyExpressionDiffPrompt,
  langstudyComposeScaffoldsPrompt,
} from '../../../commons/utils/AIPrompts';
import { parseExpressionDiff } from './expressionDiffParser';
import { parseComposeScaffolds } from './composeScaffoldsParser';

// L1 = the learner's native language for the translation scaffold.
// Hardcoded for now; could become a settings field later.
const LEARNER_L1 = 'Chinese';

const SERIF = `'Source Serif Pro', Georgia, 'Times New Roman', serif`;
const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

function ComposeCompare({ originalText, accent }) {
  const theme = useTheme();
  const [lang5w, setLang5w] = useState(null);
  const [scaffolds, setScaffolds] = useState(null);
  const [mywriting, setMywriting] = useState('');
  const [stage, setStage] = useState('compose'); // 'compose' | 'compare'
  const [diff, setDiff] = useState(null);
  const [loadingScaffolds, setLoadingScaffolds] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [refOpen, setRefOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function go() {
      if (!originalText || scaffolds) return;
      setLoadingScaffolds(true);

      const fiveWP = spineApi
        .generateContentWithJson(
          `${langstudy5wPrompt}\n ${originalText}`,
          null,
          { label: 'writing-5w-scaffold' },
        )
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error('5W fetch failed', err);
          return null;
        });

      const scaffoldP = spineApi
        .generateContentWithJson(
          langstudyComposeScaffoldsPrompt(originalText, LEARNER_L1),
          null,
          { label: 'writing-compose-scaffolds' },
        )
        .then(parseComposeScaffolds)
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error('Compose scaffolds fetch failed', err);
          return { gists: [], phrases: [], translation: '' };
        });

      const [fiveWRes, scaffoldRes] = await Promise.all([fiveWP, scaffoldP]);
      if (!cancelled) {
        setLang5w(fiveWRes);
        setScaffolds(scaffoldRes);
        setLoadingScaffolds(false);
      }
    }
    go();
    return () => {
      cancelled = true;
    };
  }, [originalText, scaffolds]);

  const handleCompare = async () => {
    if (!mywriting.trim() || !originalText) return;
    setLoadingDiff(true);
    try {
      const res = await spineApi.generateContentWithJson(
        langstudyExpressionDiffPrompt(originalText, mywriting),
        null,
        { label: 'writing-expression-diff' },
      );
      setDiff(parseExpressionDiff(res));
      setStage('compare');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Expression diff failed', err);
    } finally {
      setLoadingDiff(false);
    }
  };

  const wordCount = mywriting.trim() ? mywriting.trim().split(/\s+/).length : 0;
  const minWords = 10;
  const canCompare = wordCount >= minWords && !loadingDiff;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {stage === 'compose' && (
        <>
          {loadingScaffolds ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={16} sx={{ color: accent }} />
              <Typography variant="body2" color="text.secondary">
                Building scaffolds…
              </Typography>
            </Box>
          ) : (
            <>
              <ComposeScaffolds scaffolds={scaffolds} accent={accent} />
              <FiveWRail lang5w={lang5w} accent={accent} />
            </>
          )}

          <Box
            sx={{
              bgcolor: theme.palette.background.paper,
              borderRadius: '14px',
              border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
              borderLeft: `4px solid ${accent}`,
              p: 2,
              fontFamily: SERIF,
            }}
          >
            <MultilineTextField
              initialText={mywriting}
              placeholder="Express the same idea in your own words…"
              onTextChange={setMywriting}
              colors={{ accent }}
              minimal
            />
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mt: 1,
              }}
            >
              <Typography
                sx={{
                  fontFamily: MONO,
                  fontSize: '0.72rem',
                  color: theme.palette.text.secondary,
                }}
              >
                {wordCount} word{wordCount === 1 ? '' : 's'}
                {wordCount < minWords
                  ? ` · ${minWords - wordCount} more to compare`
                  : ''}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton size="small" onClick={() => setRefOpen(true)}>
                  <InfoOutlinedIcon sx={{ fontSize: 18 }} />
                </IconButton>
                <Typography
                  component="button"
                  disabled={!canCompare}
                  onClick={canCompare ? handleCompare : undefined}
                  sx={{
                    fontFamily: MONO,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    border: 'none',
                    borderRadius: 1,
                    background: canCompare ? accent : alpha(accent, 0.3),
                    color: '#fff',
                    cursor: canCompare ? 'pointer' : 'not-allowed',
                    px: 2,
                    py: 0.75,
                    opacity: canCompare ? 1 : 0.5,
                  }}
                >
                  {loadingDiff ? 'Comparing…' : 'Compare with original →'}
                </Typography>
              </Box>
            </Box>
          </Box>
        </>
      )}

      {stage === 'compare' && diff && (
        <>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography
              sx={{
                fontFamily: MONO,
                fontSize: '0.72rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: theme.palette.text.secondary,
              }}
            >
              COMPARING
            </Typography>
            <Typography
              component="button"
              onClick={() => setStage('compose')}
              sx={{
                fontFamily: MONO,
                fontSize: '0.72rem',
                background: 'transparent',
                border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
                color: theme.palette.text.secondary,
                borderRadius: 1,
                px: 1.5,
                py: 0.5,
                cursor: 'pointer',
              }}
            >
              ← Edit my version
            </Typography>
          </Box>
          <ExpressionDiffPanel
            original={originalText}
            learner={mywriting}
            diff={diff}
            accent={accent}
          />
        </>
      )}

      <Drawer
        anchor="right"
        open={refOpen}
        onClose={() => setRefOpen(false)}
        PaperProps={{ sx: { width: 420, p: 3 } }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Typography
            sx={{
              fontFamily: MONO,
              fontSize: '0.72rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            REFERENCE ORIGINAL
          </Typography>
          <IconButton size="small" onClick={() => setRefOpen(false)}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        <Typography
          sx={{ fontFamily: SERIF, fontSize: '17px', lineHeight: 1.8 }}
        >
          {originalText}
        </Typography>
      </Drawer>
    </Box>
  );
}

export default ComposeCompare;
