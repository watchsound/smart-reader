import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import PhaseTabBar from './PhaseTabBar';
import SourcePanel from './SourcePanel';
import RecallLadder from './RecallLadder';
import ComposeCompare from './ComposeCompare';
import { ACCENT, PHASES } from './config';
import { langstudyRecallLadderPrompt } from '../../../commons/utils/AIPrompts';
import { parseRecallLadder } from './recallLadderParser';
import { buildPosMask } from './posTagger';
import spineApi from '../../api/spineApi';

const EMPTY_VARIANTS = {
  adj: '',
  connect: '',
  noun: '',
  verb: '',
  clause: '',
  subord: '',
};

function WritingView() {
  const theme = useTheme();
  const mode = theme.palette.mode === 'dark' ? 'dark' : 'light';

  const [activePhase, setActivePhase] = useState('prepare');
  const [text, setText] = useState('');
  const [sourceLocked, setSourceLocked] = useState(false);
  const [recallVariants, setRecallVariants] = useState(EMPTY_VARIANTS);
  const [recallLoading, setRecallLoading] = useState(false);

  const phaseIdx = PHASES.findIndex((p) => p.id === activePhase);
  // eslint-disable-next-line no-nested-ternary
  const intensityKey = phaseIdx === 0 ? 200 : phaseIdx === 1 ? 400 : 600;
  const accent = ACCENT[mode][intensityKey];

  // Build the 6-rung variant set. 3 POS-based rungs (adj / noun / verb) are
  // computed locally and ship immediately; 3 structural rungs (connect /
  // clause / subord) come from one batched LLM call.
  useEffect(() => {
    let cancelled = false;
    async function go() {
      if (
        activePhase !== 'recall' ||
        !sourceLocked ||
        !text ||
        recallVariants.adj
      ) {
        return;
      }
      // Local POS masks land synchronously — Adjectives rung is immediately
      // usable while the LLM call is still in flight.
      const posMasks = {
        adj: buildPosMask(text, new Set(['adjective'])),
        noun: buildPosMask(text, new Set(['noun'])),
        verb: buildPosMask(text, new Set(['verb'])),
      };
      if (!cancelled) {
        setRecallVariants((prev) => ({ ...prev, ...posMasks }));
      }
      setRecallLoading(true);
      try {
        const res = await spineApi.generateContentWithJson(
          langstudyRecallLadderPrompt(text),
          null,
          { label: 'writing-recall-ladder' },
        );
        const parsed = parseRecallLadder(res);
        if (!cancelled) {
          setRecallVariants((prev) => ({
            ...prev,
            connect: parsed.light,
            clause: parsed.medium,
            subord: parsed.hard,
          }));
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Recall ladder fetch failed', err);
      } finally {
        if (!cancelled) setRecallLoading(false);
      }
    }
    go();
    return () => {
      cancelled = true;
    };
  }, [activePhase, sourceLocked, text, recallVariants.adj]);

  const handleLock = () => {
    if (!text.trim()) return;
    setSourceLocked(true);
    setActivePhase('recall');
  };

  const handleUnlock = () => {
    setSourceLocked(false);
    setRecallVariants(EMPTY_VARIANTS);
    setActivePhase('prepare');
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: theme.palette.background.default,
        overflow: 'hidden',
      }}
    >
      <PhaseTabBar
        activePhase={activePhase}
        sourceLocked={sourceLocked}
        onChange={setActivePhase}
        accent={accent}
      />
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          py: 3,
          px: { xs: 2, md: 3 },
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 1200 }}>
          {activePhase === 'prepare' && (
            <SourcePanel
              text={text}
              onTextChange={setText}
              sourceLocked={sourceLocked}
              onLock={handleLock}
              onUnlock={handleUnlock}
              accent={accent}
            />
          )}
          {activePhase === 'recall' && (
            <RecallLadder
              variants={recallVariants}
              loading={recallLoading}
              accent={accent}
              onContinue={() => setActivePhase('compose')}
            />
          )}
          {activePhase === 'compose' && (
            <ComposeCompare originalText={text} accent={accent} />
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default WritingView;
