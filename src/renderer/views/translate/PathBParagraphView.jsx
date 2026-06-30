/* eslint-disable react/prop-types */
import React, { useEffect, useState } from 'react';
import { Box, TextField, Button, CircularProgress } from '@mui/material';
import SourcePanel from '../writing/SourcePanel';
import FiveWRail from '../writing/FiveWRail';
import ExpressionDiffPanel from '../writing/ExpressionDiffPanel';
import learningPointApi from '../../api/learningPointApi';
import spineApi from '../../api/spineApi';
import {
  langstudy5wPrompt,
  getTranslateParagraphComparePrompt,
} from '../../../commons/utils/AIPrompts';
import { LanguageModel } from '../../../commons/model/DataTypes';

const ACCENT = '#0E8A8A';
const langTag = (lang) =>
  lang === LanguageModel.Japanese ? 'Japanese' : 'Chinese';
const bcp47 = (lang) => (lang === LanguageModel.Japanese ? 'ja-JP' : 'zh-Hans');

function PathBParagraphView({ source, language }) {
  const [lang5w, setLang5w] = useState(null);
  const [attempt, setAttempt] = useState('');
  const [diff, setDiff] = useState(null);
  const [loading, setLoading] = useState(false);
  const sourceLabel =
    language === LanguageModel.Japanese ? '日本語段落' : '中文段落';

  // Fetch 5W on mount.
  useEffect(() => {
    let cancelled = false;
    async function fetch5w() {
      const r = await spineApi.generateContentWithJson(
        `${langstudy5wPrompt}\n ${source}`,
        null,
        { label: 'writing-5w-scaffold' },
      );
      if (!cancelled && r) setLang5w(r);
    }
    fetch5w();
    return () => {
      cancelled = true;
    };
  }, [source]);

  const compare = async () => {
    if (!attempt.trim() || loading) return;
    setLoading(true);
    try {
      const r = await spineApi.generateContentWithJson(
        getTranslateParagraphComparePrompt(
          source,
          attempt.trim(),
          langTag(language),
        ),
        null,
        { label: 'translate-paragraph-compare' },
      );
      if (r) setDiff(r);
    } finally {
      setLoading(false);
    }
  };

  // Save up to 5 notes as Learning Points (per-note inline chips deferred to v1.1).
  const saveAllNotes = async () => {
    if (!diff?.sentenceComparisons) return;
    let saved = 0;
    for (const group of diff.sentenceComparisons) {
      for (const n of group.notes || []) {
        if (saved >= 5) return;
        // eslint-disable-next-line no-await-in-loop
        await learningPointApi.create({
          domain: 'language',
          content: `${n.pair_id}: ${n.model_phrase || ''}`,
          extras: {
            sourceLang: bcp47(language),
            targetLang: 'en-US',
            pattern: n.explanation || '',
            bucket: n.bucket || 'idiom-register',
            learnerAttempt: n.learner_phrase,
            modelTarget: n.model_phrase,
            reason: n.explanation,
          },
          featureSurface: 'translate-drill',
        });
        saved += 1;
      }
    }
  };

  return (
    <Box
      sx={{
        maxWidth: 900,
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <SourcePanel
        text={source}
        onTextChange={() => {}}
        sourceLocked
        accent={ACCENT}
        label={sourceLabel}
        placeholder=""
      />
      <FiveWRail lang5w={lang5w} accent={ACCENT} />
      {!diff && (
        <Box>
          <TextField
            fullWidth
            multiline
            minRows={6}
            maxRows={14}
            value={attempt}
            onChange={(e) => setAttempt(e.target.value)}
            placeholder="Your English paragraph…"
            sx={{ mb: 1.5 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={compare}
              disabled={!attempt.trim() || loading}
              startIcon={
                loading ? <CircularProgress size={14} color="inherit" /> : null
              }
            >
              Compare
            </Button>
          </Box>
        </Box>
      )}
      {diff && (
        <Box>
          <ExpressionDiffPanel
            original={diff.modelEnglish}
            learner={attempt.trim()}
            diff={diff}
            accent={ACCENT}
          />
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="small" variant="outlined" onClick={saveAllNotes}>
              Save up to 5 notes as Learning Points
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default PathBParagraphView;
