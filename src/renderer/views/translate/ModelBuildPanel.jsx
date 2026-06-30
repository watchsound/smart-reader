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
  if (!steps) return null;
  return (
    <Box>
      <StepWrap index={1} onDemote={onDemote}>
        <StepOneSVOCard
          originalTokens={originalTokens || []}
          title={steps['step-1'].title}
          subVerbObjList={steps['step-1']['sub-verb-obj-list']}
          explain={steps['step-1'].explain}
        />
      </StepWrap>
      <StepWrap index={2} onDemote={onDemote}>
        <StepTwoVerbCard
          language={language}
          originalTokens={originalTokens || []}
          title={steps['step-2'].title}
          inputVerbList={steps['step-2']['input-verb-list']}
          explain={steps['step-2'].explain}
        />
      </StepWrap>
      <StepWrap index={3} onDemote={onDemote}>
        <StepFourSentenceScaffoldCard
          title={steps['step-3'].title}
          scaffoldOptions={steps['step-3']['scaffold-options']}
          explain={steps['step-3'].explain}
        />
      </StepWrap>
      <StepWrap index={4} onDemote={onDemote}>
        <StepThreeSentenceStructureCard
          title={steps['step-4'].title}
          sentenceStructure={steps['step-4']['sentence-structure']}
          explain={steps['step-4'].explain}
        />
      </StepWrap>
      <StepWrap index={5} onDemote={onDemote}>
        <StepFiveFinalCard
          title={steps['step-5'].title}
          output={steps['step-5'].output}
          explain={steps['step-5'].explain}
        />
      </StepWrap>
    </Box>
  );
}

export default ModelBuildPanel;
