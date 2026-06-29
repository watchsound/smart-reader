import React, { useEffect, useState } from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import PhaseTabBar from './PhaseTabBar';
import SourcePanel from './SourcePanel';
import RecallLadder from './RecallLadder';
import ComposeCompare from './ComposeCompare';
import { ACCENT, PHASES } from './config';
import {
  buildPosMask,
  buildConnectivesMask,
  buildClauseStemsMask,
  buildSubordinateMask,
} from './posTagger';

const EMPTY_VARIANTS = {
  adj: '',
  adv: '',
  connect: '',
  noun: '',
  verb: '',
  clause: '',
  subord: '',
};

const POS_CAP = 8;
const SUBORD_CAP = 4;

function buildAllRungs(text) {
  return {
    adj: buildPosMask(text, new Set(['adjective']), { cap: POS_CAP }),
    adv: buildPosMask(text, new Set(['adverb']), { cap: POS_CAP }),
    connect: buildConnectivesMask(text, { cap: POS_CAP }),
    noun: buildPosMask(text, new Set(['noun']), { cap: POS_CAP }),
    verb: buildPosMask(text, new Set(['verb']), { cap: POS_CAP }),
    clause: buildClauseStemsMask(text, { cap: POS_CAP }),
    subord: buildSubordinateMask(text, { cap: SUBORD_CAP }),
  };
}

function WritingView() {
  const theme = useTheme();
  const mode = theme.palette.mode === 'dark' ? 'dark' : 'light';

  const [activePhase, setActivePhase] = useState('prepare');
  const [text, setText] = useState('');
  const [sourceLocked, setSourceLocked] = useState(false);
  const [recallVariants, setRecallVariants] = useState(EMPTY_VARIANTS);

  const phaseIdx = PHASES.findIndex((p) => p.id === activePhase);
  // eslint-disable-next-line no-nested-ternary
  const intensityKey = phaseIdx === 0 ? 200 : phaseIdx === 1 ? 400 : 600;
  const accent = ACCENT[mode][intensityKey];

  // All 7 rungs are now computed locally via compromise. No LLM call,
  // no IPC dependency, no timeout, no hang.
  useEffect(() => {
    if (
      activePhase !== 'recall' ||
      !sourceLocked ||
      !text ||
      recallVariants.adj
    ) {
      return;
    }
    setRecallVariants(buildAllRungs(text));
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
