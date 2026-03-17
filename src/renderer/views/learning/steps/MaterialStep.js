/**
 * MaterialStep.js
 *
 * Step 2: Select source material
 * - File upload (CSV, JSON, TXT, Excel)
 * - Select from library books
 * - Select existing vocabulary set
 * - Import from URL
 * - Manual entry
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Button,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  InputAdornment,
  Chip,
  CircularProgress,
  Alert,
  Collapse,
  Divider,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import {
  UploadFile as FileIcon,
  MenuBook as BookIcon,
  Spellcheck as VocabularyIcon,
  Link as UrlIcon,
  Edit as ManualIcon,
  Search as SearchIcon,
  ArrowForward as NextIcon,
  ArrowBack as BackIcon,
  Description as DocIcon,
  TableChart as CsvIcon,
  Code as JsonIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';

import { DOMAIN_COLORS } from '../LearningPlanWizard';

// Styled components
const StepContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  minHeight: 400,
}));

const SourceCard = styled(Card, {
  shouldForwardProp: (prop) => !['selected', 'color'].includes(prop),
})(({ theme, selected, color }) => ({
  border: `2px solid ${selected ? color : 'transparent'}`,
  background: selected
    ? alpha(color, 0.08)
    : theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.02)'
      : 'rgba(0, 0, 0, 0.02)',
  transition: 'all 0.2s ease',
  '&:hover': {
    borderColor: alpha(color, 0.5),
    background: alpha(color, 0.05),
    transform: 'translateY(-2px)',
  },
}));

const SourceIcon = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'color',
})(({ theme, color }) => ({
  width: 40,
  height: 40,
  borderRadius: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: alpha(color, 0.15),
  color: color,
}));

const FileDropZone = styled(Box, {
  shouldForwardProp: (prop) => !['isDragging', 'color'].includes(prop),
})(({ theme, isDragging, color }) => ({
  border: `2px dashed ${isDragging ? color : alpha(theme.palette.divider, 0.3)}`,
  borderRadius: 12,
  padding: theme.spacing(4),
  textAlign: 'center',
  background: isDragging
    ? alpha(color, 0.05)
    : theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.02)'
      : 'rgba(0, 0, 0, 0.02)',
  transition: 'all 0.2s ease',
  cursor: 'pointer',
  '&:hover': {
    borderColor: color,
    background: alpha(color, 0.05),
  },
}));

const NavigationBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: 'auto',
  paddingTop: theme.spacing(3),
}));

// Source types configuration
const SOURCE_TYPES = [
  {
    type: 'file',
    label: 'Import File',
    description: 'CSV, JSON, TXT, or Excel',
    icon: FileIcon,
  },
  {
    type: 'book',
    label: 'From Library',
    description: 'Select a book from your shelf',
    icon: BookIcon,
  },
  {
    type: 'vocabulary_set',
    label: 'Vocabulary Set',
    description: 'Use existing vocabulary cards',
    icon: VocabularyIcon,
  },
  {
    type: 'url',
    label: 'From URL',
    description: 'Import from web resource',
    icon: UrlIcon,
  },
  {
    type: 'manual',
    label: 'Manual Entry',
    description: 'Add items one by one',
    icon: ManualIcon,
  },
];

const FILE_TYPES = {
  csv: { icon: CsvIcon, label: 'CSV', extensions: ['.csv'] },
  json: { icon: JsonIcon, label: 'JSON', extensions: ['.json'] },
  txt: { icon: DocIcon, label: 'Text', extensions: ['.txt'] },
  xlsx: { icon: CsvIcon, label: 'Excel', extensions: ['.xlsx', '.xls'] },
};

function MaterialStep({ data, updateData, onNext, onBack, isValid }) {
  const [isDragging, setIsDragging] = useState(false);
  const [books, setBooks] = useState([]);
  const [vocabularySets, setVocabularySets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get user token from Redux store
  const userInfo = useSelector((state) => state.user?.userInfo);
  const token = userInfo?.token;

  const domainColor = DOMAIN_COLORS[data?.domainType]?.primary || '#666';

  // Load books and vocabulary sets
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Load books from shelf
        const booksResult = await window.electron.ipcRenderer.invoke('book-list', {
          page: 1,
          limit: 50,
          token,
        });
        if (booksResult?.items) {
          setBooks(booksResult.items);
        }

        // Load vocabulary sets
        const vocabResult = await window.electron.ipcRenderer.invoke('vocabulary-get-sets', { token });
        if (vocabResult) {
          setVocabularySets(Array.isArray(vocabResult) ? vocabResult : []);
        }
      } catch (err) {
        console.error('Error loading materials:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [token]);

  const handleSourceTypeSelect = useCallback(
    (sourceType) => {
      updateData({
        sourceType,
        sourceId: null,
        sourceFile: null,
        sourceUrl: '',
      });
      setError(null);
    },
    [updateData]
  );

  const handleFileDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);

      const files = e.dataTransfer?.files || e.target?.files;
      if (files && files.length > 0) {
        const file = files[0];
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

        // Validate file type
        const validExtensions = ['.csv', '.json', '.txt', '.xlsx', '.xls'];
        if (!validExtensions.includes(ext)) {
          setError(`Invalid file type. Supported: ${validExtensions.join(', ')}`);
          return;
        }

        updateData({
          sourceFile: {
            name: file.name,
            path: file.path,
            type: ext.replace('.', ''),
            size: file.size,
          },
        });
        setError(null);
      }
    },
    [updateData]
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleBookSelect = useCallback(
    (book) => {
      updateData({
        sourceId: book.id,
        sourceFile: null,
        selectedBook: book,
      });
    },
    [updateData]
  );

  const handleVocabularySetSelect = useCallback(
    (set) => {
      updateData({
        sourceId: set.id,
        sourceFile: null,
        selectedVocabularySet: set,
      });
    },
    [updateData]
  );

  const handleUrlChange = useCallback(
    (e) => {
      updateData({ sourceUrl: e.target.value });
    },
    [updateData]
  );

  const filteredBooks = books.filter(
    (book) =>
      book.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderSourceContent = () => {
    switch (data.sourceType) {
      case 'file':
        return (
          <Box>
            <input
              type="file"
              id="file-input"
              style={{ display: 'none' }}
              accept=".csv,.json,.txt,.xlsx,.xls"
              onChange={handleFileDrop}
            />
            <FileDropZone
              isDragging={isDragging}
              color={domainColor}
              onDrop={handleFileDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => document.getElementById('file-input').click()}
            >
              {data.sourceFile ? (
                <Box>
                  <CheckIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                  <Typography variant="subtitle1" fontWeight={600}>
                    {data.sourceFile.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {(data.sourceFile.size / 1024).toFixed(1)} KB • Click to change
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <FileIcon sx={{ fontSize: 48, color: domainColor, mb: 1 }} />
                  <Typography variant="subtitle1" fontWeight={600}>
                    Drop file here or click to browse
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Supports CSV, JSON, TXT, Excel (.xlsx)
                  </Typography>
                </Box>
              )}
            </FileDropZone>

            <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'center' }}>
              {Object.entries(FILE_TYPES).map(([key, value]) => {
                const Icon = value.icon;
                return (
                  <Chip
                    key={key}
                    icon={<Icon sx={{ fontSize: 16 }} />}
                    label={value.label}
                    size="small"
                    sx={{ bgcolor: alpha(domainColor, 0.1) }}
                  />
                );
              })}
            </Box>

            {/* Format hints */}
            <Box
              sx={{
                mt: 2,
                p: 1.5,
                borderRadius: 1,
                bgcolor: alpha(domainColor, 0.05),
                border: 1,
                borderColor: alpha(domainColor, 0.1),
              }}
            >
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
                <strong>TXT format:</strong> one item per line
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                component="div"
                sx={{ fontFamily: 'monospace', fontSize: '0.7rem', pl: 1 }}
              >
                word - definition<br />
                word = definition<br />
                word: definition
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1, mb: 0.5 }}>
                <strong>CSV format:</strong> columns for front, back, tags
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1, mb: 0.5 }}>
                <strong>JSON format:</strong> array of {'{'}word, definition{'}'} objects
              </Typography>
            </Box>
          </Box>
        );

      case 'book':
        return (
          <Box>
            <TextField
              fullWidth
              placeholder="Search your library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />

            {isLoading ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : (
              <List
                sx={{
                  maxHeight: 250,
                  overflow: 'auto',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                {filteredBooks.length === 0 ? (
                  <ListItem>
                    <ListItemText
                      primary="No books found"
                      secondary="Add books to your library first"
                    />
                  </ListItem>
                ) : (
                  filteredBooks.map((book) => (
                    <ListItemButton
                      key={book.id}
                      selected={data.sourceId === book.id}
                      onClick={() => handleBookSelect(book)}
                    >
                      <ListItemIcon>
                        <BookIcon sx={{ color: domainColor }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={book.title}
                        secondary={book.author || 'Unknown author'}
                      />
                      {data.sourceId === book.id && (
                        <CheckIcon sx={{ color: 'success.main' }} />
                      )}
                    </ListItemButton>
                  ))
                )}
              </List>
            )}
          </Box>
        );

      case 'vocabulary_set':
        return (
          <Box>
            {isLoading ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={32} />
              </Box>
            ) : (
              <List
                sx={{
                  maxHeight: 250,
                  overflow: 'auto',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                }}
              >
                {vocabularySets.length === 0 ? (
                  <ListItem>
                    <ListItemText
                      primary="No vocabulary sets found"
                      secondary="Create vocabulary cards first"
                    />
                  </ListItem>
                ) : (
                  vocabularySets.map((set) => (
                    <ListItemButton
                      key={set.id}
                      selected={data.sourceId === set.id}
                      onClick={() => handleVocabularySetSelect(set)}
                    >
                      <ListItemIcon>
                        <VocabularyIcon sx={{ color: domainColor }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={set.name || `Set ${set.id}`}
                        secondary={`${set.count || 0} words`}
                      />
                      {data.sourceId === set.id && (
                        <CheckIcon sx={{ color: 'success.main' }} />
                      )}
                    </ListItemButton>
                  ))
                )}
              </List>
            )}
          </Box>
        );

      case 'url':
        return (
          <Box>
            <TextField
              fullWidth
              placeholder="https://example.com/vocabulary-list"
              value={data.sourceUrl}
              onChange={handleUrlChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <UrlIcon sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Supported: Quizlet, Anki Web, or direct links to CSV/JSON files
            </Typography>
          </Box>
        );

      case 'manual':
        return (
          <Box
            sx={{
              p: 3,
              textAlign: 'center',
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: alpha(domainColor, 0.02),
            }}
          >
            <ManualIcon sx={{ fontSize: 48, color: domainColor, mb: 1 }} />
            <Typography variant="subtitle1" fontWeight={600}>
              Manual Entry Mode
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You'll add learning items one by one in the next step.
              <br />
              Perfect for custom content or small sets.
            </Typography>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <StepContainer>
      {/* Source Type Selection */}
      <Box>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
          Where will your learning content come from?
        </Typography>

        <Grid container spacing={2}>
          {SOURCE_TYPES.map((source) => {
            const Icon = source.icon;
            const isSelected = data.sourceType === source.type;

            return (
              <Grid item xs={6} sm={4} md={2.4} key={source.type}>
                <SourceCard selected={isSelected} color={domainColor} elevation={0}>
                  <CardActionArea
                    onClick={() => handleSourceTypeSelect(source.type)}
                    sx={{ p: 1.5, textAlign: 'center' }}
                  >
                    <SourceIcon color={domainColor}>
                      <Icon fontSize="small" />
                    </SourceIcon>
                    <Typography variant="caption" fontWeight={600} display="block">
                      {source.label}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: '0.65rem' }}
                    >
                      {source.description}
                    </Typography>
                  </CardActionArea>
                </SourceCard>
              </Grid>
            );
          })}
        </Grid>
      </Box>

      <Divider />

      {/* Source-specific content */}
      <Collapse in={!!data.sourceType}>
        <Box>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
            {SOURCE_TYPES.find((s) => s.type === data.sourceType)?.label} Configuration
          </Typography>
          {renderSourceContent()}
        </Box>
      </Collapse>

      {/* Error display */}
      <Collapse in={!!error}>
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      </Collapse>

      {/* Navigation */}
      <NavigationBox>
        <Button startIcon={<BackIcon />} onClick={onBack} sx={{ px: 3 }}>
          Back
        </Button>
        <Button
          variant="contained"
          endIcon={<NextIcon />}
          onClick={onNext}
          disabled={!isValid}
          sx={{
            px: 4,
            py: 1,
            borderRadius: 2,
            background: `linear-gradient(135deg, ${domainColor}, ${alpha(domainColor, 0.8)})`,
            '&:hover': {
              background: `linear-gradient(135deg, ${domainColor}, ${domainColor})`,
            },
            '&.Mui-disabled': {
              background: 'rgba(0, 0, 0, 0.12)',
            },
          }}
        >
          Continue
        </Button>
      </NavigationBox>
    </StepContainer>
  );
}

export default MaterialStep;
