/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import React from 'react';
import {
  Box,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';

/**
    "step-4" :{"
       "title" : "选择相应英语翻译的基本结构",
       "scaffold-options":
         [
         "The second floor has books",
         "There are books on the second floor."
         ],
       "best-scaffold" : "There are books on the second floor.",
       "explain" : "'there are' is commonly used for the existence of something at a location. "
    },
 */
function StepFourSentenceScaffoldCard({
  title,
  scaffoldOptions,
  explain,
}) {
  const theme = useTheme();
  const [selectedOption, setSelectedOption] = React.useState(0);

  // Auto-select best option (usually the last one or marked as best)
  React.useEffect(() => {
    if (scaffoldOptions && scaffoldOptions.length > 0) {
      setSelectedOption(scaffoldOptions.length - 1);
    }
  }, [scaffoldOptions]);

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
            bgcolor: alpha(theme.palette.warning.main, 0.1),
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.warning.main }}>
            3
          </Typography>
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            {title || 'Sentence Scaffolds'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Choose the best translation structure
          </Typography>
        </Box>
      </Box>

      {/* Scaffold Options */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
        {scaffoldOptions.map((sentence, index) => {
          const isSelected = index === selectedOption;
          const isRecommended = index === scaffoldOptions.length - 1;

          return (
            <Box
              key={index}
              onClick={() => setSelectedOption(index)}
              sx={{
                p: 2,
                borderRadius: 2,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                bgcolor: isSelected
                  ? alpha(theme.palette.success.main, 0.08)
                  : alpha(theme.palette.background.default, 0.5),
                border: `2px solid ${
                  isSelected
                    ? theme.palette.success.main
                    : alpha(theme.palette.divider, 0.1)
                }`,
                '&:hover': {
                  bgcolor: isSelected
                    ? alpha(theme.palette.success.main, 0.12)
                    : alpha(theme.palette.primary.main, 0.04),
                  borderColor: isSelected
                    ? theme.palette.success.main
                    : alpha(theme.palette.primary.main, 0.3),
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                {/* Selection indicator */}
                <Box
                  sx={{
                    mt: 0.25,
                    flexShrink: 0,
                  }}
                >
                  {isSelected ? (
                    <CheckCircleIcon
                      sx={{ fontSize: 22, color: theme.palette.success.main }}
                    />
                  ) : (
                    <RadioButtonUncheckedIcon
                      sx={{ fontSize: 22, color: theme.palette.text.disabled }}
                    />
                  )}
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: theme.palette.text.disabled,
                        fontWeight: 600,
                      }}
                    >
                      Option {String.fromCharCode(65 + index)}
                    </Typography>
                    {isRecommended && (
                      <Typography
                        variant="caption"
                        sx={{
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                          bgcolor: alpha(theme.palette.success.main, 0.1),
                          color: theme.palette.success.main,
                          fontWeight: 600,
                          fontSize: '0.65rem',
                        }}
                      >
                        RECOMMENDED
                      </Typography>
                    )}
                  </Box>
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: isSelected ? 600 : 400,
                      color: isSelected
                        ? theme.palette.text.primary
                        : theme.palette.text.secondary,
                      fontStyle: 'italic',
                    }}
                  >
                    "{sentence}"
                  </Typography>
                </Box>
              </Box>
            </Box>
          );
        })}
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

export default StepFourSentenceScaffoldCard;
