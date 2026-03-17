/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import CelebrationIcon from '@mui/icons-material/Celebration';

/**
    "step-5" :{
       "description" : "从句子的基本结构扩展为完整句子",
       "output" : "There are many books on the second floor of the library.",
        "explain" : "",
    },
 */
function StepFiveFinalCard({
  title,
  output,
  explain,
}) {
  const theme = useTheme();
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSpeak = () => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(output);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

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
            bgcolor: alpha(theme.palette.success.main, 0.1),
          }}
        >
          <CheckCircleIcon sx={{ fontSize: 20, color: theme.palette.success.main }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            {title || 'Final Translation'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Complete English sentence
          </Typography>
        </Box>
        <CelebrationIcon sx={{ fontSize: 24, color: theme.palette.warning.main }} />
      </Box>

      {/* Final Output */}
      <Box
        sx={{
          p: 3,
          borderRadius: 3,
          background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.08)}, ${alpha(theme.palette.primary.main, 0.08)})`,
          border: `2px solid ${alpha(theme.palette.success.main, 0.3)}`,
          position: 'relative',
          overflow: 'hidden',
          mb: 2,
        }}
      >
        {/* Decorative elements */}
        <Box
          sx={{
            position: 'absolute',
            top: -20,
            right: -20,
            width: 80,
            height: 80,
            borderRadius: '50%',
            bgcolor: alpha(theme.palette.success.main, 0.1),
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: -30,
            left: -30,
            width: 100,
            height: 100,
            borderRadius: '50%',
            bgcolor: alpha(theme.palette.primary.main, 0.05),
          }}
        />

        {/* Success badge */}
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1.5,
            py: 0.5,
            borderRadius: 2,
            bgcolor: theme.palette.success.main,
            color: '#fff',
            mb: 2,
          }}
        >
          <CheckCircleIcon sx={{ fontSize: 16 }} />
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            TRANSLATION COMPLETE
          </Typography>
        </Box>

        {/* Output text */}
        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            color: theme.palette.text.primary,
            lineHeight: 1.5,
            position: 'relative',
            zIndex: 1,
            mb: 2,
          }}
        >
          {output}
        </Typography>

        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
            <IconButton
              size="small"
              onClick={handleCopy}
              sx={{
                bgcolor: alpha(theme.palette.background.paper, 0.8),
                '&:hover': {
                  bgcolor: theme.palette.background.paper,
                },
              }}
            >
              <ContentCopyIcon
                sx={{
                  fontSize: 18,
                  color: copied ? theme.palette.success.main : theme.palette.text.secondary,
                }}
              />
            </IconButton>
          </Tooltip>
          <Tooltip title="Listen to pronunciation">
            <IconButton
              size="small"
              onClick={handleSpeak}
              sx={{
                bgcolor: alpha(theme.palette.background.paper, 0.8),
                '&:hover': {
                  bgcolor: theme.palette.background.paper,
                },
              }}
            >
              <VolumeUpIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
            </IconButton>
          </Tooltip>
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

export default StepFiveFinalCard;
