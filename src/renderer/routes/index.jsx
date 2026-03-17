import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Paper,
  Skeleton,
} from '@mui/material';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import ChatIcon from '@mui/icons-material/Chat';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import QuizIcon from '@mui/icons-material/Quiz';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import SchoolIcon from '@mui/icons-material/School';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import LanguageIcon from '@mui/icons-material/Language';
import BookmarksIcon from '@mui/icons-material/Bookmarks';

import customStorage from '../store/customStorage';

const StatCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2.5),
  borderRadius: '16px',
  background: '#fff',
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)',
  transition: 'all 0.25s ease',
  border: '1px solid #f0f0f0',
  '&:hover': {
    transform: 'translateY(-3px)',
    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)',
  },
}));

const QuickActionCard = styled(Card)(({ theme }) => ({
  borderRadius: '14px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
  transition: 'all 0.25s ease',
  cursor: 'pointer',
  border: '1px solid #f0f0f0',
  background: '#fff',
  '&:hover': {
    boxShadow: '0 12px 35px rgba(0, 0, 0, 0.12)',
    transform: 'translateY(-4px)',
    borderColor: '#e0e0e0',
    '& .action-icon': {
      transform: 'scale(1.08)',
    },
  },
}));

const IconWrapper = styled(Box)(({ bgcolor }) => ({
  width: 52,
  height: 52,
  borderRadius: '12px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: bgcolor || '#5c6bc0',
  transition: 'transform 0.25s ease',
}));

const WelcomeSection = styled(Box)(({ theme }) => ({
  background: 'linear-gradient(135deg, #4a5568 0%, #2d3748 100%)',
  borderRadius: '20px',
  padding: theme.spacing(4),
  color: '#fff',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '-40%',
    right: '-15%',
    width: '350px',
    height: '350px',
    background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
    borderRadius: '50%',
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: '-25%',
    left: '-8%',
    width: '250px',
    height: '250px',
    background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)',
    borderRadius: '50%',
  },
}));

const colors = {
  primary: '#5c6bc0',
  secondary: '#26a69a',
  accent: '#7e57c2',
  warning: '#ff7043',
  success: '#66bb6a',
  info: '#42a5f5',
};

const quickActions = [
  {
    title: 'Bookshelf',
    description: 'Browse your library',
    icon: LibraryBooksIcon,
    path: '/bookshelf',
    color: colors.primary,
  },
  {
    title: 'AI Assistant',
    description: 'Chat with AI',
    icon: ChatIcon,
    path: '/chat',
    color: colors.info,
  },
  {
    title: 'Browser',
    description: 'Browse the web',
    icon: LanguageIcon,
    path: '/browser',
    color: colors.secondary,
  },
  {
    title: 'Notes',
    description: 'Review your notes',
    icon: TextSnippetIcon,
    path: '/notes',
    color: colors.accent,
  },
  {
    title: 'Vocabulary',
    description: 'Learn new words',
    icon: SchoolIcon,
    path: '/vocabulary',
    color: colors.success,
  },
  {
    title: 'Quiz',
    description: 'Test yourself',
    icon: QuizIcon,
    path: '/quiz',
    color: colors.warning,
  },
];

export default function Index() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    books: 0,
    notes: 0,
    vocabulary: 0,
    streak: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const books = await window.electron?.ipcRenderer?.getBooks?.() || [];
        const notes = await window.electron?.ipcRenderer?.getNotes?.() || [];

        setStats({
          books: Array.isArray(books) ? books.length : 0,
          notes: Array.isArray(notes) ? notes.length : 0,
          vocabulary: 0,
          streak: 7,
        });
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <Box sx={{ minHeight: '100%', width: '100%', bgcolor: '#fafafa', pb: 4 }}>
      <Box sx={{ pt: 3, px: { xs: 2, sm: 3, md: 4 }, width: '100%' }}>
        {/* Welcome Section */}
        <WelcomeSection sx={{ mb: 4 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={8}>
              <Typography variant="h4" fontWeight={600} gutterBottom sx={{ letterSpacing: '-0.5px' }}>
                {getGreeting()}!
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9, mb: 2, fontSize: '1.1rem' }}>
                Welcome to SmartReader - Your AI-Powered Learning Companion
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.75, maxWidth: 550, lineHeight: 1.7 }}>
                Explore your library, take notes, learn vocabulary, and enhance your reading experience with intelligent tools.
              </Typography>
              <Box sx={{ mt: 3, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Chip
                  icon={<LocalFireDepartmentIcon sx={{ fontSize: 18 }} />}
                  label={`${stats.streak} Day Streak`}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.15)',
                    color: '#fff',
                    fontWeight: 500,
                    fontSize: '0.8rem',
                    '& .MuiChip-icon': { color: '#ffb74d' },
                  }}
                />
                <Chip
                  icon={<EmojiEventsIcon sx={{ fontSize: 18 }} />}
                  label="Keep Learning!"
                  size="small"
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.15)',
                    color: '#fff',
                    fontWeight: 500,
                    fontSize: '0.8rem',
                    '& .MuiChip-icon': { color: '#ffd54f' },
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={4} sx={{ textAlign: 'center', display: { xs: 'none', md: 'block' } }}>
              <AutoStoriesIcon sx={{ fontSize: 100, opacity: 0.2 }} />
            </Grid>
          </Grid>
        </WelcomeSection>

        {/* Statistics Cards */}
        <Grid container spacing={2.5} sx={{ mb: 4 }}>
          {[
            { icon: LibraryBooksIcon, value: stats.books, label: 'Books', color: colors.primary },
            { icon: TextSnippetIcon, value: stats.notes, label: 'Notes', color: colors.info },
            { icon: SchoolIcon, value: stats.vocabulary, label: 'Vocabulary', color: colors.success },
            { icon: LocalFireDepartmentIcon, value: stats.streak, label: 'Day Streak', color: colors.warning },
          ].map((stat, index) => (
            <Grid item xs={6} sm={3} key={index}>
              <StatCard>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <IconWrapper bgcolor={stat.color} className="action-icon">
                    <stat.icon sx={{ color: '#fff', fontSize: 24 }} />
                  </IconWrapper>
                  <Box>
                    <Typography variant="h5" fontWeight={700} sx={{ color: '#2d3748' }}>
                      {loading ? <Skeleton width={30} /> : stat.value}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#718096', fontSize: '0.85rem' }}>
                      {stat.label}
                    </Typography>
                  </Box>
                </Box>
              </StatCard>
            </Grid>
          ))}
        </Grid>

        {/* Quick Actions */}
        <Typography variant="h6" fontWeight={600} sx={{ mb: 2, color: '#2d3748' }}>
          Quick Actions
        </Typography>
        <Grid container spacing={2.5} sx={{ mb: 4 }}>
          {quickActions.map((action) => (
            <Grid item xs={6} sm={4} md={2} key={action.title}>
              <QuickActionCard onClick={() => navigate(action.path)}>
                <CardContent sx={{ p: 2.5, textAlign: 'center' }}>
                  <IconWrapper bgcolor={action.color} className="action-icon" sx={{ mx: 'auto', mb: 1.5 }}>
                    <action.icon sx={{ color: '#fff', fontSize: 24 }} />
                  </IconWrapper>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ color: '#2d3748', mb: 0.5 }}>
                    {action.title}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#718096' }}>
                    {action.description}
                  </Typography>
                </CardContent>
              </QuickActionCard>
            </Grid>
          ))}
        </Grid>

        {/* Bottom Section */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, borderRadius: '16px', border: '1px solid #f0f0f0' }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ color: '#2d3748' }}>
                Learning Progress
              </Typography>
              <Box sx={{ mt: 2 }}>
                {[
                  { label: 'Vocabulary Mastery', value: 68, color: colors.primary },
                  { label: 'Reading Goals', value: 45, color: colors.info },
                  { label: 'Quiz Performance', value: 82, color: colors.success },
                ].map((item, index) => (
                  <Box key={index} sx={{ mb: 2.5, '&:last-child': { mb: 0 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                      <Typography variant="body2" sx={{ color: '#718096' }}>
                        {item.label}
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#2d3748' }}>
                        {item.value}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={item.value}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: '#f0f0f0',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 3,
                          bgcolor: item.color,
                        },
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, borderRadius: '16px', border: '1px solid #f0f0f0', height: '100%' }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ color: '#2d3748' }}>
                Tips for Today
              </Typography>
              <Box sx={{ mt: 2 }}>
                {[
                  { icon: AccessTimeIcon, tip: 'Review vocabulary cards due today for better retention.', color: colors.primary },
                  { icon: TrendingUpIcon, tip: 'Try annotating as you read to improve comprehension.', color: colors.info },
                  { icon: SchoolIcon, tip: 'Ask the AI assistant questions about what you read.', color: colors.success },
                ].map((item, index) => (
                  <Box
                    key={index}
                    sx={{
                      p: 1.5,
                      mb: 1.5,
                      borderRadius: '10px',
                      bgcolor: `${item.color}08`,
                      border: `1px solid ${item.color}20`,
                      '&:last-child': { mb: 0 },
                    }}
                  >
                    <Typography variant="body2" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, color: '#4a5568', lineHeight: 1.6 }}>
                      <item.icon sx={{ fontSize: 18, color: item.color, mt: 0.25, flexShrink: 0 }} />
                      {item.tip}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
