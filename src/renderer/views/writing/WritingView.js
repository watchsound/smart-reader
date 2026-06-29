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
import spineApi from '../../api/spineApi';

function WritingView() {
  const theme = useTheme();
  const mode = theme.palette.mode === 'dark' ? 'dark' : 'light';

  const [activePhase, setActivePhase] = useState('prepare');
  const [text, setText] = useState('');
  const [sourceLocked, setSourceLocked] = useState(false);
  const [recallVariants, setRecallVariants] = useState({
    light: '',
    medium: '',
    hard: '',
  });
  const [recallLoading, setRecallLoading] = useState(false);

  const phaseIdx = PHASES.findIndex((p) => p.id === activePhase);
  // eslint-disable-next-line no-nested-ternary
  const intensityKey = phaseIdx === 0 ? 200 : phaseIdx === 1 ? 400 : 600;
  const accent = ACCENT[mode][intensityKey];

  useEffect(() => {
    let cancelled = false;
    async function go() {
      if (
        activePhase !== 'recall' ||
        !sourceLocked ||
        !text ||
        recallVariants.light
      ) {
        return;
      }
      setRecallLoading(true);
      try {
        const res = await spineApi.generateContentWithJson(
          langstudyRecallLadderPrompt(text),
          null,
          { label: 'writing-recall-ladder' },
        );
        if (!cancelled) setRecallVariants(parseRecallLadder(res));
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
  }, [activePhase, sourceLocked, text, recallVariants.light]);

  const handleLock = () => {
    if (!text.trim()) return;
    setSourceLocked(true);
    setActivePhase('recall');
  };

  const handleUnlock = () => {
    setSourceLocked(false);
    setRecallVariants({ light: '', medium: '', hard: '' });
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
