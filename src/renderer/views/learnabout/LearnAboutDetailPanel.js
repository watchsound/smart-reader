/* eslint-disable prefer-template */
/* eslint-disable camelcase */
/* eslint-disable no-inner-declarations */
/* eslint-disable consistent-return */
/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Box,
  Card,
  CardContent,
  Container,
  Grid,
  Stack,
  TextField,
  Typography,
  Skeleton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  Snackbar,
  IconButton,
  InputBase,
  CircularProgress,
  Chip,
  Fade,
  Grow,
  Paper,
  Divider,
  LinearProgress,
} from '@mui/material';
import { useTheme, alpha, styled } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useMemo, useEffect, useState, useRef } from 'react';
import { v4 as uuid } from 'uuid';
import SendIcon from '@mui/icons-material/Send';
import SendAndArchiveIcon from '@mui/icons-material/SendAndArchive';
import { useSelector, useDispatch } from 'react-redux';
import Tooltip from '@mui/material/Tooltip';
import ButtonGroup from '@mui/material/ButtonGroup';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import Avatar from '@mui/material/Avatar';
import Checkbox from '@mui/material/Checkbox';
import JSON5 from 'json5';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SearchIcon from '@mui/icons-material/Search';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import SchoolIcon from '@mui/icons-material/School';
import PsychologyIcon from '@mui/icons-material/Psychology';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import LinkIcon from '@mui/icons-material/Link';
import BookmarkAddIcon from '@mui/icons-material/BookmarkAdd';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TurnedInIcon from '@mui/icons-material/TurnedIn';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import customStorage from '../../store/customStorage';
import MessageItem from '../../components/chat/MessageItem';
import parseMarkdownToHtml from '../../components/note/NoteUtil';
import {
  getMessagesByChatId,
  getChatById,
  createMessage,
  updateMessage,
  createChat,
} from '../../api/chatApi';
import SmallButton from '../../components/Button/SmallButton';

import {
  learnAboutHandled,
  messageUpdated,
  messageHandled,
} from '../../store/reducers/chatSlice';
import { stripJsonWrap } from '../../../commons/utils/commonUtil';
import {
  mapToNewJsonSchema,
  createReaderLevelPrompt,
  getMindMapChatHistoryPrompt,
} from '../../../commons/utils/AIPrompts';
import JsonSchemaManager from '../../utils/json/JsonSchemaManager';
import mindMapSchema, { mindMapSchema0 } from '../../utils/json/mindmapSchema';
import parseMindmapToReactFlow, {
  convertToReactFlow,
  convertToReactFlow0,
  removeStartEndSymbolLines,
} from '../../../commons/utils/content/mindmapUtil';
import MyMindMap from '../../components/mindmap';
import { AIProvider, StudyMode } from '../../../commons/model/DataTypes';
import { instanceInRender as aiProviderManager } from '../../../commons/service/AIProviderManager';
import StringPicker from '../../components/Picker/StringPicker';

import scrapeGoogle from '../../components/web-based-search/google-direct-query';
import scrapeBing from '../../components/web-based-search/bing-direct-query';
import { useCreateNoteMutation } from '../../store/api/noteApiSlice';
import { NoteType } from '../../../commons/model/Note';

import {
  site_categories,
  mergeSearchResults,
  semanticMatchWithOllama,
  fetchAndExtractTextFromCache,
  constructContextPrompt,
  getMatchedCategoryAndDomains,
  getClassificationForUI,
} from '../../components/web-based-search/web-query-utils';

import {
  parseJsonFromLLM,
  stripNumberAndDot,
  getTimelinePrompt,
  getNumberedStepsPrompt,
  getFlowchartPrompt,
  getTablePrompt,
  getComparisonChartPrompt,
  getMindMapPrompt,
  queryOllamaWithReturnJson,
  getMatchImagesToTimelinePrompt,
  getMatchImagesToNumberedStepsPrompt,
  getMatchImagesToMindMapPrompt,
  getTapToRevealPrompt,
  getVocabularyPrompt,
  getRelatedTopicsPrompt,
} from '../../components/web-based-search/utils';
import {
  fetchPageHeadless,
  extractImagesFromMetadata,
  extractProminentImages,
  extractFallbackImages,
  combineImages,
  decomposeContent,
  matchImagesToSections,
  extractImageInfo,
  assignImageToSectionsFromHtmlPage,
} from '../../components/web-based-search/web-image-utils';

// Styled Components
const SearchInputContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  backgroundColor: alpha(theme.palette.background.paper, 0.9),
  borderRadius: 24,
  padding: '8px 20px',
  border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
  transition: 'all 0.3s ease',
  boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.1)}`,
  '&:hover': {
    borderColor: alpha(theme.palette.primary.main, 0.4),
    boxShadow: `0 6px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
  },
  '&:focus-within': {
    borderColor: theme.palette.primary.main,
    boxShadow: `0 6px 28px ${alpha(theme.palette.primary.main, 0.2)}`,
  },
}));

const ContentCard = styled(Card)(({ theme }) => ({
  borderRadius: 16,
  border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  boxShadow: 'none',
  transition: 'all 0.2s ease',
  overflow: 'hidden',
  '&:hover': {
    boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.1)}`,
    transform: 'translateY(-2px)',
  },
}));

const SectionHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(2),
}));

const TopicChip = styled(Chip)(({ theme }) => ({
  borderRadius: 20,
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.2)}`,
  },
}));

// Interactive List Component (redesigned)
function InteractiveListCard({ title, items }) {
  const theme = useTheme();
  const [expandedIndex, setExpandedIndex] = useState(-1);
  const [CreateNote] = useCreateNoteMutation();

  const createNoteByItem = async (item) => {
    const { title: itemTitle, content, image } = item;
    let imageId = '';
    if (image) {
      const m = await customStorage.createImage(image);
      imageId = m.id;
    }
    await CreateNote({
      sourceKey: '',
      title: itemTitle,
      cards: [{ text: content || '', html: '', image: imageId, templateId: 0 }],
      chapter: '',
      chapterIndex: -1,
      cfi: '',
      range: '',
      percentage: 0,
      sourceType: NoteType.Note,
      color: '',
      tags: [],
      rate: 0,
      position: [],
      emoji: '',
      highlightOnly: false,
      highlightType: '',
      hasQuiz: false,
    });
  };

  return (
    <ContentCard>
      <CardContent sx={{ p: 0 }}>
        <Box
          sx={{
            p: 2,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.secondary.main, 0.05)})`,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          }}
        >
          <SectionHeader sx={{ mb: 0 }}>
            <LightbulbIcon sx={{ color: theme.palette.warning.main, fontSize: 20 }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
          </SectionHeader>
        </Box>

        <Box sx={{ p: 2 }}>
          {items.map((item, index) => (
            <Box
              key={index}
              sx={{
                mb: 2,
                borderRadius: 2,
                overflow: 'hidden',
                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: alpha(theme.palette.primary.main, 0.3),
                },
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'stretch',
                  cursor: 'pointer',
                }}
                onClick={() => setExpandedIndex(expandedIndex === index ? -1 : index)}
              >
                {/* Thumbnail */}
                {item.image && (
                  <Box
                    sx={{
                      width: 100,
                      minWidth: 100,
                      height: 80,
                      bgcolor: alpha(theme.palette.primary.main, 0.05),
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      component="img"
                      src={item.image}
                      alt=""
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </Box>
                )}

                {/* Content */}
                <Box
                  sx={{
                    flex: 1,
                    p: 1.5,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                      variant="subtitle2"
                      sx={{ fontWeight: 600, flex: 1 }}
                    >
                      {item.title}
                    </Typography>
                    <Tooltip title="Save as note">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          createNoteByItem(item);
                        }}
                        sx={{
                          '&:hover': {
                            color: theme.palette.warning.main,
                          },
                        }}
                      >
                        <BookmarkAddIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    {expandedIndex === index ? (
                      <ExpandLessIcon sx={{ fontSize: 18, color: theme.palette.text.disabled }} />
                    ) : (
                      <ExpandMoreIcon sx={{ fontSize: 18, color: theme.palette.text.disabled }} />
                    )}
                  </Box>
                  {expandedIndex !== index && item.content && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mt: 0.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        fontSize: '0.8rem',
                      }}
                    >
                      {item.content}
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* Expanded content */}
              {expandedIndex === index && item.content && (
                <Fade in>
                  <Box
                    sx={{
                      px: 2,
                      pb: 2,
                      borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                      bgcolor: alpha(theme.palette.background.default, 0.5),
                    }}
                  >
                    <Typography variant="body2" sx={{ pt: 1.5, lineHeight: 1.7 }}>
                      {item.content}
                    </Typography>
                  </Box>
                </Fade>
              )}
            </Box>
          ))}
        </Box>
      </CardContent>
    </ContentCard>
  );
}

// Tap to Reveal Card (redesigned)
function TapToRevealCard({ title, question, answer }) {
  const theme = useTheme();
  const [revealed, setRevealed] = useState(false);

  return (
    <ContentCard
      sx={{
        background: revealed
          ? `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.08)}, ${alpha(theme.palette.primary.main, 0.05)})`
          : theme.palette.background.paper,
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <SectionHeader>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              bgcolor: alpha(theme.palette.warning.main, 0.15),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PsychologyIcon sx={{ fontSize: 18, color: theme.palette.warning.main }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 600 }}>
              THINK & REFLECT
            </Typography>
          </Box>
        </SectionHeader>

        {title && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 1.5, fontStyle: 'italic' }}
          >
            {title}
          </Typography>
        )}

        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          {question}
        </Typography>

        {!revealed ? (
          <Box
            onClick={() => setRevealed(true)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              py: 2,
              px: 3,
              borderRadius: 3,
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.15),
                transform: 'scale(1.02)',
              },
            }}
          >
            <AutoAwesomeIcon sx={{ mr: 1, fontSize: 18, color: theme.palette.primary.main }} />
            <Typography color="primary" sx={{ fontWeight: 600 }}>
              Tap to reveal answer
            </Typography>
          </Box>
        ) : (
          <Grow in>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.success.main, 0.08),
                border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
              }}
            >
              <Typography variant="body1" sx={{ lineHeight: 1.7 }}>
                {answer}
              </Typography>
              <Box
                onClick={() => setRevealed(false)}
                sx={{
                  mt: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  cursor: 'pointer',
                  color: theme.palette.text.disabled,
                  '&:hover': { color: theme.palette.text.secondary },
                }}
              >
                <ArrowBackIcon sx={{ fontSize: 14 }} />
                <Typography variant="caption">Hide answer</Typography>
              </Box>
            </Box>
          </Grow>
        )}
      </CardContent>
    </ContentCard>
  );
}

// Vocabulary Card (redesigned)
function VocabularyCardNew({ word, definition, examples }) {
  const theme = useTheme();
  const [showExamples, setShowExamples] = useState(false);

  const handleSave = async () => {
    await customStorage.createVocabulary({
      word,
      detail: {
        definition: definition || '',
        root: '',
        example: (examples || []).join('\n') || '',
      },
      setId: -1,
      score: 0,
    });
  };

  return (
    <ContentCard>
      <CardContent sx={{ p: 2.5 }}>
        <SectionHeader>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              bgcolor: alpha(theme.palette.info.main, 0.15),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SchoolIcon sx={{ fontSize: 18, color: theme.palette.info.main }} />
          </Box>
          <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 600 }}>
            VOCABULARY
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Save to vocabulary">
            <IconButton size="small" onClick={handleSave}>
              <TurnedInIcon sx={{ fontSize: 18, color: theme.palette.warning.main }} />
            </IconButton>
          </Tooltip>
        </SectionHeader>

        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
          {word}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {definition}
        </Typography>

        {examples && examples.length > 0 && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Box
              onClick={() => setShowExamples(!showExamples)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                py: 0.5,
              }}
            >
              <Typography
                variant="caption"
                color="primary"
                sx={{ fontWeight: 600 }}
              >
                {showExamples ? 'Hide examples' : `Show ${examples.length} example${examples.length > 1 ? 's' : ''}`}
              </Typography>
              {showExamples ? (
                <ExpandLessIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />
              ) : (
                <ExpandMoreIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />
              )}
            </Box>

            {showExamples && (
              <Fade in>
                <Box sx={{ mt: 1.5 }}>
                  {examples.map((ex, i) => (
                    <Box
                      key={i}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 1,
                        mb: 1,
                        p: 1.5,
                        borderRadius: 1.5,
                        bgcolor: alpha(theme.palette.info.main, 0.05),
                      }}
                    >
                      <PlayArrowIcon
                        sx={{ fontSize: 14, mt: 0.3, color: theme.palette.info.main }}
                      />
                      <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                        {ex}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Fade>
            )}
          </>
        )}
      </CardContent>
    </ContentCard>
  );
}

// Related Topics Component (redesigned)
function RelatedTopicsCard({ topics, onTopicClick }) {
  const theme = useTheme();

  return (
    <ContentCard>
      <CardContent sx={{ p: 2.5 }}>
        <SectionHeader>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              bgcolor: alpha(theme.palette.secondary.main, 0.15),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AccountTreeIcon sx={{ fontSize: 18, color: theme.palette.secondary.main }} />
          </Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Related Topics
          </Typography>
        </SectionHeader>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {topics.map((topic, index) => (
            <TopicChip
              key={index}
              label={topic}
              onClick={() => onTopicClick && onTopicClick(topic)}
              sx={{
                bgcolor: alpha(
                  [
                    theme.palette.primary.main,
                    theme.palette.secondary.main,
                    theme.palette.success.main,
                    theme.palette.warning.main,
                    theme.palette.info.main,
                  ][index % 5],
                  0.1,
                ),
                color: [
                  theme.palette.primary.main,
                  theme.palette.secondary.main,
                  theme.palette.success.main,
                  theme.palette.warning.main,
                  theme.palette.info.main,
                ][index % 5],
                border: `1px solid ${alpha(
                  [
                    theme.palette.primary.main,
                    theme.palette.secondary.main,
                    theme.palette.success.main,
                    theme.palette.warning.main,
                    theme.palette.info.main,
                  ][index % 5],
                  0.3,
                )}`,
              }}
            />
          ))}
        </Box>
      </CardContent>
    </ContentCard>
  );
}

// Search Results Card (redesigned)
function SearchResultsCard({ results }) {
  const theme = useTheme();
  const [showAll, setShowAll] = useState(false);
  const displayResults = showAll ? results : results.slice(0, 3);

  if (!results || results.length === 0) return null;

  return (
    <ContentCard>
      <CardContent sx={{ p: 2.5 }}>
        <SectionHeader>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              bgcolor: alpha(theme.palette.text.disabled, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LinkIcon sx={{ fontSize: 18, color: theme.palette.text.disabled }} />
          </Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Sources ({results.length})
          </Typography>
        </SectionHeader>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {displayResults.map((result, index) => (
            <Box
              key={index}
              component="a"
              href={result.link}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.5,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.background.default, 0.5),
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                  transform: 'translateX(4px)',
                },
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 1,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <LinkIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: theme.palette.text.primary,
                  }}
                >
                  {result.title}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.disabled"
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'block',
                  }}
                >
                  {result.link}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>

        {results.length > 3 && (
          <Box
            onClick={() => setShowAll(!showAll)}
            sx={{
              mt: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              cursor: 'pointer',
              color: theme.palette.primary.main,
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              {showAll ? 'Show less' : `Show ${results.length - 3} more`}
            </Typography>
            {showAll ? (
              <ExpandLessIcon sx={{ fontSize: 16 }} />
            ) : (
              <ExpandMoreIcon sx={{ fontSize: 16 }} />
            )}
          </Box>
        )}
      </CardContent>
    </ContentCard>
  );
}

// User Query Chip
function UserQueryChip({ text }) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'flex-end',
        mb: 2,
      }}
    >
      <Chip
        label={text}
        sx={{
          maxWidth: '80%',
          height: 'auto',
          py: 1,
          px: 0.5,
          borderRadius: '18px 18px 4px 18px',
          bgcolor: theme.palette.primary.main,
          color: '#fff',
          fontWeight: 500,
          '& .MuiChip-label': {
            whiteSpace: 'normal',
            display: 'block',
          },
        }}
      />
    </Box>
  );
}

function LearnAboutDetailPanel({ chatId }) {
  const theme = useTheme();
  const matches = useMediaQuery(theme.breakpoints.up('md'));
  const [open, setOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSeverity, setAlertSeverity] = useState('success');

  const [content, setContent] = useState('');
  const [multiline, setMultiline] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [, forceUpdate] = useState();
  const [learnAbout, setLearnAbout] = useState(null);
  const [messages, setMessages] = useState([]);
  const [images, setImages] = useState([]);
  const [metaImages, setMetaImages] = useState([]);
  const [searchedUrlList, setSearchedUrlList] = useState([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [keywordExercisePrompt, setKeywordExercisePrompt] = useState('');
  const [readerLevelPrompt, setReaderLevelPrompt] = useState('');
  const dispatch = useDispatch();

  const componentRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setSize({ width, height });
      }
    });
    if (componentRef.current) {
      resizeObserver.observe(componentRef.current);
    }

    return () => {
      if (componentRef.current) {
        resizeObserver.unobserve(componentRef.current);
      }
    };
  }, []);

  const refresh = () => {
    forceUpdate((s) => !s);
  };

  useEffect(() => {
    async function t() {
      const rl = await customStorage.getReaderLevel();
      setReaderLevelPrompt(createReaderLevelPrompt(rl));
      const sm = (await customStorage.getStudyMode()) || StudyMode.General;
      if (sm === StudyMode.Language) {
        const keywords = await customStorage.getKeyWordList(StudyMode.Language);
        if (keywords && keywords.length > 0) {
          const v = keywords.join('\n');
          const k = ` I'm here as a language expert. In crafting responses, I'll endeavor to incorporate words from the provided list:
            ${v}.
            Expect creativity as I weave these words into my answers. \n `;
          setKeywordExercisePrompt(k);
        }
      }
    }
    t();
  }, []);

  useEffect(() => {
    if (!chatId) return undefined;
    // Race guard: switching chats rapidly fires overlapping fetches; the
    // slow earlier chat's messages can overwrite the faster new chat's.
    let cancelled = false;
    async function t() {
      const ms = await getMessagesByChatId(chatId);
      if (cancelled) return;
      setMessages(ms);
      const ct = await getChatById(chatId);
      if (cancelled) return;
      setLearnAbout(ct);
      dispatch(learnAboutHandled(ct));
    }
    t();
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  // Auto scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const showMessage = (message, severity = 'info') => {
    setAlertMessage(message);
    setAlertSeverity(severity);
    setOpen(true);
  };

  function reset() {
    setMessages([]);
    setContent('');
    setImages([]);
    setLearnAbout(null);
  }

  async function queryLocalData(query) {
    const r = await customStorage.semanticQuery(query, 5, undefined);
    let data = '';
    if (r && r.ids && r.ids.length > 0) {
      for (let i = 0; i < r.ids.length; i++) {
        data += ` ${r.documents[i]}`;
      }
    }
    return data;
  }

  function getFirstNMinusTwoItems(arr) {
    if (!arr) return [];
    const n = arr.length;
    if (n <= 2) {
      return arr;
    }
    return arr.slice(0, n - 2);
  }

  const handleCheckboxChange = (event) => {
    setMultiline(event.target.checked);
  };

  const submit = async (useLocalData) => {
    if (submitting) return;
    let curChatId = chatId;
    if (!learnAbout) {
      const newChat = {
        description: content,
        totalTokens: 0,
        learnAbout: true,
        createdAt: new Date(),
        pinned: false,
        autoDelete: false,
      };
      const c = await createChat(newChat);
      dispatch(learnAboutHandled(c));
      setLearnAbout(c);
      curChatId = c.id;
    }

    try {
      setSubmitting(true);

      let localData = '';
      if (useLocalData) {
        localData = queryLocalData(content);
      }
      const userMessage = await createMessage({
        chatId: curChatId,
        content,
        type: 'prompt',
        role: 'user',
        createdAt: new Date(),
      });
      const messagesCached = [...messages];
      messagesCached.push(userMessage);
      setMessages(messagesCached);
      setContent('');

      // first query against google and bing
      const g1 = await scrapeGoogle(content, 2);
      const b1 = await scrapeBing(content, 2);
      const searchResults = mergeSearchResults(g1, b1);

      // image query
      const urlToHtml = {};
      const imagesCached = [...images];
      const metaImagesCached = [...metaImages];
      const b1p = searchResults.map(async (r) => {
        if (!r || !r.link) return false;
        try {
          const html = await fetchPageHeadless(r.link);
          if (!html) return false;
          urlToHtml[r.link] = html;
          const { combinedImages, metadataImages } = await extractImageInfo(html);
          imagesCached.push(...combinedImages);
          metaImagesCached.push(...metadataImages);
          return true;
        } catch (error) {
          console.log(error);
          return false;
        }
      });
      await Promise.all(b1p);

      // get special sites
      const result = await getMatchedCategoryAndDomains(content);
      if (result.category) {
        async function t(query) {
          const b2 = await scrapeBing(query, 1);
          const g2 = await scrapeGoogle(query, 1);
          const m2 = mergeSearchResults(g2, b2);
          const b2p = m2.map(async (r) => {
            if (!r || !r.link) return false;
            const has = searchResults.some((item) => item.link === r.link);
            if (has) return false;

            try {
              const html = await fetchPageHeadless(r.link);
              if (!html) {
                return false;
              }
              searchResults.push(r);
              urlToHtml[r.link] = html;
              const { combinedImages, metadataImages } = await extractImageInfo(html);
              imagesCached.push(...combinedImages);
              metaImagesCached.push(...metadataImages);
              return true;
            } catch (error) {
              console.log(error);
              return false;
            }
          });
          await Promise.all(b2p);
        }
        const userQuery2 = `${content} site:${result.sites[0]}`;
        await t(userQuery2);
        const userQuery3 = `${content} site:${result.sites[1]}`;
        await t(userQuery3);
      }

      // assign unique id starting from 1 to images
      imagesCached.forEach((image, index) => {
        image.id = index + 1;
      });
      metaImagesCached.forEach((image, index) => {
        image.id = index + 1;
      });

      setImages(imagesCached);
      setMetaImages(metaImagesCached);
      setSearchedUrlList(searchResults);

      const defaultImage = metaImagesCached.length > 0 ? metaImagesCached[0].src : '';

      let imageConcise = imagesCached.map((image) => {
        return {
          id: image.id,
          title: image.title || image.alt || image.context,
        };
      });
      imageConcise = imageConcise.filter(
        (image) => image.title && image.title.length > 0,
      );

      // create report
      let webContents = await fetchAndExtractTextFromCache(urlToHtml);
      const prompt = constructContextPrompt(content, webContents);
      const summarySections = await queryOllamaWithReturnJson(prompt);

      if (summarySections) {
        const sectionsWithImages = await matchImagesToSections(
          imageConcise,
          summarySections.sections,
        );
        const r = { title: summarySections.summary, items: [] };

        const used = [];
        (sectionsWithImages.data || sectionsWithImages).forEach((element) => {
          if (used.includes(element.title)) return;
          used.push(element.title);

          const f = summarySections.sections.find(
            (section) => section.title === element.title,
          );
          let imageSrc = defaultImage;
          if (element.image) {
            const img = imagesCached.find((img) => img.id === element.image.id);
            if (img) {
              imageSrc = img.src;
            }
          }
          r.items.push({
            title: element.title,
            content: f ? f.detail : '',
            image: imageSrc,
          });
        });
        const userMessage2 = await createMessage({
          chatId: curChatId,
          content: JSON.stringify(r),
          type: 'interactiveList',
          role: 'user',
          createdAt: new Date(),
        });
        messagesCached.push(userMessage2);
        setMessages([...messagesCached]);
      }

      // add some tap-to-reveal
      const ttrp = getTapToRevealPrompt(content, webContents);
      const ttrpResponse = await queryOllamaWithReturnJson(ttrp);
      if (ttrpResponse) {
        const ttrps = (ttrpResponse.data || ttrpResponse).map(async (r) => {
          const ttrpMessage = await createMessage({
            chatId: curChatId,
            content: JSON.stringify(r),
            type: 'tap_to_reveal',
            role: 'user',
            createdAt: new Date(),
          });
          messagesCached.push(ttrpMessage);
          setMessages([...messagesCached]);
        });
        await Promise.all(ttrps);
      }

      // add some vocabulary
      if (summarySections) {
        let allText = summarySections.summary + ' ' || '';
        summarySections.sections.forEach((element) => {
          allText += element.title + ' ' + element.detail + ' ';
        });
        const vPrompt = getVocabularyPrompt(allText);
        const vResponse = await queryOllamaWithReturnJson(vPrompt);
        if (vResponse) {
          const vMessage = await createMessage({
            chatId: curChatId,
            content: JSON.stringify(vResponse),
            type: 'vocabulary',
            role: 'user',
            createdAt: new Date(),
          });
          messagesCached.push(vMessage);
          setMessages([...messagesCached]);
        }
      }

      // as ollama is not powerful enough to get mixed data,
      // we use one article instead
      if (!aiProviderManager.isFullSupported()) {
        webContents = [
          webContents.reduce(
            (longest, current) =>
              current.text.length > longest.text.length ? current : longest,
            { url: '', text: '' },
          ),
        ];
      }

      // add mindmap view
      const mindmapPrompt = getMindMapChatHistoryPrompt(webContents[0].text);
      // mindmapPrompt is an array [{role, content}], use sendChatMessage properly
      const mindmapHistory = mindmapPrompt.slice(0, -1);
      const mindmapUserMessage = mindmapPrompt[mindmapPrompt.length - 1]?.content || '';
      const mindmap = await aiProviderManager.sendChatMessage(
        mindmapHistory,
        mindmapUserMessage,
        { maxOutputTokens: 8192 },
      );
      if (mindmap) {
        const mindmapContent = removeStartEndSymbolLines(mindmap);
        const mindmapObj = parseMindmapToReactFlow(mindmapContent);
        const mMessage = await createMessage({
          chatId: curChatId,
          content: JSON.stringify(mindmapObj),
          type: 'mindmap',
          role: 'user',
          createdAt: new Date(),
        });
        messagesCached.push(mMessage);
        setMessages([...messagesCached]);
      }

      // add related topics
      const relatedTopicPrompt = getRelatedTopicsPrompt(content);
      const relatedTopics = await aiProviderManager.sendChatMessage(
        [],
        relatedTopicPrompt,
        { maxOutputTokens: 4096 },
      );
      if (relatedTopics) {
        const vMessage = await createMessage({
          chatId: curChatId,
          content: JSON.stringify(relatedTopics),
          type: 'related_topics',
          role: 'user',
          createdAt: new Date(),
        });
        messagesCached.push(vMessage);
        setMessages([...messagesCached]);
      }

      setSubmitting(false);
    } catch (error) {
      console.log(error);
      if (error.toJSON && error.toJSON().message === 'Network Error') {
        showMessage('No internet connection.');
      }
      const message = error.response?.data?.error?.message;
      if (message) {
        showMessage(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  function isValidJson(str) {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  }

  const onContentChange = (event) => {
    const { value } = event.currentTarget;
    setContent(value);
  };

  const handleRelatedTopicClick = (topic) => {
    setContent(topic);
  };

  return (
    <Box
      ref={componentRef}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        bgcolor: theme.palette.background.default,
        overflow: 'hidden',
      }}
    >
      {/* Header Bar */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: theme.palette.background.paper,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AutoAwesomeIcon sx={{ color: theme.palette.primary.main }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {learnAbout?.description || 'New Exploration'}
            </Typography>
            <Typography variant="caption" color="text.disabled">
              {messages.length > 0 ? `${messages.length} insights generated` : 'Enter a topic to begin'}
            </Typography>
          </Box>
        </Box>
        {learnAbout && (
          <Tooltip title="Start new exploration">
            <IconButton onClick={reset} size="small">
              <CreateNewFolderIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Loading Progress */}
      {submitting && (
        <LinearProgress
          sx={{
            height: 2,
            '& .MuiLinearProgress-bar': {
              background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            },
          }}
        />
      )}

      {/* Content Area */}
      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 3,
          minHeight: 0,
        }}
      >
        <Box sx={{ maxWidth: 800, mx: 'auto', pb: 4 }}>
          {messages.length === 0 && !submitting && (
            <Box
              sx={{
                textAlign: 'center',
                py: 6,
              }}
            >
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  mx: 'auto',
                  mb: 3,
                }}
              >
                <SearchIcon sx={{ fontSize: 40, color: theme.palette.primary.main, opacity: 0.7 }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                What would you like to learn about?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mx: 'auto' }}>
                Enter any topic and I'll gather information, create interactive content, and help you understand it better.
              </Typography>
            </Box>
          )}

          <Stack spacing={3}>
            {messages.map((message, index) => {
              const jsonObj = isValidJson(message.content)
                ? JSON.parse(message.content)
                : message.content;

              switch (message.type) {
                case 'prompt':
                  return <UserQueryChip key={index} text={message.content} />;
                case 'interactiveList':
                  return (
                    <Grow in key={index}>
                      <Box>
                        <InteractiveListCard title={jsonObj.title} items={jsonObj.items} />
                      </Box>
                    </Grow>
                  );
                case 'tap_to_reveal':
                  return (
                    <Grow in key={index}>
                      <Box>
                        <TapToRevealCard
                          title={jsonObj.content}
                          question={jsonObj.question}
                          answer={jsonObj.answer}
                        />
                      </Box>
                    </Grow>
                  );
                case 'vocabulary':
                  return (
                    <Grow in key={index}>
                      <Box>
                        <VocabularyCardNew
                          word={jsonObj.word}
                          definition={jsonObj.definition}
                          examples={jsonObj.examples}
                        />
                      </Box>
                    </Grow>
                  );
                case 'mindmap':
                  return (
                    <Grow in key={index}>
                      <ContentCard>
                        <CardContent sx={{ p: 0 }}>
                          <Box
                            sx={{
                              p: 2,
                              background: `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.08)}, ${alpha(theme.palette.primary.main, 0.05)})`,
                              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                            }}
                          >
                            <SectionHeader sx={{ mb: 0 }}>
                              <AccountTreeIcon sx={{ color: theme.palette.info.main, fontSize: 20 }} />
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                Mind Map
                              </Typography>
                            </SectionHeader>
                          </Box>
                          <Box sx={{ height: 400, p: 1 }}>
                            <MyMindMap
                              keywordMap={jsonObj.keywordMap}
                              descriptionMap={jsonObj.descriptionMap}
                            />
                          </Box>
                        </CardContent>
                      </ContentCard>
                    </Grow>
                  );
                case 'related_topics':
                  return (
                    <Grow in key={index}>
                      <Box>
                        <RelatedTopicsCard
                          topics={jsonObj.suggested_subtopics}
                          onTopicClick={handleRelatedTopicClick}
                        />
                      </Box>
                    </Grow>
                  );
                default:
                  return null;
              }
            })}

            {searchedUrlList.length > 0 && (
              <Grow in>
                <Box>
                  <SearchResultsCard results={searchedUrlList} />
                </Box>
              </Grow>
            )}
          </Stack>
        </Box>
      </Box>

      {/* Input Area */}
      <Box
        sx={{
          p: 2,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          bgcolor: theme.palette.background.paper,
        }}
      >
        <Box sx={{ maxWidth: 700, mx: 'auto' }}>
          <SearchInputContainer>
            <SearchIcon sx={{ color: theme.palette.text.disabled, mr: 1.5, fontSize: 22 }} />
            <InputBase
              fullWidth
              multiline
              maxRows={4}
              disabled={submitting}
              value={content}
              onChange={onContentChange}
              placeholder="Enter a topic to explore..."
              sx={{ fontSize: '1rem' }}
              onKeyDown={async (event) => {
                if (event.code === 'Enter' && !event.shiftKey && !multiline) {
                  event.preventDefault();
                  submit(false);
                }
              }}
            />
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title="Use local knowledge">
                <span>
                  <IconButton
                    onClick={() => submit(true)}
                    disabled={submitting || !content.trim()}
                    sx={{
                      color: theme.palette.text.disabled,
                      '&:hover': {
                        color: theme.palette.primary.main,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                      },
                    }}
                  >
                    <SendAndArchiveIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Explore topic">
                <span>
                  <IconButton
                    onClick={() => submit(false)}
                    disabled={submitting || !content.trim()}
                    sx={{
                      bgcolor: content.trim() ? theme.palette.primary.main : 'transparent',
                      color: content.trim() ? '#fff' : theme.palette.text.disabled,
                      '&:hover': {
                        bgcolor: content.trim()
                          ? theme.palette.primary.dark
                          : alpha(theme.palette.primary.main, 0.1),
                      },
                      '&:disabled': {
                        bgcolor: 'transparent',
                        color: theme.palette.text.disabled,
                      },
                    }}
                  >
                    {submitting ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <SendIcon sx={{ fontSize: 20 }} />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </SearchInputContainer>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              mt: 1.5,
            }}
          >
            <InfoOutlinedIcon sx={{ fontSize: 14, color: theme.palette.text.disabled }} />
            <Typography variant="caption" color="text.disabled">
              Press Enter to search or Shift+Enter for new line
            </Typography>
          </Box>
        </Box>
      </Box>

      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={() => setOpen(false)}
      >
        <Alert
          onClose={() => setOpen(false)}
          severity={alertSeverity}
          sx={{ width: '100%' }}
        >
          {alertMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default LearnAboutDetailPanel;
