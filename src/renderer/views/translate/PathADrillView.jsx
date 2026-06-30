/* eslint-disable react/prop-types */
import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Collapse,
  CircularProgress,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import spineApi from '../../api/spineApi';
import learningPointApi from '../../api/learningPointApi';
import {
  getTranslateComparePrompt,
  getTranslatePrompt,
} from '../../../commons/utils/AIPrompts';
import { LanguageModel } from '../../../commons/model/DataTypes';
import ScaffoldRail from './ScaffoldRail';
import DiffSpansRenderer from './DiffSpansRenderer';
import WeaknessChip from './WeaknessChip';
import ModelBuildPanel from './ModelBuildPanel';
import { BUCKETS } from './buckets';

function langTag(language) {
  return language === LanguageModel.Japanese ? 'Japanese' : 'Chinese';
}

function bcp47Source(language) {
  return language === LanguageModel.Japanese ? 'ja-JP' : 'zh-Hans';
}

function PathADrillView({ source, language }) {
  const theme = useTheme();
  const [attempt, setAttempt] = useState('');
  const [hints, setHints] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  // Breakdown is fetched lazily via translate-quick (the well-tested legacy
  // prompt) so a malformed nested step shape from the compare prompt can
  // never crash the main result.
  const [breakdownSteps, setBreakdownSteps] = useState(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  const compare = async () => {
    if (!attempt.trim() || loading) return;
    setLoading(true);
    try {
      const r = await spineApi.generateContentWithJson(
        getTranslateComparePrompt(source, attempt.trim(), langTag(language)),
        null,
        { label: 'translate-compare' },
      );
      if (r) setResult(r);
    } finally {
      setLoading(false);
    }
  };

  // Reduce spans into weakness chips grouped by pair_id.
  const weaknesses = useMemo(() => {
    if (!result?.spans) return [];
    const byPair = {};
    result.spans.forEach((s) => {
      if (!s.pair_id) return;
      const p = byPair[s.pair_id] || {
        bucket: s.bucket,
        pair_id: s.pair_id,
        reason: s.reason,
      };
      if (s.side === 'learner') p.learner_text = s.text;
      if (s.side === 'model') p.model_text = s.text;
      if (s.reason) p.reason = s.reason;
      if (s.bucket) p.bucket = s.bucket;
      byPair[s.pair_id] = p;
    });
    return Object.values(byPair)
      .filter((w) => BUCKETS.includes(w.bucket))
      .sort((a, b) => BUCKETS.indexOf(a.bucket) - BUCKETS.indexOf(b.bucket));
  }, [result]);

  const handleSave = async (w) => {
    await learningPointApi.create({
      domain: 'language',
      content: `${w.bucket}: ${w.model_text}`,
      extras: {
        sourceLang: bcp47Source(language),
        targetLang: 'en-US',
        pattern: w.reason || '',
        bucket: w.bucket,
        learnerAttempt: w.learner_text,
        modelTarget: w.model_text,
        reason: w.reason || '',
        hintsUsed: hints,
      },
      featureSurface: 'translate-drill',
    });
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box
        sx={{
          p: 2,
          mb: 2,
          borderRadius: '14px',
          bgcolor: alpha(theme.palette.text.primary, 0.04),
          border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        }}
      >
        <Typography
          variant="caption"
          sx={{ display: 'block', color: theme.palette.text.disabled, mb: 0.5 }}
        >
          SOURCE
        </Typography>
        <Typography sx={{ fontSize: '15px' }}>{source}</Typography>
      </Box>
      <Box sx={{ mb: 2 }}>
        <ScaffoldRail
          source={source}
          language={langTag(language)}
          onHintsChange={setHints}
        />
      </Box>
      {!result && (
        <Box>
          <TextField
            fullWidth
            multiline
            minRows={3}
            maxRows={6}
            value={attempt}
            onChange={(e) => setAttempt(e.target.value)}
            placeholder="Your English…"
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
      {result && (
        <Box>
          <DiffSpansRenderer
            learnerText={attempt.trim()}
            modelText={result.modelEnglish}
            spans={result.spans || []}
          />
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>
              Weaknesses ({weaknesses.length})
            </Typography>
            {weaknesses.map((w) => (
              <WeaknessChip key={w.pair_id} weakness={w} onSave={handleSave} />
            ))}
            {weaknesses.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No issues found — strong attempt.
              </Typography>
            )}
          </Box>
          <Box sx={{ mt: 3 }}>
            <Button
              size="small"
              variant="text"
              disabled={breakdownLoading}
              onClick={async () => {
                if (showBreakdown) {
                  setShowBreakdown(false);
                  return;
                }
                setShowBreakdown(true);
                if (!breakdownSteps && !breakdownLoading) {
                  setBreakdownLoading(true);
                  try {
                    const r = await spineApi.generateContentWithJson(
                      getTranslatePrompt(source, langTag(language)),
                      null,
                      { label: 'translate-quick' },
                    );
                    if (r) setBreakdownSteps(r);
                  } finally {
                    setBreakdownLoading(false);
                  }
                }
              }}
            >
              {showBreakdown ? 'Hide' : 'Show'} how the model built it
            </Button>
            <Collapse in={showBreakdown}>
              <Box sx={{ mt: 2 }}>
                {breakdownLoading && !breakdownSteps && (
                  <Typography variant="body2" color="text.secondary">
                    Loading breakdown…
                  </Typography>
                )}
                {breakdownSteps && (
                  <ModelBuildPanel
                    steps={breakdownSteps}
                    originalTokens={[]}
                    language={langTag(language)}
                  />
                )}
              </Box>
            </Collapse>
          </Box>
        </Box>
      )}
    </Box>
  );
}

export default PathADrillView;
