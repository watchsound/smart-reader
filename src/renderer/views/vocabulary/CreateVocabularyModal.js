import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  TextField,
  Button,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Chip,
  CircularProgress,
  InputAdornment,
  Tooltip,
  Divider,
  Alert,
  LinearProgress,
} from '@mui/material';
import { useTheme, alpha, styled } from '@mui/material/styles';

// Icons
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SaveIcon from '@mui/icons-material/Save';
import SchoolIcon from '@mui/icons-material/School';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import LinkIcon from '@mui/icons-material/Link';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import ListIcon from '@mui/icons-material/List';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

import customStorage from '../../store/customStorage';

// Styled components
const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: theme.shape.borderRadius * 1.5,
    transition: 'all 0.2s ease',
    '&:hover': {
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: alpha(theme.palette.primary.main, 0.5),
      },
    },
    '&.Mui-focused': {
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: theme.palette.primary.main,
        borderWidth: 2,
      },
    },
  },
  '& .MuiInputLabel-root': {
    fontWeight: 500,
  },
}));

const GradientButton = styled(Button)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
  color: '#fff',
  fontWeight: 600,
  padding: '10px 24px',
  borderRadius: theme.shape.borderRadius * 1.5,
  textTransform: 'none',
  boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.4)}`,
  transition: 'all 0.2s ease',
  '&:hover': {
    background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
    boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.5)}`,
    transform: 'translateY(-2px)',
  },
  '&:disabled': {
    background: theme.palette.action.disabledBackground,
    color: theme.palette.action.disabled,
    boxShadow: 'none',
  },
}));

const FieldLabel = ({ icon: Icon, label, color }) => {
  const theme = useTheme();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
      <Box
        sx={{
          width: 24,
          height: 24,
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: alpha(color || theme.palette.primary.main, 0.1),
        }}
      >
        <Icon sx={{ fontSize: 14, color: color || theme.palette.primary.main }} />
      </Box>
      <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.secondary }}>
        {label}
      </Typography>
    </Box>
  );
};

function TabPanel({ children, value, index, ...other }) {
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

function CreateVocabularyModal({ word, open, onClose, onSave }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [tabValue, setTabValue] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Single word state
  const [vocabulary, setVocabulary] = useState({
    name: '',
    definition: '',
    relatedWord: '',
    example: '',
  });

  // Bulk import state
  const [bulkText, setBulkText] = useState('');
  const [bulkWords, setBulkWords] = useState([]);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  useEffect(() => {
    if (open) {
      setVocabulary({
        name: word || '',
        definition: '',
        relatedWord: '',
        example: '',
      });
      setError('');
      setBulkText('');
      setBulkWords([]);
      setBulkProgress({ current: 0, total: 0 });
    }
  }, [open, word]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setVocabulary({ ...vocabulary, [name]: value });
    setError('');
  };

  const handleGenerateWithAI = async () => {
    if (!vocabulary.name.trim()) {
      setError('Please enter a word first');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const result = await customStorage.addToVocabulary(vocabulary.name.trim());
      if (result) {
        setVocabulary({
          name: result.word || vocabulary.name,
          definition: result.definition || '',
          relatedWord: result.relatedWords || '',
          example: result.example || '',
        });
      } else {
        setError('Could not generate definition. Please check your AI settings.');
      }
    } catch (err) {
      setError('Failed to generate definition. Please try again.');
      console.error('AI generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!vocabulary.name.trim()) {
      setError('Word name is required');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(vocabulary);
      onClose();
    } catch (err) {
      setError('Failed to save vocabulary');
    } finally {
      setIsSaving(false);
    }
  };

  const parseBulkText = (text) => {
    const lines = text.split('\n').filter((line) => line.trim());
    const words = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // Check for key:value or key=value format
      const colonIndex = trimmed.indexOf(':');
      const equalsIndex = trimmed.indexOf('=');
      const separatorIndex = colonIndex > 0 ? colonIndex : equalsIndex;

      if (separatorIndex > 0) {
        const word = trimmed.substring(0, separatorIndex).trim();
        const definition = trimmed.substring(separatorIndex + 1).trim();
        if (word) {
          words.push({ word, definition, status: definition ? 'ready' : 'pending' });
        }
      } else {
        // Just a word, no definition
        words.push({ word: trimmed, definition: '', status: 'pending' });
      }
    });

    return words;
  };

  const handleBulkTextChange = (e) => {
    const text = e.target.value;
    setBulkText(text);
    setBulkWords(parseBulkText(text));
  };

  const handleBulkGenerate = async () => {
    const pendingWords = bulkWords.filter((w) => w.status === 'pending');
    if (pendingWords.length === 0) return;

    setIsBulkProcessing(true);
    setBulkProgress({ current: 0, total: pendingWords.length });

    const updatedWords = [...bulkWords];

    for (let i = 0; i < pendingWords.length; i++) {
      const wordObj = pendingWords[i];
      const index = updatedWords.findIndex((w) => w.word === wordObj.word);

      try {
        const result = await customStorage.addToVocabulary(wordObj.word);
        if (result) {
          updatedWords[index] = {
            ...updatedWords[index],
            definition: result.definition || '',
            relatedWord: result.relatedWords || '',
            example: result.example || '',
            status: 'ready',
          };
        } else {
          updatedWords[index] = { ...updatedWords[index], status: 'error' };
        }
      } catch (err) {
        updatedWords[index] = { ...updatedWords[index], status: 'error' };
      }

      setBulkProgress({ current: i + 1, total: pendingWords.length });
      setBulkWords([...updatedWords]);
    }

    setIsBulkProcessing(false);
  };

  const handleBulkSave = async () => {
    const readyWords = bulkWords.filter((w) => w.status === 'ready' && w.definition);
    if (readyWords.length === 0) {
      setError('No words ready to save. Generate definitions first.');
      return;
    }

    setIsSaving(true);
    let savedCount = 0;

    for (const wordObj of readyWords) {
      try {
        await onSave({
          name: wordObj.word,
          definition: wordObj.definition,
          relatedWord: wordObj.relatedWord || '',
          example: wordObj.example || '',
        });
        savedCount++;
      } catch (err) {
        console.error('Failed to save word:', wordObj.word, err);
      }
    }

    setIsSaving(false);

    if (savedCount > 0) {
      onClose();
    } else {
      setError('Failed to save words. Please try again.');
    }
  };

  const pendingCount = bulkWords.filter((w) => w.status === 'pending').length;
  const readyCount = bulkWords.filter((w) => w.status === 'ready').length;
  const errorCount = bulkWords.filter((w) => w.status === 'error').length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
          px: 3,
          py: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: alpha('#fff', 0.2),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SchoolIcon sx={{ color: '#fff', fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
              Add Vocabulary
            </Typography>
            <Typography variant="caption" sx={{ color: alpha('#fff', 0.8) }}>
              Build your word collection
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: '#fff' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Tabs */}
      <Box sx={{ px: 3, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Tabs
          value={tabValue}
          onChange={(e, v) => setTabValue(v)}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 600,
              minHeight: 48,
              color: theme.palette.text.secondary,
              '&:hover': {
                color: theme.palette.primary.main,
                backgroundColor: alpha(theme.palette.primary.main, 0.08),
              },
              '&.Mui-selected': {
                color: theme.palette.primary.main,
              },
            },
            '& .MuiTabs-indicator': {
              backgroundColor: theme.palette.primary.main,
            },
          }}
        >
          <Tab
            icon={<AddIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Single Word"
          />
          <Tab
            icon={<ListIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Bulk Import"
          />
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {/* Single Word Tab */}
        <TabPanel value={tabValue} index={0}>
          {/* Word Input with AI Generate */}
          <Box sx={{ mb: 3 }}>
            <FieldLabel icon={SchoolIcon} label="Word" color={theme.palette.primary.main} />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <StyledTextField
                autoFocus
                name="name"
                placeholder="Enter a word..."
                fullWidth
                value={vocabulary.name}
                onChange={handleChange}
                InputProps={{
                  endAdornment: vocabulary.name && !vocabulary.definition && (
                    <InputAdornment position="end">
                      <Tooltip title="Generate with AI">
                        <span>
                          <IconButton
                            onClick={handleGenerateWithAI}
                            disabled={isGenerating}
                            sx={{
                              color: theme.palette.primary.main,
                              '&:hover': {
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                              },
                            }}
                          >
                            {isGenerating ? (
                              <CircularProgress size={20} />
                            ) : (
                              <AutoAwesomeIcon />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </InputAdornment>
                  ),
                }}
              />
              <GradientButton
                onClick={handleGenerateWithAI}
                disabled={isGenerating || !vocabulary.name.trim()}
                startIcon={isGenerating ? <CircularProgress size={16} color="inherit" /> : <AutoAwesomeIcon />}
              >
                {isGenerating ? 'Generating...' : 'AI Generate'}
              </GradientButton>
            </Box>
          </Box>

          {/* Definition */}
          <Box sx={{ mb: 3 }}>
            <FieldLabel icon={LightbulbIcon} label="Definition" color={theme.palette.success.main} />
            <StyledTextField
              name="definition"
              placeholder="Enter or generate definition..."
              fullWidth
              multiline
              rows={3}
              value={vocabulary.definition}
              onChange={handleChange}
            />
          </Box>

          {/* Related Words & Example in a row */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Box sx={{ flex: 1 }}>
              <FieldLabel icon={LinkIcon} label="Related Words" color={theme.palette.info.main} />
              <StyledTextField
                name="relatedWord"
                placeholder="Etymology, synonyms..."
                fullWidth
                value={vocabulary.relatedWord}
                onChange={handleChange}
              />
            </Box>
          </Box>

          <Box sx={{ mb: 3 }}>
            <FieldLabel icon={FormatQuoteIcon} label="Example Sentence" color={theme.palette.warning.main} />
            <StyledTextField
              name="example"
              placeholder="Use the word in a sentence..."
              fullWidth
              multiline
              rows={2}
              value={vocabulary.example}
              onChange={handleChange}
            />
          </Box>

          {/* Save Button */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
            <Button onClick={onClose} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <GradientButton
              onClick={handleSave}
              disabled={isSaving || !vocabulary.name.trim()}
              startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            >
              {isSaving ? 'Saving...' : 'Save Word'}
            </GradientButton>
          </Box>
        </TabPanel>

        {/* Bulk Import Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ mb: 3 }}>
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
              <Typography variant="body2" color="text.secondary" component="span">
                Enter multiple words, one per line. You can optionally include definitions using
              </Typography>
              <Chip label="word: definition" size="small" />
              <Typography variant="body2" color="text.secondary" component="span">
                or
              </Typography>
              <Chip label="word = definition" size="small" />
              <Typography variant="body2" color="text.secondary" component="span">
                format.
              </Typography>
            </Box>

            <StyledTextField
              multiline
              rows={8}
              fullWidth
              placeholder={`Enter words here, for example:
ephemeral
ubiquitous: present everywhere
serendipity = finding something good by chance
ameliorate
...`}
              value={bulkText}
              onChange={handleBulkTextChange}
            />
          </Box>

          {/* Word Stats */}
          {bulkWords.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                <Chip
                  label={`${bulkWords.length} words parsed`}
                  size="small"
                  sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }}
                />
                {pendingCount > 0 && (
                  <Chip
                    icon={<AutoAwesomeIcon sx={{ fontSize: '14px !important' }} />}
                    label={`${pendingCount} need AI generation`}
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                )}
                {readyCount > 0 && (
                  <Chip
                    icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                    label={`${readyCount} ready`}
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                )}
                {errorCount > 0 && (
                  <Chip
                    icon={<ErrorOutlineIcon sx={{ fontSize: '14px !important' }} />}
                    label={`${errorCount} failed`}
                    size="small"
                    color="error"
                    variant="outlined"
                  />
                )}
              </Box>

              {/* Progress bar during processing */}
              {isBulkProcessing && (
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Generating definitions...
                    </Typography>
                    <Typography variant="caption" color="primary">
                      {bulkProgress.current} / {bulkProgress.total}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(bulkProgress.current / bulkProgress.total) * 100}
                    sx={{ borderRadius: 1 }}
                  />
                </Box>
              )}

              {/* Word list preview */}
              <Box
                sx={{
                  maxHeight: 200,
                  overflowY: 'auto',
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 2,
                  p: 1,
                }}
              >
                {bulkWords.map((w, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      py: 0.5,
                      px: 1,
                      borderRadius: 1,
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.05),
                      },
                    }}
                  >
                    {w.status === 'ready' && (
                      <CheckCircleIcon sx={{ fontSize: 16, color: theme.palette.success.main }} />
                    )}
                    {w.status === 'pending' && (
                      <AutoAwesomeIcon sx={{ fontSize: 16, color: theme.palette.warning.main }} />
                    )}
                    {w.status === 'error' && (
                      <ErrorOutlineIcon sx={{ fontSize: 16, color: theme.palette.error.main }} />
                    )}
                    <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 100 }}>
                      {w.word}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {w.definition || (w.status === 'pending' ? 'Needs AI generation' : 'Failed')}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
            <Button onClick={onClose} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            {pendingCount > 0 && (
              <Button
                variant="outlined"
                onClick={handleBulkGenerate}
                disabled={isBulkProcessing}
                startIcon={isBulkProcessing ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
                sx={{ textTransform: 'none' }}
              >
                {isBulkProcessing ? 'Generating...' : `Generate ${pendingCount} Definitions`}
              </Button>
            )}
            <GradientButton
              onClick={handleBulkSave}
              disabled={isSaving || readyCount === 0}
              startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            >
              {isSaving ? 'Saving...' : `Save ${readyCount} Words`}
            </GradientButton>
          </Box>
        </TabPanel>
      </DialogContent>
    </Dialog>
  );
}

export default CreateVocabularyModal;
