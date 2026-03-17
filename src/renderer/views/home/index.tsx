import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { styled } from '@mui/material/styles';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  IconButton,
  LinearProgress,
  Chip,
  Avatar,
  Paper,
  Skeleton,
} from '@mui/material';
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks';
import ChatIcon from '@mui/icons-material/Chat';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import QuizIcon from '@mui/icons-material/Quiz';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import SchoolIcon from '@mui/icons-material/School';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';

import customStorage from '../../store/customStorage';
import BookListInServer from './BookListInServer';

const GradientCard = styled(Card)(({ gradient }) => ({
  background: gradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  color: '#fff',
  borderRadius: '16px',
  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.12)',
  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  cursor: 'pointer',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
  },
}));

const StatCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: '16px',
  background: '#fff',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
  transition: 'transform 0.2s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
  },
}));

const QuickActionCard = styled(Card)(({ theme }) => ({
  borderRadius: '12px',
  boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)',
  transition: 'all 0.2s ease',
  cursor: 'pointer',
  '&:hover': {
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
    transform: 'translateY(-2px)',
    '& .action-icon': {
      transform: 'scale(1.1)',
    },
  },
}));

const IconWrapper = styled(Box)(({ bgcolor }) => ({
  width: 56,
  height: 56,
  borderRadius: '14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: bgcolor || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  transition: 'transform 0.2s ease',
}));

const WelcomeSection = styled(Box)(({ theme }) => ({
  background: 'linear-gradient(135deg, #1a237e 0%, #3949ab 50%, #5c6bc0 100%)',
  borderRadius: '24px',
  padding: theme.spacing(4),
  color: '#fff',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '-50%',
    right: '-20%',
    width: '400px',
    height: '400px',
    background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
    borderRadius: '50%',
  },
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: '-30%',
    left: '-10%',
    width: '300px',
    height: '300px',
    background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
    borderRadius: '50%',
  },
}));

const gradients = {
  purple: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  blue: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  orange: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  green: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
  pink: 'linear-gradient(135deg, #ee9ca7 0%, #ffdde1 100%)',
  indigo: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
};

const quickActions = [
  {
    title: 'Bookshelf',
    description: 'Browse your library',
    icon: LibraryBooksIcon,
    path: '/bookshelf',
    color: '#667eea',
    gradient: gradients.purple,
  },
  {
    title: 'AI Assistant',
    description: 'Chat with AI',
    icon: ChatIcon,
    path: '/chat',
    color: '#4facfe',
    gradient: gradients.blue,
  },
  {
    title: 'Notes',
    description: 'Review your notes',
    icon: TextSnippetIcon,
    path: '/notes',
    color: '#f5576c',
    gradient: gradients.orange,
  },
  {
    title: 'Quiz',
    description: 'Test your knowledge',
    icon: QuizIcon,
    path: '/quiz',
    color: '#11998e',
    gradient: gradients.green,
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    books: 0,
    notes: 0,
    vocabulary: 0,
    streak: 0,
  });
  const [serverUrl, setServerUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [recentBooks, setRecentBooks] = useState([]);

  useEffect(() => {
    async function loadData() {
      try {
        const url = await customStorage.getServerUrl();
        setServerUrl(url || '');

        // Load statistics
        const books = await customStorage.getAllBooks?.() || [];
        const notes = await customStorage.getAllNotes?.() || [];
        const vocab = await customStorage.getAllVocabulary?.() || [];

        setStats({
          books: books.length || 0,
          notes: notes.length || 0,
          vocabulary: vocab.length || 0,
          streak: 7, // Placeholder for streak calculation
        });

        setRecentBooks(books.slice(0, 4));
      } catch (error) {
        console.error('Error loading home data:', error);
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
    <Box sx={{ minHeight: '100%', bgcolor: '#f5f7fa', pb: 4 }}>
      <Toaster />
      <Container maxWidth="xl" sx={{ pt: 3 }}>
        {/* Welcome Section */}
        <WelcomeSection sx={{ mb: 4 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={8}>
              <Typography variant="h4" fontWeight={700} gutterBottom>
                {getGreeting()}!
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.9, mb: 2 }}>
                Welcome to SmartReader - Your AI-Powered Learning Companion
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.8, maxWidth: 600 }}>
                Explore your library, take notes, learn vocabulary, and test your knowledge
                with our intelligent tools designed to enhance your reading experience.
              </Typography>
              <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip
                  icon={<LocalFireDepartmentIcon />}
                  label={`${stats.streak} Day Streak`}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.2)',
                    color: '#fff',
                    fontWeight: 600,
                    '& .MuiChip-icon': { color: '#ff9800' },
                  }}
                />
                <Chip
                  icon={<EmojiEventsIcon />}
                  label="Keep Learning!"
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.2)',
                    color: '#fff',
                    fontWeight: 600,
                    '& .MuiChip-icon': { color: '#ffd700' },
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={4} sx={{ textAlign: 'center' }}>
              <AutoStoriesIcon sx={{ fontSize: 120, opacity: 0.3 }} />
            </Grid>
          </Grid>
        </WelcomeSection>

        {/* Statistics Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={6} sm={3}>
            <StatCard>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconWrapper bgcolor={gradients.purple} className="action-icon">
                  <LibraryBooksIcon sx={{ color: '#fff', fontSize: 28 }} />
                </IconWrapper>
                <Box>
                  <Typography variant="h4" fontWeight={700} color="primary">
                    {loading ? <Skeleton width={40} /> : stats.books}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Books
                  </Typography>
                </Box>
              </Box>
            </StatCard>
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconWrapper bgcolor={gradients.blue} className="action-icon">
                  <TextSnippetIcon sx={{ color: '#fff', fontSize: 28 }} />
                </IconWrapper>
                <Box>
                  <Typography variant="h4" fontWeight={700} color="primary">
                    {loading ? <Skeleton width={40} /> : stats.notes}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Notes
                  </Typography>
                </Box>
              </Box>
            </StatCard>
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconWrapper bgcolor={gradients.green} className="action-icon">
                  <SchoolIcon sx={{ color: '#fff', fontSize: 28 }} />
                </IconWrapper>
                <Box>
                  <Typography variant="h4" fontWeight={700} color="primary">
                    {loading ? <Skeleton width={40} /> : stats.vocabulary}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Vocabulary
                  </Typography>
                </Box>
              </Box>
            </StatCard>
          </Grid>
          <Grid item xs={6} sm={3}>
            <StatCard>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconWrapper bgcolor={gradients.orange} className="action-icon">
                  <LocalFireDepartmentIcon sx={{ color: '#fff', fontSize: 28 }} />
                </IconWrapper>
                <Box>
                  <Typography variant="h4" fontWeight={700} color="primary">
                    {loading ? <Skeleton width={40} /> : stats.streak}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Day Streak
                  </Typography>
                </Box>
              </Box>
            </StatCard>
          </Grid>
        </Grid>

        {/* Quick Actions */}
        <Typography variant="h5" fontWeight={600} sx={{ mb: 2 }}>
          Quick Actions
        </Typography>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {quickActions.map((action) => (
            <Grid item xs={6} sm={3} key={action.title}>
              <QuickActionCard onClick={() => navigate(action.path)}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <IconWrapper bgcolor={action.gradient} className="action-icon">
                      <action.icon sx={{ color: '#fff', fontSize: 28 }} />
                    </IconWrapper>
                    <ArrowForwardIcon sx={{ color: 'text.secondary', opacity: 0.5 }} />
                  </Box>
                  <Typography variant="h6" fontWeight={600} gutterBottom>
                    {action.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {action.description}
                  </Typography>
                </CardContent>
              </QuickActionCard>
            </Grid>
          ))}
        </Grid>

        {/* Server Library Section */}
        {serverUrl && (
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h5" fontWeight={600}>
                Library (Server)
              </Typography>
              <Chip
                label="Connected"
                size="small"
                color="success"
                sx={{ fontWeight: 500 }}
              />
            </Box>
            <Paper sx={{ p: 3, borderRadius: '16px' }}>
              <BookListInServer />
            </Paper>
          </Box>
        )}

        {/* Learning Progress Section */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, borderRadius: '16px', height: '100%' }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Learning Progress
              </Typography>
              <Box sx={{ mt: 3 }}>
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Vocabulary Mastery
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      68%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={68}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: 'rgba(102, 126, 234, 0.1)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4,
                        background: gradients.purple,
                      },
                    }}
                  />
                </Box>
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Reading Goals
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      45%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={45}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: 'rgba(79, 172, 254, 0.1)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4,
                        background: gradients.blue,
                      },
                    }}
                  />
                </Box>
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Quiz Performance
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>
                      82%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={82}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: 'rgba(17, 153, 142, 0.1)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4,
                        background: gradients.green,
                      },
                    }}
                  />
                </Box>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, borderRadius: '16px', height: '100%' }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Tips for Today
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Box
                  sx={{
                    p: 2,
                    mb: 2,
                    borderRadius: '12px',
                    bgcolor: 'rgba(102, 126, 234, 0.08)',
                    border: '1px solid rgba(102, 126, 234, 0.2)',
                  }}
                >
                  <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AccessTimeIcon sx={{ fontSize: 18, color: '#667eea' }} />
                    <strong>Spaced Repetition:</strong> Review vocabulary cards due today for better retention.
                  </Typography>
                </Box>
                <Box
                  sx={{
                    p: 2,
                    mb: 2,
                    borderRadius: '12px',
                    bgcolor: 'rgba(79, 172, 254, 0.08)',
                    border: '1px solid rgba(79, 172, 254, 0.2)',
                  }}
                >
                  <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TrendingUpIcon sx={{ fontSize: 18, color: '#4facfe' }} />
                    <strong>Active Reading:</strong> Try annotating as you read to improve comprehension.
                  </Typography>
                </Box>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: '12px',
                    bgcolor: 'rgba(17, 153, 142, 0.08)',
                    border: '1px solid rgba(17, 153, 142, 0.2)',
                  }}
                >
                  <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SchoolIcon sx={{ fontSize: 18, color: '#11998e' }} />
                    <strong>AI Assistant:</strong> Ask questions about what you&apos;re reading for deeper understanding.
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
