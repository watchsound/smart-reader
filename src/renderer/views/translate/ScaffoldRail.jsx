import React, { useState } from 'react';
import { Box, Typography, Button, Collapse, CircularProgress } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import LightbulbIcon from '@mui/icons-material/LightbulbOutlined';
import spineApi from '../../api/spineApi';
import {
  getSvoHintPrompt,
  getTenseHintPrompt,
} from '../../../commons/utils/AIPrompts';

const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

function ScaffoldRail({ source, language, onHintsChange, initialHints = {} }) {
  const theme = useTheme();
  const [hints, setHints] = useState(initialHints);
  const [svoData, setSvoData] = useState(null);
  const [tenseData, setTenseData] = useState(null);
  const [loading, setLoading] = useState({ svo: false, tense: false });

  const recordHint = (kind) => {
    const next = { ...hints, [kind]: true };
    setHints(next);
    if (onHintsChange) onHintsChange(next);
  };

  const langTag = language === 'Japanese' ? 'Japanese' : 'Chinese';

  const revealSvo = async () => {
    if (svoData || loading.svo) return;
    setLoading((p) => ({ ...p, svo: true }));
    try {
      const r = await spineApi.generateContentWithJson(
        getSvoHintPrompt(source, langTag),
        null,
        { label: 'translate-svo-hint' },
      );
      if (r) {
        setSvoData(r);
        recordHint('svo');
      }
    } finally {
      setLoading((p) => ({ ...p, svo: false }));
    }
  };

  const revealTense = async () => {
    if (tenseData || loading.tense) return;
    setLoading((p) => ({ ...p, tense: true }));
    try {
      const r = await spineApi.generateContentWithJson(
        getTenseHintPrompt(source, langTag),
        null,
        { label: 'translate-tense-hint' },
      );
      if (r) {
        setTenseData(r);
        recordHint('tense');
      }
    } finally {
      setLoading((p) => ({ ...p, tense: false }));
    }
  };

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: '14px',
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        bgcolor: alpha(theme.palette.primary.main, 0.03),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <LightbulbIcon
          sx={{ fontSize: 16, color: theme.palette.text.secondary }}
        />
        <Typography
          sx={{
            fontFamily: MONO,
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: theme.palette.text.secondary,
          }}
        >
          Scaffold
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          size="small"
          variant="outlined"
          onClick={revealSvo}
          disabled={loading.svo}
        >
          {loading.svo ? <CircularProgress size={14} /> : 'Reveal SVO'}
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={revealTense}
          disabled={loading.tense}
        >
          {loading.tense ? <CircularProgress size={14} /> : 'Tense hint'}
        </Button>
        {/* Vocabulary lookup wired via existing Vocabulary surface — out of scope here. */}
      </Box>
      <Collapse in={!!svoData}>
        {svoData && (
          <Box
            sx={{
              mt: 1.5,
              p: 1,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.background.paper, 0.6),
              fontSize: '0.8rem',
            }}
          >
            <Typography sx={{ fontSize: '0.75rem', mb: 0.5, fontWeight: 600 }}>
              SVO
            </Typography>
            <div>
              Subject: <em>{svoData.subject?.source}</em> →{' '}
              {svoData.subject?.english}
            </div>
            <div>
              Verb: <em>{svoData.verb?.source}</em> →{' '}
              {Array.isArray(svoData.verb?.english)
                ? svoData.verb.english.join(' / ')
                : svoData.verb?.english}
            </div>
            <div>
              Object: <em>{svoData.object?.source}</em> →{' '}
              {svoData.object?.english}
            </div>
          </Box>
        )}
      </Collapse>
      <Collapse in={!!tenseData}>
        {tenseData && (
          <Box
            sx={{
              mt: 1.5,
              p: 1,
              borderRadius: 1,
              bgcolor: alpha(theme.palette.background.paper, 0.6),
              fontSize: '0.8rem',
            }}
          >
            <Typography sx={{ fontSize: '0.75rem', mb: 0.5, fontWeight: 600 }}>
              Tense
            </Typography>
            <div>
              <strong>{tenseData.tense}</strong>
            </div>
            <div style={{ color: theme.palette.text.secondary }}>
              {tenseData.justification}
            </div>
          </Box>
        )}
      </Collapse>
    </Box>
  );
}

export default ScaffoldRail;
