/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
} from '@mui/material';
import { useTheme, alpha, styled } from '@mui/material/styles';
import { v4 as uuid } from 'uuid';
import SendIcon from '@mui/icons-material/Send';
import TranslateIcon from '@mui/icons-material/Translate';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

import customStorage from '../../store/customStorage';
import { LanguageModel } from '../../../commons/model/DataTypes';
import LevelSelector from './LevelSelector';
import TranslateHistoryList from './TranslateHistoryList';
import PathADrillView from './PathADrillView';
import PathBParagraphView from './PathBParagraphView';
import PathCLookupView from './PathCLookupView';

const SendButton = styled(IconButton)(({ theme, disabled }) => ({
  width: 48,
  height: 48,
  borderRadius: 12,
  backgroundColor: disabled
    ? alpha(theme.palette.primary.main, 0.1)
    : theme.palette.primary.main,
  color: disabled ? theme.palette.text.disabled : '#fff',
  '&:hover': {
    backgroundColor: disabled
      ? alpha(theme.palette.primary.main, 0.1)
      : theme.palette.primary.dark,
  },
}));

const PLACEHOLDERS = {
  A: {
    Chinese: '短句 — 输入一个中文句子练习翻译...',
    Japanese: '短文を入力してください...',
  },
  B: {
    Chinese: '段落 — 粘贴一整段中文...',
    Japanese: '段落を貼り付けてください...',
  },
  C: {
    Chinese: '输入需要翻译的中文...',
    Japanese: '日本語の文を入力してください...',
  },
};

const PATH_TITLES = {
  A: 'Drill — attempt + compare',
  B: 'Paragraph — compose + compare',
  C: 'Lookup',
};

function TranslateShell() {
  const theme = useTheme();
  const [level, setLevelState] = useState('A');
  const [language, setLanguage] = useState(LanguageModel.Chinese);
  const [content, setContent] = useState('');
  const [submittedSource, setSubmittedSource] = useState(null);
  const [history, setHistory] = useState([]);
  const [alert, setAlert] = useState(null);
  const [toastShown, setToastShown] = useState(false);

  useEffect(() => {
    setLevelState(customStorage.getTranslateLevel());
    setHistory(customStorage.getTranslateHistory());
  }, []);

  const handleLevelChange = (next) => {
    setLevelState(next);
    customStorage.setTranslateLevel(next);
    setSubmittedSource(null); // reset path content on level switch
  };

  const handleHistorySelect = (entry) => {
    setContent(entry.sourceText);
    if (entry.level !== level) handleLevelChange(entry.level);
    setLanguage(
      entry.sourceLanguage === 'Japanese'
        ? LanguageModel.Japanese
        : LanguageModel.Chinese,
    );
  };

  const submit = () => {
    const trimmed = content.trim();
    if (!trimmed) {
      setAlert({
        severity: 'warning',
        message: 'Please enter a sentence to translate',
      });
      return;
    }
    // Auto-mode-switch toast for Path A long inputs
    if (level === 'A' && trimmed.length > 80 && !toastShown) {
      setToastShown(true);
      setAlert({
        severity: 'info',
        message: 'Long input — switch to Paragraph mode?',
        action: { label: 'Switch to B', onClick: () => handleLevelChange('B') },
      });
      return;
    }
    const entry = {
      id: uuid(),
      sourceText: trimmed,
      level,
      sourceLanguage:
        language === LanguageModel.Japanese ? 'Japanese' : 'Chinese',
      timestamp: Date.now(),
    };
    customStorage.appendTranslateHistory(entry);
    setHistory(customStorage.getTranslateHistory());
    setSubmittedSource(trimmed);
  };

  const onContentChange = (e) => setContent(e.currentTarget.value);

  const toggleLanguage = () =>
    setLanguage((p) =>
      p === LanguageModel.Chinese
        ? LanguageModel.Japanese
        : LanguageModel.Chinese,
    );

  const langKey = language === LanguageModel.Japanese ? 'Japanese' : 'Chinese';
  const langLabel =
    language === LanguageModel.Chinese ? '🇨🇳 中文' : '🇯🇵 日本語';

  const handleDemoteFromC = () => {
    handleLevelChange('A');
    // Scaffold pre-reveal is deferred per spec § Open items.
  };

  const charBand = useMemo(() => {
    const n = content.trim().length;
    if (n === 0 || level !== 'A') return null;
    if (n <= 60) return null;
    if (n <= 80)
      return { tone: 'muted', text: `${n} chars · short-sentence drill` };
    return { tone: 'warn', text: `${n} chars · consider Paragraph mode` };
  }, [content, level]);

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100%',
        bgcolor: theme.palette.background.default,
        overflow: 'hidden',
      }}
    >
      {/* Sidebar */}
      <Box
        sx={{
          width: 280,
          minWidth: 280,
          flexShrink: 0,
          bgcolor: theme.palette.background.paper,
          borderRight: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: theme.palette.primary.main,
            }}
          >
            <TranslateIcon sx={{ color: '#fff', fontSize: 22 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Translation
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Step-by-step learning
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            p: 1.5,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          }}
        >
          <Box
            onClick={toggleLanguage}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 1,
              borderRadius: 1,
              cursor: 'pointer',
              bgcolor: alpha(theme.palette.primary.main, 0.08),
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {langLabel}
            </Typography>
            <SwapHorizIcon
              sx={{ fontSize: 18, color: theme.palette.primary.main }}
            />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              🇬🇧 English
            </Typography>
          </Box>
        </Box>
        <Box
          sx={{
            p: 1.5,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          }}
        >
          <LevelSelector level={level} onChange={handleLevelChange} />
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          <TranslateHistoryList
            entries={history}
            onSelect={handleHistorySelect}
          />
        </Box>
      </Box>

      {/* Main */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0, // critical: lets nested flex children actually shrink
        }}
      >
        <Box sx={{ flex: 1, overflowY: 'auto', p: 3, minHeight: 0 }}>
          {submittedSource ? (
            <>
              {level === 'A' && (
                <PathADrillView source={submittedSource} language={language} />
              )}
              {level === 'B' && (
                <PathBParagraphView
                  source={submittedSource}
                  language={language}
                />
              )}
              {level === 'C' && (
                <PathCLookupView
                  source={submittedSource}
                  language={language}
                  onDemote={handleDemoteFromC}
                />
              )}
            </>
          ) : (
            <Box sx={{ textAlign: 'center', pt: 8, opacity: 0.7 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                {PATH_TITLES[level]}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Enter a {langKey === 'Japanese' ? 'Japanese' : 'Chinese'}{' '}
                sentence below.
              </Typography>
            </Box>
          )}
        </Box>
        <Box
          sx={{
            p: 2.5,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            bgcolor: theme.palette.background.paper,
            flexShrink: 0, // anchor: never shrink, never get pushed off-screen
          }}
        >
          <Box
            sx={{
              maxWidth: 900,
              mx: 'auto',
              display: 'flex',
              gap: 2,
              alignItems: 'flex-end',
            }}
          >
            <Box sx={{ flex: 1 }}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                maxRows={level === 'B' ? 8 : 4}
                value={content}
                onChange={onContentChange}
                placeholder={PLACEHOLDERS[level][langKey]}
                variant="outlined"
                onKeyDown={(e) => {
                  if (e.code === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
              {charBand && (
                <Typography
                  variant="caption"
                  sx={{
                    mt: 0.5,
                    display: 'block',
                    color:
                      charBand.tone === 'warn'
                        ? theme.palette.warning.main
                        : theme.palette.text.disabled,
                  }}
                >
                  {charBand.text}
                </Typography>
              )}
            </Box>
            <Tooltip title="Translate">
              <SendButton
                aria-label="Translate"
                onClick={submit}
                disabled={!content.trim()}
              >
                <SendIcon sx={{ fontSize: 22 }} />
              </SendButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      <Snackbar
        open={!!alert}
        autoHideDuration={6000}
        onClose={() => setAlert(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {alert ? (
          <Alert
            severity={alert.severity}
            onClose={() => setAlert(null)}
            action={
              alert.action ? (
                <Typography
                  component="button"
                  type="button"
                  onClick={() => {
                    alert.action.onClick();
                    setAlert(null);
                  }}
                  sx={{
                    color: 'inherit',
                    cursor: 'pointer',
                    fontWeight: 600,
                    border: 'none',
                    bgcolor: 'transparent',
                  }}
                >
                  {alert.action.label}
                </Typography>
              ) : null
            }
          >
            {alert.message}
          </Alert>
        ) : (
          <span />
        )}
      </Snackbar>
    </Box>
  );
}

export default TranslateShell;
