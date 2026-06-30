/* eslint-disable react/prop-types */
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Chip,
  Tooltip,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import LightbulbIcon from '@mui/icons-material/LightbulbOutlined';
import spineApi from '../../api/spineApi';
import {
  getSvoHintPrompt,
  getTenseHintPrompt,
  getVerbOptionsPrompt,
} from '../../../commons/utils/AIPrompts';

const MONO = `'JetBrains Mono', Menlo, Monaco, Consolas, monospace`;

// Role labels rendered on each clause row. Order matches the prompt enum.
const ROLE_LABELS = {
  main: '主句 · main',
  coordinate: '并列 · coordinate',
  relative: '定语 · relative',
  cause: '原因 · cause',
  concession: '让步 · concession',
  condition: '条件 · condition',
  purpose: '目的 · purpose',
  time: '时间 · time',
  manner: '方式 · manner',
  comparison: '比较 · comparison',
  'noun-clause': '名词从句 · noun-clause',
  participle: '分词 · participle',
  other: '其他 · other',
};

// Per-role inline-annotation color. Used to paint each clause's tokens
// directly on the original Chinese sentence so the 主句/从句 boundaries
// are visible at a glance, not just listed in a table below.
const ROLE_COLORS = {
  main: '#1565C0',            // blue — the spine
  coordinate: '#0288D1',      // cyan — parallel
  relative: '#7B1FA2',        // purple — modifier
  cause: '#E65100',           // orange — because/since
  concession: '#C62828',      // red — although/despite
  condition: '#2E7D32',       // green — if/unless
  purpose: '#5E35B1',         // deep purple — in order to
  time: '#00838F',            // teal — when/while
  manner: '#6D4C41',          // brown — like/as
  comparison: '#AD1457',      // pink — more/less than
  'noun-clause': '#558B2F',   // olive — that-clause
  participle: '#827717',      // mustard — -ing/-ed adjunct
  other: '#455A64',           // slate
};

const roleColor = (role) => ROLE_COLORS[role] || ROLE_COLORS.other;
const roleLabel = (role) => ROLE_LABELS[role] || role || 'clause';

// Walk the clauses and produce a sorted, non-overlapping list of
// highlight ranges over the source text. Each range carries enough
// metadata for the renderer to color it + show a hover tooltip.
function buildHighlightRanges(source, clauses) {
  if (!source || !Array.isArray(clauses)) return [];
  const ranges = [];
  const seenAt = (start, end) =>
    ranges.some((r) => !(end <= r.start || start >= r.end));
  const PLACEHOLDER = /^\(.*\)$|^$/; // skip "(implied)", "(none)", ""

  clauses.forEach((c, ci) => {
    if (!c) return;
    const color = roleColor(c.role);
    const role = c.role;
    [
      ['subject', c.subject?.source],
      ['verb', c.verb?.source],
      ['object', c.object?.source],
    ].forEach(([slot, text]) => {
      if (!text || PLACEHOLDER.test(text)) return;
      const idx = source.indexOf(text);
      if (idx < 0) return;
      const end = idx + text.length;
      if (seenAt(idx, end)) return; // first clause wins on overlap
      ranges.push({ start: idx, end, color, role, slot, ci });
    });
    const conn = c.connectorSource;
    if (conn && !PLACEHOLDER.test(conn)) {
      const idx = source.indexOf(conn);
      if (idx >= 0 && !seenAt(idx, idx + conn.length)) {
        ranges.push({
          start: idx,
          end: idx + conn.length,
          color,
          role,
          slot: 'connector',
          ci,
        });
      }
    }
  });

  ranges.sort((a, b) => a.start - b.start);
  return ranges;
}

function AnnotatedSource({ source, clauses }) {
  const ranges = buildHighlightRanges(source, clauses);
  if (!source) return null;

  const out = [];
  let pos = 0;
  ranges.forEach((r, i) => {
    if (r.start > pos) {
      // eslint-disable-next-line react/no-array-index-key
      out.push(<span key={`t${i}`}>{source.slice(pos, r.start)}</span>);
    }
    const tip = `${roleLabel(r.role)} — ${r.slot}`;
    out.push(
      <Tooltip
        // eslint-disable-next-line react/no-array-index-key
        key={`s${i}`}
        title={tip}
        arrow
        enterDelay={200}
      >
        <Box
          component="span"
          sx={{
            display: 'inline-block',
            borderBottom: `2px solid ${r.color}`,
            bgcolor: alpha(r.color, 0.1),
            color: r.color,
            fontWeight: 600,
            px: 0.4,
            borderRadius: '3px',
            mx: '1px',
            cursor: 'help',
          }}
        >
          {source.slice(r.start, r.end)}
        </Box>
      </Tooltip>,
    );
    pos = r.end;
  });
  if (pos < source.length) {
    out.push(<span key="tend">{source.slice(pos)}</span>);
  }

  return (
    <Box
      sx={{
        fontSize: '18px',
        lineHeight: 2.2,
        p: 1.5,
        mb: 1,
        borderRadius: 1,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {out}
    </Box>
  );
}

function ClauseRow({ clause }) {
  if (!clause) return null;
  const accent = roleColor(clause.role);
  const role = ROLE_LABELS[clause.role] || clause.role || 'clause';
  const subjEn = clause.subject?.english || '';
  const verbEn = clause.verb?.english || '';
  const objEn = clause.object?.english || '';
  const subjSrc = clause.subject?.source || '';
  const verbSrc = clause.verb?.source || '';
  const objSrc = clause.object?.source || '';
  const connHints = Array.isArray(clause.connectorEnglishHints)
    ? clause.connectorEnglishHints
    : [];
  return (
    <Box
      sx={{
        mb: 1,
        p: 1,
        borderRadius: 1,
        borderLeft: `3px solid ${accent}`,
        bgcolor: alpha(accent, 0.04),
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          mb: 0.5,
          flexWrap: 'wrap',
        }}
      >
        <Chip
          label={role}
          size="small"
          sx={{
            height: 18,
            fontSize: '0.65rem',
            fontFamily: MONO,
            bgcolor: alpha(accent, 0.15),
            color: accent,
            fontWeight: 700,
          }}
        />
        {clause.connectorSource && (
          <Typography sx={{ fontSize: '0.75rem' }}>
            <em>{clause.connectorSource}</em>
          </Typography>
        )}
        {connHints.length > 0 && (
          <Typography
            sx={{ fontSize: '0.7rem', color: 'text.secondary', fontStyle: 'italic' }}
          >
            → {connHints.join(' / ')}
          </Typography>
        )}
      </Box>
      <Box sx={{ fontSize: '0.8rem', lineHeight: 1.6 }}>
        <div>
          S: <em>{subjSrc || '(implied)'}</em> → {subjEn}
        </div>
        <div>
          V: <em>{verbSrc}</em> → {verbEn}
        </div>
        <div>
          O: <em>{objSrc || '(none)'}</em> → {objEn}
        </div>
      </Box>
      {clause.note && (
        <Typography
          sx={{
            fontSize: '0.72rem',
            color: 'text.secondary',
            mt: 0.5,
            fontStyle: 'italic',
          }}
        >
          {clause.note}
        </Typography>
      )}
    </Box>
  );
}

function VerbBlock({ verb, accent }) {
  if (!verb) return null;
  const options = Array.isArray(verb.options) ? verb.options : [];
  return (
    <Box
      sx={{
        mb: 1.5,
        p: 1,
        borderRadius: 1,
        bgcolor: alpha(accent, 0.04),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.95rem', fontWeight: 700 }}>
          {verb.source}
        </Typography>
        {verb.english_glossary && (
          <Typography
            sx={{ fontSize: '0.72rem', color: 'text.secondary', fontStyle: 'italic' }}
          >
            ≈ {verb.english_glossary}
          </Typography>
        )}
      </Box>
      {options.map((opt, i) => (
        <Box
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          sx={{
            ml: 1,
            mb: 0.75,
            pl: 1,
            borderLeft: `2px solid ${
              opt.recommendedForThisSentence
                ? accent
                : alpha(accent, 0.25)
            }`,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              flexWrap: 'wrap',
            }}
          >
            <Typography
              sx={{
                fontSize: '0.85rem',
                fontWeight: opt.recommendedForThisSentence ? 700 : 500,
                color: opt.recommendedForThisSentence ? accent : 'text.primary',
              }}
            >
              {opt.english}
            </Typography>
            {opt.recommendedForThisSentence && (
              <Chip
                label="best fit here"
                size="small"
                sx={{
                  height: 16,
                  fontSize: '0.6rem',
                  fontFamily: MONO,
                  bgcolor: alpha(accent, 0.18),
                  color: accent,
                  fontWeight: 700,
                }}
              />
            )}
          </Box>
          {opt.usage && (
            <Typography
              sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.25 }}
            >
              {opt.usage}
            </Typography>
          )}
          {opt.example && (
            <Typography
              sx={{
                fontSize: '0.72rem',
                color: 'text.secondary',
                fontStyle: 'italic',
                mt: 0.25,
              }}
            >
              e.g. “{opt.example}”
            </Typography>
          )}
          {opt.trap && (
            <Typography
              sx={{
                fontSize: '0.7rem',
                color: 'error.main',
                mt: 0.25,
              }}
            >
              ⚠ {opt.trap}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}

export { AnnotatedSource, buildHighlightRanges, ROLE_COLORS };

function ScaffoldRail({ source, language, onHintsChange, initialHints = {} }) {
  const theme = useTheme();
  const accent = theme.palette.primary.main;
  const [hints, setHints] = useState(initialHints);
  const [svoData, setSvoData] = useState(null);
  const [tenseData, setTenseData] = useState(null);
  const [verbsData, setVerbsData] = useState(null);
  const [loading, setLoading] = useState({
    svo: false,
    tense: false,
    verbs: false,
  });

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

  const revealVerbs = async () => {
    if (verbsData || loading.verbs) return;
    setLoading((p) => ({ ...p, verbs: true }));
    try {
      const r = await spineApi.generateContentWithJson(
        getVerbOptionsPrompt(source, langTag),
        null,
        { label: 'translate-verb-options' },
      );
      if (r) {
        setVerbsData(r);
        recordHint('verbs');
      }
    } finally {
      setLoading((p) => ({ ...p, verbs: false }));
    }
  };

  const clauses = Array.isArray(svoData?.clauses) ? svoData.clauses : [];
  const verbs = Array.isArray(verbsData?.verbs) ? verbsData.verbs : [];

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: '14px',
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        bgcolor: alpha(accent, 0.03),
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
          onClick={revealVerbs}
          disabled={loading.verbs}
        >
          {loading.verbs ? <CircularProgress size={14} /> : 'Verb options'}
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={revealTense}
          disabled={loading.tense}
        >
          {loading.tense ? <CircularProgress size={14} /> : 'Tense hint'}
        </Button>
      </Box>

      {svoData && (
        <Box
          sx={{
            mt: 1.5,
            p: 1,
            borderRadius: 1,
            bgcolor: alpha(theme.palette.background.paper, 0.6),
          }}
        >
          <Typography
            sx={{
              fontSize: '0.7rem',
              fontFamily: MONO,
              fontWeight: 700,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              mb: 0.75,
            }}
          >
            Source structure
          </Typography>
          <AnnotatedSource source={source} clauses={clauses} />
          <Typography
            sx={{
              fontSize: '0.7rem',
              fontFamily: MONO,
              fontWeight: 700,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              mb: 0.75,
              mt: 1,
            }}
          >
            Clause-by-clause SVO ({clauses.length})
          </Typography>
          {clauses.map((c, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <ClauseRow key={i} clause={c} />
          ))}
          {svoData.overallNote && (
            <Typography
              sx={{
                fontSize: '0.75rem',
                color: 'text.secondary',
                fontStyle: 'italic',
                mt: 0.5,
                pt: 0.5,
                borderTop: `1px dashed ${alpha(theme.palette.divider, 0.3)}`,
              }}
            >
              {svoData.overallNote}
            </Typography>
          )}
        </Box>
      )}

      {verbsData && (
        <Box
          sx={{
            mt: 1.5,
            p: 1,
            borderRadius: 1,
            bgcolor: alpha(theme.palette.background.paper, 0.6),
          }}
        >
          <Typography
            sx={{
              fontSize: '0.7rem',
              fontFamily: MONO,
              fontWeight: 700,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              mb: 0.75,
            }}
          >
            Verb options ({verbs.length})
          </Typography>
          {verbs.map((v, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <VerbBlock key={i} verb={v} accent={accent} />
          ))}
        </Box>
      )}

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
    </Box>
  );
}

export default ScaffoldRail;
