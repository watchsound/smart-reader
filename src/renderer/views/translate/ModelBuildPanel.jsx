/* eslint-disable react/prop-types */
import React from 'react';
import { Box, Link } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import StepOneSVOCard from './StepOneSVOCard';
import StepTwoVerbCard from './StepTwoVerbCard';
import StepThreeSentenceStructureCard from './StepThreeSentenceStructureCard';
import StepFourSentenceScaffoldCard from './StepFourSentenceScaffoldCard';
import StepFiveFinalCard from './StepFiveFinalCard';

function StepWrap({ index, onDemote, children }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        borderRadius: '14px',
        border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        bgcolor: theme.palette.background.paper,
        p: 2,
        mb: 1.5,
      }}
    >
      {children}
      {onDemote && (
        <Box sx={{ mt: 1.5, textAlign: 'right' }}>
          <Link
            component="button"
            type="button"
            onClick={() => onDemote(index)}
            sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}
          >
            try this step yourself →
          </Link>
        </Box>
      )}
    </Box>
  );
}

function ModelBuildPanel({ steps, originalTokens, language, onDemote }) {
  if (!steps || typeof steps !== 'object') return null;
  // Defensive: a malformed stepBreakdown from the LLM (missing keys, wrong
  // types) shouldn't take down the whole compare view. Render only the
  // steps that arrive in a usable shape.
  const s1 = steps['step-1'];
  const s2 = steps['step-2'];
  const s3 = steps['step-3'];
  const s4 = steps['step-4'];
  const s5 = steps['step-5'];
  return (
    <Box>
      {s1 && (
        <StepWrap index={1} onDemote={onDemote}>
          <StepOneSVOCard
            originalTokens={originalTokens || []}
            title={s1.title}
            subVerbObjList={s1['sub-verb-obj-list'] || []}
            explain={s1.explain}
          />
        </StepWrap>
      )}
      {s2 && (
        <StepWrap index={2} onDemote={onDemote}>
          <StepTwoVerbCard
            language={language}
            originalTokens={originalTokens || []}
            title={s2.title}
            inputVerbList={s2['input-verb-list'] || []}
            explain={s2.explain}
          />
        </StepWrap>
      )}
      {s3 && (
        <StepWrap index={3} onDemote={onDemote}>
          <StepFourSentenceScaffoldCard
            title={s3.title}
            scaffoldOptions={s3['scaffold-options'] || []}
            explain={s3.explain}
          />
        </StepWrap>
      )}
      {s4 && (
        <StepWrap index={4} onDemote={onDemote}>
          <StepThreeSentenceStructureCard
            title={s4.title}
            sentenceStructure={s4['sentence-structure'] || ''}
            explain={s4.explain}
          />
        </StepWrap>
      )}
      {s5 && (
        <StepWrap index={5} onDemote={onDemote}>
          <StepFiveFinalCard
            title={s5.title}
            output={s5.output}
            explain={s5.explain}
          />
        </StepWrap>
      )}
    </Box>
  );
}

export default ModelBuildPanel;
