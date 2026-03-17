/* eslint-disable prettier/prettier */
/* eslint-disable react/prop-types */
import React from 'react';
import {
  Box,
  Typography,
  Chip,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import SubjectIcon from '@mui/icons-material/Person';
import VerbIcon from '@mui/icons-material/PlayArrow';
import ObjectIcon from '@mui/icons-material/Category';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import { mapToPredefinedColor } from '../../../commons/utils/CommonLangUtil';
import DependencyTree from './DependencyTree';

/**
 "sub-verb-obj-list: [
          {
            "subject" : {
                "input" : "二楼",
                "english" : "the second floor",
            },
              "verb" : {
                "input" : "有",
                "english" : [ "has", "there are" ],
            },
            "object" : {
                "input" : "书",
                "english" : "books",
            },
          },
        ],
 */

const SVOChip = ({ label, english, type, color }) => {
  const theme = useTheme();

  const typeConfig = {
    subject: {
      icon: <SubjectIcon sx={{ fontSize: 14 }} />,
      color: theme.palette.info.main,
      bgColor: alpha(theme.palette.info.main, 0.1),
    },
    verb: {
      icon: <VerbIcon sx={{ fontSize: 14 }} />,
      color: theme.palette.error.main,
      bgColor: alpha(theme.palette.error.main, 0.1),
    },
    object: {
      icon: <ObjectIcon sx={{ fontSize: 14 }} />,
      color: theme.palette.success.main,
      bgColor: alpha(theme.palette.success.main, 0.1),
    },
  };

  const config = typeConfig[type] || typeConfig.subject;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 1,
          borderRadius: 2,
          bgcolor: color || config.bgColor,
          border: `1px solid ${alpha(config.color, 0.3)}`,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        {config.icon}
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
        {Array.isArray(english) ? (
          english.map((e, i) => (
            <Chip
              key={i}
              label={e}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                bgcolor: alpha(config.color, 0.08),
                color: config.color,
                fontWeight: 500,
              }}
            />
          ))
        ) : (
          <Chip
            label={english}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.7rem',
              bgcolor: alpha(config.color, 0.08),
              color: config.color,
              fontWeight: 500,
            }}
          />
        )}
      </Box>
      <Typography
        variant="caption"
        sx={{
          color: theme.palette.text.disabled,
          textTransform: 'uppercase',
          fontSize: '0.65rem',
          fontWeight: 600,
          letterSpacing: '0.5px',
        }}
      >
        {type}
      </Typography>
    </Box>
  );
};

function StepOneSVOCard({
  originalTokens,
  title,
  subVerbObjList,
  explain,
}) {
  const theme = useTheme();
  const [tokens, setTokens] = React.useState([]);

  function findToken(text) {
    const item = originalTokens.filter((item) => item.text === text);
    return item && item.length > 0 ? item[0] : null;
  }

  React.useEffect(() => {
    const tt = [];
    subVerbObjList.forEach((row) => {
      const { subject, verb, object } = row;
      const t = [];
      let item = findToken(subject.input);
      if (item) {
        t.push({ ...item, tag: subject.english });
      } else {
        t.push({
          index: 0,
          text: subject.input,
          tag: verb.english,
          color: mapToPredefinedColor('NN'),
        });
      }
      item = findToken(verb.input);
      if (item) {
        t.push({ ...item, tag: verb.english });
      } else {
        t.push({
          index: 1,
          text: verb.input,
          tag: verb.english,
          color: mapToPredefinedColor('VB'),
        });
      }
      item = findToken(object.input);
      if (item) {
        t.push({ ...item, tag: object.english });
      } else {
        t.push({
          index: 1,
          text: object.input,
          tag: verb.english,
          color: mapToPredefinedColor('NN'),
        });
      }
      tt.push(t);
    });

    setTokens(tt);
  }, [originalTokens, subVerbObjList]);

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
            bgcolor: alpha(theme.palette.primary.main, 0.1),
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
            1
          </Typography>
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
            {title || 'Subject-Verb-Object Analysis'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Breaking down sentence components
          </Typography>
        </Box>
      </Box>

      {/* SVO Cards */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
        {subVerbObjList.map((row, index) => {
          const { subject, verb, object } = row;
          const subjectToken = findToken(subject.input);
          const verbToken = findToken(verb.input);
          const objectToken = findToken(object.input);

          return (
            <Box
              key={index}
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.background.default, 0.5),
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  flexWrap: 'wrap',
                }}
              >
                <SVOChip
                  label={subject.input}
                  english={subject.english}
                  type="subject"
                  color={subjectToken?.color}
                />
                <ArrowForwardIcon sx={{ color: theme.palette.text.disabled, fontSize: 20 }} />
                <SVOChip
                  label={verb.input}
                  english={verb.english}
                  type="verb"
                  color={verbToken?.color}
                />
                <ArrowForwardIcon sx={{ color: theme.palette.text.disabled, fontSize: 20 }} />
                <SVOChip
                  label={object.input}
                  english={object.english}
                  type="object"
                  color={objectToken?.color}
                />
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Dependency Trees */}
      {tokens.length > 0 && (
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.background.default, 0.3),
            border: `1px dashed ${alpha(theme.palette.divider, 0.2)}`,
            mb: 2,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.disabled,
              textTransform: 'uppercase',
              fontSize: '0.65rem',
              fontWeight: 600,
              letterSpacing: '0.5px',
              display: 'block',
              mb: 1,
            }}
          >
            Token Analysis
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {tokens.map((items, index) => (
              <DependencyTree key={index} tokens={items} dependencies={[]} />
            ))}
          </Box>
        </Box>
      )}

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

export default StepOneSVOCard;
