/* eslint-disable react/require-default-props */
/* eslint-disable prettier/prettier */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardMedia from '@mui/material/CardMedia';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import InputAdornment from '@mui/material/InputAdornment';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import { styled, useTheme } from '@mui/material/styles';

// Icons
import CloseIcon from '@mui/icons-material/Close';
import TitleIcon from '@mui/icons-material/Title';
import NotesIcon from '@mui/icons-material/Notes';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SaveIcon from '@mui/icons-material/Save';
import ImageIcon from '@mui/icons-material/Image';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';

import Note, { NoteType, CardType } from '../../../commons/model/Note';
import { useCreateNoteMutation } from '../../store/api/noteApiSlice';
import parseMindmapToReactFlow, {
  removeStartEndSymbolLines,
} from '../../../commons/utils/content/mindmapUtil';
import customStorage from '../../store/customStorage';
import { createImage } from '../../api/booksApi';
import { createQuizProblem } from '../../api/quizApi';
import getSummaryChatHistoryPrompt, {
  getMindMapChatHistoryPrompt,
  getQuizChatHistoryPrompt,
} from '../../../commons/utils/AIPrompts';
import { instanceInRender as aiProviderManager } from '../../../commons/service/AIProviderManager';
import ConceptReviewPanel from '../knowledge/ConceptReviewPanel';
import graphApi from '../../api/graphApi';
import { RichMarkdownEditor, RichMarkdownEditorRef } from '../editor';
import { cardImageOverlapTemplateId as imageTemplateIds } from '../cardsetting/card-templates';
import LayoutOptions from '../../views/notes/LayoutOptions';
import ImageFileInput from '../imageFileInput';

// Styled Components
const DialogContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  maxHeight: '80vh',
  background: theme.palette.mode === 'dark'
    ? 'linear-gradient(135deg, rgba(30, 33, 38, 0.98) 0%, rgba(40, 44, 52, 0.98) 100%)'
    : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 248, 248, 0.98) 100%)',
  backdropFilter: 'blur(20px)',
  borderRadius: '16px',
  overflow: 'hidden',
}));

const DialogHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  background: theme.palette.mode === 'dark'
    ? 'linear-gradient(90deg, rgba(97, 31, 105, 0.3) 0%, rgba(29, 155, 209, 0.2) 100%)'
    : 'linear-gradient(90deg, rgba(97, 31, 105, 0.1) 0%, rgba(29, 155, 209, 0.08) 100%)',
  borderBottom: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
}));

const DialogBody = styled(Box)(({ theme }) => ({
  flex: 1,
  overflow: 'auto',
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
    borderRadius: '3px',
  },
}));

const DialogFooter = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '12px',
  padding: '16px 20px',
  borderTop: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
  background: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    transition: 'all 0.2s ease',
    '&:hover': {
      background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
    },
    '&.Mui-focused': {
      background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#fff',
      boxShadow: `0 0 0 2px ${theme.palette.mode === 'dark' ? 'rgba(29, 155, 209, 0.3)' : 'rgba(29, 155, 209, 0.2)'}`,
    },
    '& fieldset': {
      borderColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    },
  },
  '& .MuiInputLabel-root': {
    fontSize: '14px',
  },
}));

const ActionButton = styled('button')<{ variant?: 'primary' | 'secondary' | 'ai' }>(({ theme, variant = 'secondary' }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '10px 20px',
  borderRadius: '10px',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  border: 'none',
  fontFamily: 'inherit',

  ...(variant === 'primary' && {
    background: 'linear-gradient(135deg, #2eb67d 0%, #1d9bd1 100%)',
    color: '#fff',
    boxShadow: '0 4px 12px rgba(46, 182, 125, 0.3)',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 6px 20px rgba(46, 182, 125, 0.4)',
    },
    '&:disabled': {
      opacity: 0.6,
      cursor: 'not-allowed',
      transform: 'none',
    },
  }),

  ...(variant === 'ai' && {
    background: 'linear-gradient(135deg, #611f69 0%, #4a154b 100%)',
    color: '#fff',
    boxShadow: '0 4px 12px rgba(97, 31, 105, 0.3)',
    '&:hover': {
      transform: 'translateY(-2px)',
      boxShadow: '0 6px 20px rgba(97, 31, 105, 0.4)',
    },
    '&:disabled': {
      opacity: 0.6,
      cursor: 'not-allowed',
      transform: 'none',
    },
  }),

  ...(variant === 'secondary' && {
    background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
    color: theme.palette.mode === 'dark' ? '#e8e8e8' : '#1d1c1d',
    border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
    '&:hover': {
      background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    },
  }),
}));

const ImagePreview = styled(Card)(() => ({
  position: 'relative',
  borderRadius: '12px',
  overflow: 'hidden',
  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.4) 100%)',
    pointerEvents: 'none',
  },
}));

const ImageBadge = styled(Box)(() => ({
  position: 'absolute',
  bottom: '12px',
  left: '12px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  background: 'rgba(0,0,0,0.6)',
  backdropFilter: 'blur(8px)',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '12px',
  fontWeight: 500,
  zIndex: 1,
}));

const ContentPreview = styled(Box)(({ theme }) => ({
  position: 'relative',
  padding: '16px',
  background: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
  borderRadius: '12px',
  border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  maxHeight: '120px',
  overflow: 'auto',
  '&::-webkit-scrollbar': {
    width: '4px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
    borderRadius: '2px',
  },
}));

const SectionLabel = styled(Typography)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '12px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
  marginBottom: '8px',
}));

const TagChip = styled(Chip)(({ theme }) => ({
  height: '26px',
  fontSize: '11px',
  fontWeight: 500,
  background: theme.palette.mode === 'dark' ? 'rgba(29, 155, 209, 0.2)' : 'rgba(29, 155, 209, 0.1)',
  color: '#1d9bd1',
  border: 'none',
  '& .MuiChip-deleteIcon': {
    color: '#1d9bd1',
    fontSize: '16px',
    '&:hover': {
      color: '#e01e5a',
    },
  },
}));

const ProgressContainer = styled(Box)(() => ({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  '& .MuiLinearProgress-root': {
    height: '3px',
    background: 'transparent',
  },
  '& .MuiLinearProgress-bar': {
    background: 'linear-gradient(90deg, #611f69, #1d9bd1)',
  },
}));

function CreateNotePanel({
  sourceType,
  sourceKey,
  content: contentProp,
  imageData,
  cfi,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  url,
  emoji,
  color,
  highlightType,
  dialogHandle,
}: {
  sourceType: string;
  sourceKey: number;
  content: string | { text?: string };
  imageData: string;
  cfi: string;
  url: string;
  emoji: string;
  color: string;
  highlightType: string;
  dialogHandle?: (newNote: Note) => void;
}) {
  // Ensure content is always a string (handle legacy object format from PDF selection)
  const content = typeof contentProp === 'string'
    ? contentProp
    : (contentProp?.text || '');

  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState(false);
  const [alertContent, setAlertContent] = useState('');
  const [alertSeverity, setAlertSeverity] = useState<'error' | 'success'>('error');

  const [summary, setSummary] = useState('');
  const [summaryHtml, setSummaryHtml] = useState('');
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [savedTags, setSavedTags] = useState('');
  const [CreateNote] = useCreateNoteMutation();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_extractedConcepts, setExtractedConcepts] = useState<any>(null);
  const [selectedConceptNodes, setSelectedConceptNodes] = useState<any[]>([]);
  const [selectedConceptEdges, setSelectedConceptEdges] = useState<any[]>([]);
  const [useRichEditor, setUseRichEditor] = useState(true);
  const [imagePosition, setImagePosition] = useState(0);
  const [localImage, setLocalImage] = useState<string | null>(null);
  const editorRef = useRef<RichMarkdownEditorRef>(null);
  const navigate = useNavigate();

  // Get the effective image (prop or locally selected)
  const effectiveImage = localImage || imageData;

  // Handle local image file selection
  const handleImageFileChange = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imageDataUrl = reader.result as string;
      setLocalImage(imageDataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Clear local image
  const handleClearImage = () => {
    setLocalImage(null);
    setImagePosition(0);
  };

  // Handle rich editor content changes
  const handleEditorChange = useCallback((html: string, text: string) => {
    setSummary(text);
    setSummaryHtml(html);
  }, []);

  // Handle clicking on wiki-links in the editor
  const handleLinkClick = useCallback((type: string, id: string) => {
    if (type === 'vocabulary') {
      navigate(`/vocabulary?highlight=${id}`);
    } else if (type === 'note') {
      navigate(`/notes/${id}`);
    } else if (type === 'concept') {
      navigate(`/knowledge?concept=${id}`);
    }
  }, [navigate]);

  // Extract wiki-links from HTML for syncing to knowledge graph
  const extractWikiLinksFromHtml = (html: string) => {
    const links: Array<{
      targetId: string;
      type: string;
      text: string;
      position: number;
      linkType: string;
      context: string;
    }> = [];

    // Parse the HTML to find wiki-link spans
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const wikiLinks = doc.querySelectorAll('[data-wiki-link]');

    wikiLinks.forEach((el, index) => {
      const type = el.getAttribute('data-type') || 'note';
      const id = el.getAttribute('data-id');
      const text = el.textContent?.replace(/\[\[|\]\]/g, '') || '';

      if (id) {
        // Get surrounding context (parent text)
        const parentText = el.parentElement?.textContent || '';
        const context = parentText.substring(0, 100);

        links.push({
          targetId: id,
          type,
          text,
          position: index,
          linkType: 'explicit',
          context,
        });
      }
    });

    return links;
  };

  useEffect(() => {
    async function t() {
      const ts = (await customStorage.getItem('saved_tags')) || [];
      if (ts.length > 0) setSavedTags(ts.join(','));
    }
    t();
  }, []);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const showAlert = (message: string, severity: 'error' | 'success' = 'error') => {
    setAlertContent(message);
    setAlertSeverity(severity);
    setAlert(true);
  };

  const handleConceptsExtracted = (result: any) => {
    setExtractedConcepts(result);
    // Default select all
    setSelectedConceptNodes(result.nodes || []);
    setSelectedConceptEdges(result.edges || []);
  };

  const handleConceptsSave = (nodes: any[], edges: any[]) => {
    setSelectedConceptNodes(nodes);
    setSelectedConceptEdges(edges);
  };

  const saveConceptsToGraph = async (noteId: string) => {
    if (selectedConceptNodes.length === 0) return;

    try {
      const result = await graphApi.aiSaveExtraction(
        selectedConceptNodes,
        selectedConceptEdges,
        noteId,
        'note',
      );
      if (result.saved > 0) {
        console.log(`Saved ${result.saved} concepts, ${result.linked} relationships to graph`);
      }
    } catch (error) {
      console.error('Failed to save concepts to graph:', error);
    }
  };

  const handleCreateManually = async () => {
    let newNote = null;
    try {
      if (!title && !summary && !effectiveImage && !content) {
        showAlert('Please add a title, summary, or content');
        return;
      }
      setSubmitting(true);

      let anImageId = '';
      if (effectiveImage) {
        const r = await createImage(effectiveImage);
        anImageId = r.id;
      }

      let sKey = sourceKey;
      if (sourceType === NoteType.Url) {
        const bookmark = await customStorage.createBookmark(sourceKey);
        if (bookmark) sKey = bookmark.id;
      }

      newNote = {
        sourceKey: sKey,
        title,
        cards: [
          {
            text: summary || '',
            html: useRichEditor ? summaryHtml : '',
            image: anImageId,
            templateId: imagePosition > 0 ? imagePosition : undefined,
          },
          {
            text: content || '',
            html: '',
          },
        ],
        cfi,
        range: '',
        chapter: '',
        chapterIndex: -1,
        percentage: 0,
        sourceType,
        color,
        tags,
        rate: 0,
        position: [],
        emoji,
        highlightOnly: false,
        highlightType,
        hasQuiz: false,
      };

      const n = await CreateNote(newNote);
      newNote = n.data ? n.data : n;

      // Save extracted concepts to knowledge graph
      if (newNote && newNote.id && selectedConceptNodes.length > 0) {
        await saveConceptsToGraph(newNote.id);
      }

      // Sync wiki-links to knowledge graph if using rich editor
      if (useRichEditor && newNote && newNote.id && summaryHtml) {
        try {
          const links = extractWikiLinksFromHtml(summaryHtml);
          if (links.length > 0) {
            // @ts-ignore
            await window.electron?.ipcRenderer?.invoke?.('sync-note-links', [newNote.id, links]);
          }
        } catch (linkError) {
          console.warn('Failed to sync wiki-links:', linkError);
        }
      }

      showAlert('Note created successfully!', 'success');

      setTimeout(() => {
        if (dialogHandle) dialogHandle(newNote);
      }, 500);
    } catch (error: any) {
      if (error.toJSON && error.toJSON().message === 'Network Error') {
        showAlert('No internet connection.');
      }
      const message = error.response?.data?.error?.message;
      if (message) {
        showAlert(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateWithAI = async () => {
    let newNote = null;
    try {
      if (!content || content.length < 50) {
        showAlert('Content must be at least 50 characters for AI processing');
        return;
      }
      setSubmitting(true);

      let summary1 = summary;
      let title1 = title;
      let aiTags: string[] = [];

      if (!summary1 && !title && content) {
        const prompt = getSummaryChatHistoryPrompt(content, savedTags);
        let result = await aiProviderManager.sendChatMessage(prompt, '', {}, true);
        if (!result) result = { title: '', summary: '', keywords: '' };

        summary1 = result.summary;
        title1 = result.title;
        aiTags = result.keywords || [];
      }

      const prompt = getMindMapChatHistoryPrompt(content || summary1);
      const mindmap = await aiProviderManager.sendChatMessage(prompt);
      const mindmapContent = removeStartEndSymbolLines(mindmap);
      const mindmapObj = parseMindmapToReactFlow(mindmapContent);

      let sKey = sourceKey;
      if (sourceType === NoteType.Url) {
        const bookmark = await customStorage.createBookmark(sourceKey);
        if (bookmark) sKey = bookmark.id;
      }

      newNote = {
        sourceKey: sKey,
        title: title1,
        cards: [
          {
            text: summary1 || '',
            html: '',
          },
          {
            text: content || '',
            html: '',
          },
          {
            text: mindmap || '',
            html: '',
            data: mindmapObj,
            type: CardType.MindMap,
          },
        ],
        chapter: '',
        chapterIndex: -1,
        cfi,
        range: '',
        percentage: 0,
        sourceType,
        color,
        tags: [...tags, ...aiTags],
        rate: 0,
        hasQuiz: true,
        position: [],
        emoji,
        highlightOnly: false,
        highlightType,
      };

      const n = await CreateNote(newNote);
      newNote = n.data ? n.data : n;

      const newPrompt = getQuizChatHistoryPrompt(content || summary1);
      const quizJson = await aiProviderManager.sendChatMessage(newPrompt, '', {}, true);

      if (quizJson) {
        for (let i = 0; i < quizJson.quiz.length; i += 1) {
          const quizProblem = quizJson.quiz[i];
          if (quizProblem) {
            quizProblem.sourceKey = newNote.id;
            quizProblem.sourceType = 'note';
            quizProblem.id = uuid();
            quizProblem.correct = false;
            createQuizProblem(quizProblem);
          }
        }
      }

      // Save extracted concepts to knowledge graph
      if (newNote && newNote.id && selectedConceptNodes.length > 0) {
        await saveConceptsToGraph(newNote.id);
      }

      showAlert('Note created with AI enhancements!', 'success');
      setTimeout(() => {
        if (dialogHandle) dialogHandle(newNote);
      }, 500);
    } catch (error: any) {
      if (error.toJSON && error.toJSON().message === 'Network Error') {
        showAlert('No internet connection.');
      }
      const message = error.response?.data?.error?.message;
      if (message) {
        showAlert(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContainer>
      {/* Header */}
      <DialogHeader>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #611f69 0%, #1d9bd1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <NotesIcon sx={{ color: '#fff', fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px', lineHeight: 1.2 }}>
              Create Note
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.6, fontSize: '12px' }}>
              Capture your thoughts and insights
            </Typography>
          </Box>
        </Box>
        <IconButton
          onClick={() => dialogHandle && dialogHandle(null)}
          sx={{
            color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
            '&:hover': {
              background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
            },
          }}
        >
          <CloseIcon />
        </IconButton>
        {submitting && <ProgressContainer><LinearProgress /></ProgressContainer>}
      </DialogHeader>

      {/* Body */}
      <DialogBody>
        {/* Image Section */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <SectionLabel sx={{ mb: 0 }}>
              <ImageIcon sx={{ fontSize: 14 }} />
              Image
            </SectionLabel>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {!effectiveImage && (
                <ImageFileInput onChange={handleImageFileChange} />
              )}
              {effectiveImage && (
                <>
                  <LayoutOptions
                    overlap={imagePosition}
                    onLayoutOptionChanges={(value: number) => setImagePosition(value)}
                  />
                  {localImage && (
                    <Tooltip title="Remove image">
                      <IconButton
                        size="small"
                        onClick={handleClearImage}
                        sx={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </>
              )}
            </Box>
          </Box>
          {effectiveImage ? (
            <ImagePreview elevation={0}>
              <CardMedia
                component="img"
                height="100"
                image={effectiveImage}
                sx={{ objectFit: 'cover' }}
              />
              <ImageBadge>
                <ImageIcon sx={{ fontSize: 14 }} />
                {imagePosition === 0 ? 'No Overlap' :
                  imagePosition === imageTemplateIds[0] ? 'Top Position' :
                  imagePosition === imageTemplateIds[1] ? 'Center Position' :
                  'Bottom Position'}
              </ImageBadge>
            </ImagePreview>
          ) : (
            <Box
              sx={{
                border: `2px dashed ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}`,
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center',
                color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
              }}
            >
              <ImageIcon sx={{ fontSize: 32, mb: 1, opacity: 0.5 }} />
              <Typography variant="body2" sx={{ fontSize: '13px' }}>
                Click the image button above to add an image
              </Typography>
            </Box>
          )}
        </Box>

        {/* Title Input */}
        <Box>
          <SectionLabel>
            <TitleIcon sx={{ fontSize: 14 }} />
            Title
          </SectionLabel>
          <StyledTextField
            fullWidth
            placeholder="Enter a title for your note..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <TitleIcon sx={{ fontSize: 18, opacity: 0.4 }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* Summary Input - Rich Markdown Editor */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <SectionLabel sx={{ mb: 0 }}>
              <EditIcon sx={{ fontSize: 14 }} />
              Note Content
            </SectionLabel>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={useRichEditor}
                  onChange={(e) => setUseRichEditor(e.target.checked)}
                />
              }
              label={<Typography variant="caption">Rich Editor</Typography>}
              sx={{ mr: 0 }}
            />
          </Box>
          {useRichEditor ? (
            <RichMarkdownEditor
              ref={editorRef}
              content={summary}
              onChange={handleEditorChange}
              placeholder="Write your note here... Use [[]] to link to other notes, $...$ for math"
              minHeight={180}
              maxHeight={350}
              readOnly={submitting}
              onLinkClick={handleLinkClick}
            />
          ) : (
            <StyledTextField
              fullWidth
              multiline
              rows={4}
              placeholder="Write a brief summary or your thoughts..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              disabled={submitting}
            />
          )}
        </Box>

        {/* Original Content Preview */}
        {content && (
          <Box>
            <SectionLabel>
              <ContentCopyIcon sx={{ fontSize: 14 }} />
              Original Content
            </SectionLabel>
            <ContentPreview>
              <Typography
                variant="body2"
                sx={{
                  fontSize: '13px',
                  lineHeight: 1.6,
                  color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {content.length > 500 ? `${content.substring(0, 500)}...` : content}
              </Typography>
            </ContentPreview>
          </Box>
        )}

        {/* Knowledge Extraction */}
        {content && content.length >= 50 && (
          <ConceptReviewPanel
            text={content}
            onExtracted={handleConceptsExtracted}
            onSave={handleConceptsSave}
            autoExtract={false}
            compact
          />
        )}

        {/* Tags */}
        <Box>
          <SectionLabel>
            <LocalOfferIcon sx={{ fontSize: 14 }} />
            Tags
          </SectionLabel>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
            {tags.map((tag) => (
              <TagChip
                key={tag}
                label={tag}
                onDelete={() => handleRemoveTag(tag)}
                size="small"
              />
            ))}
          </Box>
          <StyledTextField
            fullWidth
            size="small"
            placeholder="Type a tag and press Enter..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={submitting}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LocalOfferIcon sx={{ fontSize: 16, opacity: 0.4 }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </DialogBody>

      {/* Footer */}
      <DialogFooter>
        <ActionButton
          variant="secondary"
          onClick={() => dialogHandle && dialogHandle(null)}
          disabled={submitting}
        >
          Cancel
        </ActionButton>

        {content && content.length >= 50 && (
          <Tooltip title="AI will generate summary, title, mind map, and quiz questions">
            <ActionButton
              variant="ai"
              onClick={handleCreateWithAI}
              disabled={submitting}
            >
              <AutoAwesomeIcon sx={{ fontSize: 16 }} />
              {submitting ? 'Processing...' : 'Create with AI'}
            </ActionButton>
          </Tooltip>
        )}

        <ActionButton
          variant="primary"
          onClick={handleCreateManually}
          disabled={submitting}
        >
          <SaveIcon sx={{ fontSize: 16 }} />
          {submitting ? 'Saving...' : 'Save Note'}
        </ActionButton>
      </DialogFooter>

      {/* Alert Snackbar */}
      <Snackbar
        open={alert}
        autoHideDuration={4000}
        onClose={() => setAlert(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={alertSeverity}
          onClose={() => setAlert(false)}
          icon={alertSeverity === 'success' ? <CheckCircleIcon /> : undefined}
          sx={{
            borderRadius: '10px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}
        >
          {alertContent}
        </Alert>
      </Snackbar>
    </DialogContainer>
  );
}

export default CreateNotePanel;
