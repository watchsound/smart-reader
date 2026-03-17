/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import React from 'react';
import {
  Box,
  Typography,
  Chip,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

/**
    "step-3" :{
       "description" : "选择句型结构类项",
       "sentence-structure" : "简单句 (Simple Sentence)",
       "explain" : "",
    },
 */
function StepThreeSentenceStructureCard({
  title,
  sentenceStructure,
  explain,
}) {
  const theme = useTheme();

  // Parse structure type for styling
  const getStructureInfo = (structure) => {
    const lowerStructure = (structure || '').toLowerCase();
    if (lowerStructure.includes('simple')) {
      return { label: 'Simple', color: theme.palette.success.main, icon: '○' };
    }
    if (lowerStructure.includes('compound')) {
      return { label: 'Compound', color: theme.palette.warning.main, icon: '○○' };
    }
    if (lowerStructure.includes('complex')) {
      return { label: 'Complex', color: theme.palette.error.main, icon: '◇' };
    }
    return { label: 'Other', color: theme.palette.info.main, icon: '◆' };
  };

  const structureInfo = getStructureInfo(sentenceStructure);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(theme.palette.secondary.main, 0.1),
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.secondary.main }}>
            4
          </Typography>
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            {title || 'Sentence Structure'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Identifying sentence type
          </Typography>
        </Box>
      </Box>

      {/* Structure Display */}
      <Box
        sx={{
          p: 3,
          borderRadius: 3,
          bgcolor: alpha(structureInfo.color, 0.04),
          border: `2px solid ${alpha(structureInfo.color, 0.2)}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          mb: 2,
        }}
      >
        {/* Structure Icon */}
        <Box
          sx={{
            width: 60,
            height: 60,
            borderRadius: '50%',
            bgcolor: alpha(structureInfo.color, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AccountTreeIcon sx={{ fontSize: 32, color: structureInfo.color }} />
        </Box>

        {/* Structure Label */}
        <Box sx={{ textAlign: 'center' }}>
          <Chip
            label={structureInfo.label}
            sx={{
              bgcolor: structureInfo.color,
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.85rem',
              height: 28,
              mb: 1,
            }}
          />
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              color: theme.palette.text.primary,
              textDecoration: 'underline',
              textDecorationStyle: 'wavy',
              textDecorationColor: structureInfo.color,
              textUnderlineOffset: 4,
            }}
          >
            {sentenceStructure}
          </Typography>
        </Box>

        {/* Structure Visualization */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.background.paper, 0.8),
          }}
        >
          <CheckCircleOutlineIcon sx={{ fontSize: 18, color: structureInfo.color }} />
          <Typography variant="body2" color="text.secondary">
            Selected as optimal structure
          </Typography>
        </Box>
      </Box>

      {/* Explanation */}
      {explain && (
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.info.main, 0.04),
            borderLeft: `3px solid ${theme.palette.info.main}`,
          }}
        >
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary, lineHeight: 1.6 }}>
            {explain}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

export default StepThreeSentenceStructureCard;
