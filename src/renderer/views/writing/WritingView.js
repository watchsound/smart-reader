import React, { useEffect, useRef, useState } from 'react';
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

// Cap the LLM call at 45s so a hung provider (network issue, broken IPC,
// missing API key) surfaces as a clear failure with a retry option instead
// of an infinite spinner. The POS rungs remain usable throughout.
const RECALL_TIMEOUT_MS = 45000;

async function fetchLlmRungs(text) {
  const timeoutPromise = new Promise((_resolve, reject) => {
    setTimeout(
      () =>
        reject(new Error('Recall ladder request timed out after 45 seconds')),
      RECALL_TIMEOUT_MS,
    );
  });
  const res = await Promise.race([
    spineApi.generateContentWithJson(langstudyRecallLadderPrompt(text), null, {
      label: 'writing-recall-ladder',
    }),
    timeoutPromise,
  ]);
  return parseRecallLadder(res);
}

function WritingView() {
  const theme = useTheme();
  const mode = theme.palette.mode === 'dark' ? 'dark' : 'light';

  const [activePhase, setActivePhase] = useState('prepare');
  const [text, setText] = useState('');
  const [sourceLocked, setSourceLocked] = useState(false);
  const [recallVariants, setRecallVariants] = useState(EMPTY_VARIANTS);
  const [recallLoading, setRecallLoading] = useState(false);
  const [recallError, setRecallError] = useState(null);
  // Latest-call-wins token. Every LLM call (effect or retry) stamps itself
  // with the current value at start; on resolve it checks whether its stamp
  // is still current. Effect cleanup increments the ref so a call begun
  // before unlock/re-lock can't overwrite state from the new source.
  const callTokenRef = useRef(0);

  const phaseIdx = PHASES.findIndex((p) => p.id === activePhase);
  // eslint-disable-next-line no-nested-ternary
  const intensityKey = phaseIdx === 0 ? 200 : phaseIdx === 1 ? 400 : 600;
  const accent = ACCENT[mode][intensityKey];

  // Build the 6-rung variant set. 3 POS-based rungs (adj / noun / verb) are
  // computed locally and ship immediately; 3 structural rungs (connect /
  // clause / subord) come from one batched LLM call.
  useEffect(() => {
    if (
      activePhase !== 'recall' ||
      !sourceLocked ||
      !text ||
      recallVariants.adj
    ) {
      return undefined;
    }
    // Local POS masks land synchronously — Adjectives rung is immediately
    // usable while the LLM call is still in flight. Cap each rung at 8
    // simultaneous masks so a noun-heavy paragraph (~50% noun density in
    // typical prose) does not turn a single rung into half-the-paragraph
    // free recall. Evenly-spaced sampling keeps the masks spatially
    // distributed instead of clustering at the front of the paragraph.
    const POS_MASK_CAP = 8;
    const posMasks = {
      adj: buildPosMask(text, new Set(['adjective']), { cap: POS_MASK_CAP }),
      noun: buildPosMask(text, new Set(['noun']), { cap: POS_MASK_CAP }),
      verb: buildPosMask(text, new Set(['verb']), { cap: POS_MASK_CAP }),
    };
    setRecallVariants((prev) => ({ ...prev, ...posMasks }));
    setRecallError(null);
    setRecallLoading(true);

    callTokenRef.current += 1;
    const myToken = callTokenRef.current;
    (async () => {
      try {
        const parsed = await fetchLlmRungs(text);
        if (myToken !== callTokenRef.current) return;
        setRecallVariants((prev) => ({
          ...prev,
          connect: parsed.light,
          clause: parsed.medium,
          subord: parsed.hard,
        }));
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Recall ladder fetch failed', err);
        if (myToken !== callTokenRef.current) return;
        setRecallError(err?.message || 'Recall ladder request failed.');
      } finally {
        if (myToken === callTokenRef.current) setRecallLoading(false);
      }
    })();
    return () => {
      // Invalidate any in-flight call from this effect run so its result
      // can't overwrite state owned by the next effect run (e.g. after
      // unlock/re-lock with new source text).
      callTokenRef.current += 1;
    };
  }, [activePhase, sourceLocked, text, recallVariants.adj]);

  const retryLlmRungs = async () => {
    setRecallVariants((prev) => ({
      ...prev,
      connect: '',
      clause: '',
      subord: '',
    }));
    setRecallError(null);
    setRecallLoading(true);
    callTokenRef.current += 1;
    const myToken = callTokenRef.current;
    try {
      const parsed = await fetchLlmRungs(text);
      if (myToken !== callTokenRef.current) return;
      setRecallVariants((prev) => ({
        ...prev,
        connect: parsed.light,
        clause: parsed.medium,
        subord: parsed.hard,
      }));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Recall ladder retry failed', err);
      if (myToken !== callTokenRef.current) return;
      setRecallError(err?.message || 'Recall ladder request failed.');
    } finally {
      if (myToken === callTokenRef.current) setRecallLoading(false);
    }
  };

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
              error={recallError}
              onRetry={retryLlmRungs}
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
