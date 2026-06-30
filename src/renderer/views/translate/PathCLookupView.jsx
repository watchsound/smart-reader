import React, { useEffect, useState } from 'react';
import { Box, Typography, IconButton, Tooltip, Chip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import spineApi from '../../api/spineApi';
import {
  getTranslatePrompt,
  getNLPAnnotationPrompt,
} from '../../../commons/utils/AIPrompts';
import { getTokenAndDependencies } from './DependencyUtil';
import DependencyTree from './DependencyTree';
import ModelBuildPanel from './ModelBuildPanel';

const SERIF = `'Source Serif Pro', Georgia, 'Times New Roman', serif`;

function PathCLookupView({ source, language, onDemote }) {
  const theme = useTheme();
  const [steps, setSteps] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDep, setShowDep] = useState(false);
  const [depTokens, setDepTokens] = useState([]);
  const [depEdges, setDepEdges] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!source || !source.trim || source.trim().length === 0) return;
      setLoading(true);
      try {
        const result = await spineApi.generateContentWithJson(
          getTranslatePrompt(source.trim(), language),
          null,
          { label: 'translate-quick' },
        );
        if (!cancelled) setSteps(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [source, language]);

  const fetchDepTree = async () => {
    if (depTokens.length > 0 || !steps?.['step-5']?.output) return;
    const ann = await spineApi.generateContentWithJson(
      getNLPAnnotationPrompt(steps['step-5'].output),
      null,
      { label: 'translate-quick-nlp' },
    );
    if (ann) {
      const { t, d } = getTokenAndDependencies(ann);
      setDepTokens(t);
      setDepEdges(d);
    }
  };

  const headline = steps?.['step-5']?.output;

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      {loading && !headline && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Translating…
        </Typography>
      )}
      {headline && (
        <Box
          sx={{
            p: 3,
            mb: 3,
            borderRadius: '14px',
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            bgcolor: alpha(theme.palette.primary.main, 0.04),
          }}
        >
          <Typography
            data-testid="path-c-headline"
            sx={{
              fontFamily: SERIF,
              fontSize: '22px',
              lineHeight: 1.5,
              color: theme.palette.text.primary,
            }}
          >
            {headline}
          </Typography>
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Tooltip title="Copy">
              <IconButton
                size="small"
                onClick={() =>
                  navigator.clipboard && navigator.clipboard.writeText(headline)
                }
              >
                <ContentCopyIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Chip
              icon={<AccountTreeIcon sx={{ fontSize: 16 }} />}
              label={showDep ? 'Hide parse tree' : 'Parse tree'}
              size="small"
              onClick={() => {
                if (!showDep) fetchDepTree();
                setShowDep(!showDep);
              }}
            />
          </Box>
        </Box>
      )}
      {showDep && depTokens.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            pt: 2,
            pb: 4,
            overflowX: 'auto',
          }}
        >
          <DependencyTree tokens={depTokens} dependencies={depEdges} />
        </Box>
      )}
      {steps && (
        <ModelBuildPanel
          steps={steps}
          originalTokens={[]}
          language={language}
          onDemote={onDemote}
        />
      )}
    </Box>
  );
}

export default PathCLookupView;
