import React, { useState, useEffect, useMemo } from 'react';
import { useTheme, alpha, styled } from '@mui/material/styles';
import {
  Box,
  Typography,
  IconButton,
  InputBase,
  Divider,
  Chip,
  Tooltip,
  Badge,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Pagination,
  Fade,
  Paper,
} from '@mui/material';
import { useDispatch } from 'react-redux';

// Icons
import SearchIcon from '@mui/icons-material/Search';
import QuizIcon from '@mui/icons-material/Quiz';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ClearIcon from '@mui/icons-material/Clear';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import RefreshIcon from '@mui/icons-material/Refresh';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import TimerIcon from '@mui/icons-material/Timer';
import SpeedIcon from '@mui/icons-material/Speed';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SchoolIcon from '@mui/icons-material/School';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FilterListIcon from '@mui/icons-material/FilterList';

import customStorage from '../../store/customStorage';
import InstantResultQuiz from '../../components/surveyjs/InstantResultQuiz';
import ScoredQuiz from '../../components/surveyjs/ScoredQuiz';
import { quizToSurveyJs } from '../../components/surveyjs/SurveyUtil';
import { QuizType } from '../../../commons/model/DataTypes';
import { truncString } from '../../../commons/utils/commonUtil';
import { getQuizProblemByQuery } from '../../api/quizApi';
import { quizQueried } from '../../store/reducers/quizSlice';
import { mapToPredefinedColor } from '../../../commons/utils/CommonLangUtil';

// Styled components matching Bookmarks view
const SearchContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  backgroundColor: alpha(theme.palette.text.primary, 0.04),
  borderRadius: theme.shape.borderRadius,
  padding: '4px 12px',
  transition: 'all 0.2s ease',
  border: '1px solid transparent',
  '&:hover': {
    backgroundColor: alpha(theme.palette.text.primary, 0.06),
  },
  '&:focus-within': {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${alpha(theme.palette.primary.main, 0.5)}`,
    boxShadow: `0 0 0 3px ${alpha(theme.palette.primary.main, 0.1)}`,
  },
}));

const SidebarSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
}));

const QuickFilterChip = styled(Chip)(({ theme, selected }) => ({
  height: 28,
  fontSize: '0.75rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  backgroundColor: selected
    ? alpha(theme.palette.primary.main, 0.12)
    : 'transparent',
  border: `1px solid ${selected
    ? theme.palette.primary.main
    : alpha(theme.palette.divider, 0.3)}`,
  color: selected ? theme.palette.primary.main : theme.palette.text.secondary,
  '&:hover': {
    backgroundColor: selected
      ? alpha(theme.palette.primary.main, 0.16)
      : alpha(theme.palette.text.primary, 0.04),
  },
}));

const StatCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'colorAccent',
})(({ theme, colorAccent }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius * 1.5,
  backgroundColor: alpha(colorAccent || theme.palette.primary.main, 0.08),
  border: `1px solid ${alpha(colorAccent || theme.palette.primary.main, 0.15)}`,
  transition: 'all 0.2s ease',
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: alpha(colorAccent || theme.palette.primary.main, 0.12),
    transform: 'translateY(-2px)',
  },
}));

const QuizCard = styled(Box, {
  shouldForwardProp: (prop) => !['isSelected', 'statusColor'].includes(prop),
})(({ theme, isSelected, statusColor }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius * 1.5,
  backgroundColor: isSelected
    ? alpha(theme.palette.primary.main, 0.08)
    : theme.palette.background.paper,
  border: `1px solid ${isSelected
    ? theme.palette.primary.main
    : alpha(theme.palette.divider, 0.1)}`,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
  position: 'relative',
  overflow: 'hidden',
  '&::before': statusColor ? {
    content: '""',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: statusColor,
    borderRadius: '3px 0 0 3px',
  } : {},
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.06),
    borderColor: alpha(theme.palette.primary.main, 0.3),
    transform: 'translateX(4px)',
  },
}));

const ProblemSetCard = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.success.main, 0.08),
  border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
  marginBottom: theme.spacing(0.75),
  transition: 'all 0.15s ease',
  '&:hover': {
    backgroundColor: alpha(theme.palette.success.main, 0.12),
  },
}));

const EmptyState = ({ icon: Icon, title, subtitle, action }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: 400,
        textAlign: 'center',
        px: 4,
      }}
    >
      <Box
        sx={{
          width: 100,
          height: 100,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          mb: 3,
          position: 'relative',
        }}
      >
        <Icon sx={{ fontSize: 50, color: theme.palette.primary.main, opacity: 0.7 }} />
        <Box
          sx={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            border: `2px dashed ${alpha(theme.palette.primary.main, 0.2)}`,
            animation: 'pulse 2s ease-in-out infinite',
            '@keyframes pulse': {
              '0%, 100%': { transform: 'scale(1)', opacity: 1 },
              '50%': { transform: 'scale(1.1)', opacity: 0.5 },
            },
          }}
        />
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: theme.palette.text.primary }}>
        {title}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 360, mb: 3 }}>
        {subtitle}
      </Typography>
      {action}
    </Box>
  );
};

// Difficulty color mapping
const DIFFICULTY_COLORS = {
  easy: { bg: '#E8F5E9', color: '#2E7D32', label: 'Easy' },
  medium: { bg: '#FFF3E0', color: '#E65100', label: 'Medium' },
  hard: { bg: '#FFEBEE', color: '#C62828', label: 'Hard' },
};

function QuizPageView() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const isDark = theme.palette.mode === 'dark';

  // State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [quizProblems, setQuizProblems] = useState([]);
  const [surveyProblems, setSurveyProblems] = useState(null);
  const [quizType, setQuizType] = useState(QuizType.InstantResultQuiz);
  const [quizList, setQuizList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState('all');
  const [stats, setStats] = useState({
    total: 0,
    correct: 0,
    incorrect: 0,
    unanswered: 0,
  });

  // Convert selected problems to survey format
  useEffect(() => {
    if (!quizProblems || quizProblems.length === 0) {
      setSurveyProblems(null);
      return;
    }
    async function convert() {
      const r = await quizToSurveyJs(quizProblems);
      setSurveyProblems(r);
      const qt = await customStorage.getItem('quiz_type');
      setQuizType(qt || QuizType.InstantResultQuiz);
    }
    convert();
  }, [quizProblems]);

  // Load quiz list
  useEffect(() => {
    async function loadQuizzes() {
      const result = await getQuizProblemByQuery({
        query: searchQuery || '',
        page,
        limit,
      });
      const data = result.data || [];
      setQuizList(data);
      setTotal(result.total || 0);
      dispatch(quizQueried(data));

      // Calculate stats
      const correct = data.filter(q => q.correct > 0).length;
      const incorrect = data.filter(q => q.correct < 0).length;
      setStats({
        total: result.total || 0,
        correct,
        incorrect,
        unanswered: (result.total || 0) - correct - incorrect,
      });
    }
    loadQuizzes();
  }, [searchQuery, page, limit, dispatch]);

  // Filtered quiz list
  const filteredQuizzes = useMemo(() => {
    let filtered = [...quizList];
    if (quickFilter === 'correct') {
      filtered = filtered.filter(q => q.correct > 0);
    } else if (quickFilter === 'incorrect') {
      filtered = filtered.filter(q => q.correct < 0);
    } else if (quickFilter === 'unanswered') {
      filtered = filtered.filter(q => q.correct === 0 || q.correct === null);
    }
    return filtered;
  }, [quizList, quickFilter]);

  const handlePageChange = (event, value) => {
    setPage(value);
  };

  const handleAddToProblemSet = (quiz) => {
    if (!quizProblems.find(q => q.id === quiz.id)) {
      setQuizProblems([...quizProblems, quiz]);
    }
  };

  const handleRemoveFromProblemSet = (quizId) => {
    setQuizProblems(quizProblems.filter(q => q.id !== quizId));
  };

  const handleClearProblemSet = () => {
    setQuizProblems([]);
    setSurveyProblems(null);
  };

  const handleAddAllFiltered = () => {
    const newProblems = filteredQuizzes.filter(
      q => !quizProblems.find(p => p.id === q.id)
    );
    setQuizProblems([...quizProblems, ...newProblems]);
  };

  const handleShuffleProblems = () => {
    const shuffled = [...quizProblems].sort(() => Math.random() - 0.5);
    setQuizProblems(shuffled);
  };

  const getStatusColor = (quiz) => {
    if (quiz.correct > 0) return theme.palette.success.main;
    if (quiz.correct < 0) return theme.palette.error.main;
    return null;
  };

  const getStatusIcon = (quiz) => {
    if (quiz.correct > 0) return <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main' }} />;
    if (quiz.correct < 0) return <CancelIcon sx={{ fontSize: 14, color: 'error.main' }} />;
    return <HelpOutlineIcon sx={{ fontSize: 14, color: 'text.disabled' }} />;
  };

  const accuracyRate = stats.total > 0
    ? Math.round((stats.correct / (stats.correct + stats.incorrect || 1)) * 100)
    : 0;

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
          width: sidebarCollapsed ? 0 : 320,
          minWidth: sidebarCollapsed ? 0 : 320,
          height: '100%',
          bgcolor: theme.palette.background.paper,
          borderRight: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.2s ease',
          overflow: 'hidden',
        }}
      >
        {/* Sidebar Header */}
        <SidebarSection sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              }}
            >
              <QuizIcon sx={{ color: '#fff', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Quiz Library
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {stats.total} questions available
              </Typography>
            </Box>
          </Box>

          {/* Search */}
          <SearchContainer>
            <SearchIcon sx={{ color: theme.palette.text.disabled, mr: 1, fontSize: 20 }} />
            <InputBase
              placeholder="Search questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ flex: 1, fontSize: '0.875rem' }}
            />
            {searchQuery && (
              <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ p: 0.25 }}>
                <ClearIcon sx={{ fontSize: 16 }} />
              </IconButton>
            )}
          </SearchContainer>
        </SidebarSection>

        {/* Statistics */}
        <SidebarSection>
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.disabled,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'block',
              mb: 1.5,
            }}
          >
            Performance
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                Accuracy Rate
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: accuracyRate >= 70 ? 'success.main' : accuracyRate >= 40 ? 'warning.main' : 'error.main',
                }}
              >
                {accuracyRate}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={accuracyRate}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                '& .MuiLinearProgress-bar': {
                  borderRadius: 4,
                  background: accuracyRate >= 70
                    ? `linear-gradient(90deg, ${theme.palette.success.light}, ${theme.palette.success.main})`
                    : accuracyRate >= 40
                    ? `linear-gradient(90deg, ${theme.palette.warning.light}, ${theme.palette.warning.main})`
                    : `linear-gradient(90deg, ${theme.palette.error.light}, ${theme.palette.error.main})`,
                },
              }}
            />
          </Box>

          {/* Quick Stats */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <StatCard colorAccent={theme.palette.success.main} sx={{ flex: 1 }}>
              <CheckCircleIcon sx={{ color: theme.palette.success.main, fontSize: 20 }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1 }}>
                  {stats.correct}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Correct
                </Typography>
              </Box>
            </StatCard>
            <StatCard colorAccent={theme.palette.error.main} sx={{ flex: 1 }}>
              <CancelIcon sx={{ color: theme.palette.error.main, fontSize: 20 }} />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1 }}>
                  {stats.incorrect}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Incorrect
                </Typography>
              </Box>
            </StatCard>
          </Box>
        </SidebarSection>

        {/* Quick Filters */}
        <SidebarSection>
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.disabled,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'block',
              mb: 1,
            }}
          >
            Filter
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            <QuickFilterChip
              label="All"
              size="small"
              selected={quickFilter === 'all'}
              onClick={() => setQuickFilter('all')}
            />
            <QuickFilterChip
              icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
              label="Correct"
              size="small"
              selected={quickFilter === 'correct'}
              onClick={() => setQuickFilter('correct')}
            />
            <QuickFilterChip
              icon={<CancelIcon sx={{ fontSize: '14px !important' }} />}
              label="Incorrect"
              size="small"
              selected={quickFilter === 'incorrect'}
              onClick={() => setQuickFilter('incorrect')}
            />
            <QuickFilterChip
              icon={<HelpOutlineIcon sx={{ fontSize: '14px !important' }} />}
              label="Unanswered"
              size="small"
              selected={quickFilter === 'unanswered'}
              onClick={() => setQuickFilter('unanswered')}
            />
          </Box>
        </SidebarSection>

        {/* Question List */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            px: 1.5,
            py: 1,
            '&::-webkit-scrollbar': {
              width: 6,
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              background: alpha(theme.palette.text.primary, 0.1),
              borderRadius: 3,
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, px: 0.5 }}>
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.text.disabled,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Questions ({filteredQuizzes.length})
            </Typography>
            <Tooltip title="Add all to problem set">
              <IconButton size="small" onClick={handleAddAllFiltered}>
                <AddIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>

          {filteredQuizzes.map((quiz) => {
            const isSelected = quizProblems.find(q => q.id === quiz.id);
            const sourceColor = mapToPredefinedColor(`${quiz.sourceKey}`);

            return (
              <QuizCard
                key={quiz.id}
                isSelected={isSelected}
                statusColor={getStatusColor(quiz)}
                onClick={() => handleAddToProblemSet(quiz)}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 500,
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {truncString(quiz.question, 80)}
                    </Typography>
                    {quiz.options?.optionA && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: 'block',
                          mt: 0.5,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        A: {truncString(quiz.options.optionA, 50)}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                    {getStatusIcon(quiz)}
                    {isSelected && (
                      <Chip
                        label="Added"
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.65rem',
                          bgcolor: alpha(theme.palette.success.main, 0.1),
                          color: theme.palette.success.main,
                          '& .MuiChip-label': { px: 0.75 },
                        }}
                      />
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: sourceColor,
                    }}
                  />
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                    {truncString(quiz.sourceKey || 'Unknown source', 30)}
                  </Typography>
                </Box>
              </QuizCard>
            );
          })}
        </Box>

        {/* Pagination */}
        <Box
          sx={{
            p: 1.5,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Pagination
            count={Math.ceil(total / limit)}
            page={page}
            onChange={handlePageChange}
            size="small"
            sx={{
              '& .MuiPaginationItem-root': {
                fontSize: '0.75rem',
                minWidth: 28,
                height: 28,
              },
            }}
          />
        </Box>
      </Box>

      {/* Toggle Sidebar Button */}
      <IconButton
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        sx={{
          position: 'absolute',
          left: sidebarCollapsed ? 8 : 308,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 10,
          width: 24,
          height: 48,
          borderRadius: '0 4px 4px 0',
          bgcolor: theme.palette.background.paper,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderLeft: 'none',
          transition: 'left 0.2s ease',
          '&:hover': {
            bgcolor: alpha(theme.palette.primary.main, 0.08),
          },
        }}
      >
        {sidebarCollapsed ? (
          <ChevronRightIcon sx={{ fontSize: 16 }} />
        ) : (
          <ChevronRightIcon sx={{ fontSize: 16, transform: 'rotate(180deg)' }} />
        )}
      </IconButton>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {quizProblems.length > 0 ? 'Quiz Session' : 'Problem Set Builder'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {quizProblems.length > 0
                  ? `${quizProblems.length} question${quizProblems.length !== 1 ? 's' : ''} in your problem set`
                  : 'Select questions from the sidebar to start'}
              </Typography>
            </Box>
          </Box>

          {quizProblems.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title="Shuffle questions">
                <IconButton
                  onClick={handleShuffleProblems}
                  sx={{
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.12) },
                  }}
                >
                  <ShuffleIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Clear problem set">
                <IconButton
                  onClick={handleClearProblemSet}
                  sx={{
                    bgcolor: alpha(theme.palette.error.main, 0.08),
                    color: theme.palette.error.main,
                    '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.12) },
                  }}
                >
                  <RefreshIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
              <ToggleButtonGroup
                value={quizType}
                exclusive
                onChange={(e, value) => value && setQuizType(value)}
                size="small"
                sx={{
                  ml: 1,
                  '& .MuiToggleButton-root': {
                    border: 'none',
                    borderRadius: 1,
                    px: 1.5,
                    py: 0.5,
                    '&.Mui-selected': {
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.15),
                      },
                    },
                  },
                }}
              >
                <ToggleButton value={QuizType.InstantResultQuiz}>
                  <Tooltip title="Instant feedback mode">
                    <SpeedIcon sx={{ fontSize: 20, mr: 0.5 }} />
                  </Tooltip>
                  Instant
                </ToggleButton>
                <ToggleButton value={QuizType.ScoredQuiz}>
                  <Tooltip title="Scored quiz mode">
                    <EmojiEventsIcon sx={{ fontSize: 20, mr: 0.5 }} />
                  </Tooltip>
                  Scored
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          )}
        </Box>

        {/* Problem Set Preview (when items selected but not started) */}
        {quizProblems.length > 0 && !surveyProblems && (
          <Box sx={{ p: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Problem Set Preview:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {quizProblems.slice(0, 8).map((quiz, index) => (
                <ProblemSetCard key={quiz.id}>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 600, color: theme.palette.success.main }}
                  >
                    Q{index + 1}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {truncString(quiz.question, 30)}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFromProblemSet(quiz.id);
                    }}
                    sx={{ p: 0.25 }}
                  >
                    <RemoveIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </ProblemSetCard>
              ))}
              {quizProblems.length > 8 && (
                <Chip
                  label={`+${quizProblems.length - 8} more`}
                  size="small"
                  sx={{ height: 28, fontSize: '0.75rem' }}
                />
              )}
            </Box>
          </Box>
        )}

        {/* Quiz Content Area */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            '&::-webkit-scrollbar': {
              width: 6,
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              background: alpha(theme.palette.text.primary, 0.1),
              borderRadius: 3,
            },
          }}
        >
          {surveyProblems ? (
            <Fade in>
              <Box sx={{ maxWidth: 900, mx: 'auto', width: '100%' }}>
                {quizType === QuizType.InstantResultQuiz ? (
                  <InstantResultQuiz
                    quizJson={surveyProblems}
                    quizProblems={quizProblems}
                  />
                ) : (
                  <ScoredQuiz
                    quizJson={surveyProblems}
                    quizProblems={quizProblems}
                  />
                )}
              </Box>
            </Fade>
          ) : quizProblems.length === 0 ? (
            <EmptyState
              icon={SchoolIcon}
              title="Build Your Quiz"
              subtitle="Select questions from the sidebar to create a personalized problem set. Click on any question to add it to your quiz."
              action={
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Chip
                    icon={<AutoAwesomeIcon />}
                    label="Browse Questions"
                    onClick={() => setSidebarCollapsed(false)}
                    sx={{
                      height: 36,
                      px: 1,
                      fontWeight: 500,
                      bgcolor: alpha(theme.palette.primary.main, 0.1),
                      color: theme.palette.primary.main,
                      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.15) },
                    }}
                  />
                </Box>
              }
            />
          ) : (
            <EmptyState
              icon={PlayArrowIcon}
              title="Ready to Start!"
              subtitle={`You have ${quizProblems.length} question${quizProblems.length !== 1 ? 's' : ''} in your problem set. The quiz will begin automatically.`}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default QuizPageView;
