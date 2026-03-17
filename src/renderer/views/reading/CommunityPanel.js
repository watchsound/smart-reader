/* eslint-disable react/prop-types */
/* eslint-disable prettier/prettier */
import { useState, useEffect } from 'react';
import { styled, alpha, useTheme } from '@mui/material/styles';
import {
  Box,
  Typography,
  Switch,
  Paper,
  Avatar,
  Chip,
} from '@mui/material';
import axios from 'axios';
import { useSelector, useDispatch } from 'react-redux';
import PeopleIcon from '@mui/icons-material/People';
import CommentIcon from '@mui/icons-material/Comment';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import { communityNoteToggled } from '../../store/reducers/readerSlice';
import customStorage from '../../store/customStorage';

// Professional styled components
const PanelContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: theme.palette.background.default,
}));

const HeaderSection = styled(Box)(({ theme }) => ({
  padding: '16px',
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
}));

const ToggleContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderRadius: 12,
  backgroundColor: alpha(theme.palette.secondary.main, 0.05),
  border: `1px solid ${alpha(theme.palette.secondary.main, 0.15)}`,
  transition: 'all 0.2s ease',
}));

const StatsBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 16px',
  backgroundColor: alpha(theme.palette.secondary.main, 0.03),
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
}));

const ScrollContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowX: 'hidden',
  overflowY: 'auto',
  padding: '12px',
  '&::-webkit-scrollbar': {
    width: 6,
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: alpha(theme.palette.text.primary, 0.15),
    borderRadius: 3,
    '&:hover': {
      backgroundColor: alpha(theme.palette.text.primary, 0.25),
    },
  },
}));

const EmptyState = styled(Box)(() => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 24px',
  textAlign: 'center',
}));

const AnnotationCard = styled(Paper)(({ theme }) => ({
  padding: '14px 16px',
  marginBottom: 10,
  borderRadius: 12,
  border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
  backgroundColor: theme.palette.background.paper,
  transition: 'all 0.2s ease',
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: `0 4px 16px ${alpha(theme.palette.secondary.main, 0.12)}`,
    borderColor: alpha(theme.palette.secondary.main, 0.25),
  },
}));

function CommunityPanel({ idFromServer }) {
  const theme = useTheme();
  const [annotations, setAnnotations] = useState([]);
  const [serverUrl, setServerUrl] = useState('');

  const showCommunityNote = useSelector((state) => state.reader.showCommunityNote);
  const selectedCommunityNote = useSelector((state) => state.reader.selectedCommunityNote);
  const dispatch = useDispatch();

  useEffect(() => {
    if (idFromServer < 0 || !selectedCommunityNote) return;
    async function fetchAnnotations() {
      try {
        const url = await customStorage.getServerUrl();
        setServerUrl(url);
        const response = await axios.get(
          `${url}/api/annotation/byannotationsid?annotationsId=${selectedCommunityNote.id}`
        );
        if (response.ok || response.status === 200) {
          setAnnotations(response.data);
        } else {
          setAnnotations([]);
          console.error('Failed to fetch annotations');
        }
      } catch (error) {
        console.error('Failed to fetch annotation', error);
      }
    }
    fetchAnnotations();
  }, [idFromServer, selectedCommunityNote]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <PanelContainer>
      {/* Header with Toggle */}
      <HeaderSection>
        <ToggleContainer>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {showCommunityNote ? (
              <VisibilityIcon sx={{ fontSize: 20, color: theme.palette.secondary.main }} />
            ) : (
              <VisibilityOffIcon sx={{ fontSize: 20, color: theme.palette.text.secondary }} />
            )}
            <Box>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  color: showCommunityNote
                    ? theme.palette.secondary.main
                    : theme.palette.text.primary,
                }}
              >
                Community Notes
              </Typography>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                {showCommunityNote ? 'Visible on book' : 'Hidden'}
              </Typography>
            </Box>
          </Box>
          <Switch
            checked={showCommunityNote}
            onChange={() => dispatch(communityNoteToggled(!showCommunityNote))}
            color="secondary"
            size="small"
          />
        </ToggleContainer>
      </HeaderSection>

      {/* Stats Bar */}
      {annotations.length > 0 && (
        <StatsBar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CommentIcon sx={{ fontSize: 16, color: theme.palette.secondary.main }} />
            <Typography
              variant="caption"
              sx={{ fontWeight: 600, color: theme.palette.text.secondary }}
            >
              {annotations.length} annotation{annotations.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
          <Chip
            size="small"
            icon={<PeopleIcon sx={{ fontSize: 14 }} />}
            label="Community"
            sx={{
              height: 22,
              fontSize: '0.7rem',
              bgcolor: alpha(theme.palette.secondary.main, 0.1),
              color: theme.palette.secondary.main,
              '& .MuiChip-icon': {
                color: theme.palette.secondary.main,
              },
            }}
          />
        </StatsBar>
      )}

      {/* Annotations List */}
      <ScrollContainer>
        {!showCommunityNote ? (
          <EmptyState>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: alpha(theme.palette.text.secondary, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
              }}
            >
              <VisibilityOffIcon sx={{ fontSize: 28, color: theme.palette.text.secondary }} />
            </Box>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, color: theme.palette.text.primary, mb: 0.5 }}
            >
              Community notes hidden
            </Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
              Toggle above to see community annotations
            </Typography>
          </EmptyState>
        ) : annotations.length === 0 ? (
          <EmptyState>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: alpha(theme.palette.secondary.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
              }}
            >
              <PeopleIcon sx={{ fontSize: 28, color: theme.palette.secondary.main }} />
            </Box>
            <Typography
              variant="body2"
              sx={{ fontWeight: 600, color: theme.palette.text.primary, mb: 0.5 }}
            >
              No community notes
            </Typography>
            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
              Click a highlighted passage to view notes
            </Typography>
          </EmptyState>
        ) : (
          annotations.map((annotation) => (
            <AnnotationCard key={annotation.id} elevation={0}>
              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.primary,
                  lineHeight: 1.6,
                  mb: 1.5,
                }}
              >
                {annotation.content}
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  pt: 1,
                  borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar
                    sx={{ width: 24, height: 24, fontSize: '0.75rem' }}
                    src={`${serverUrl}/avatar/${encodeURIComponent(annotation.author)}`}
                    alt={annotation.author}
                  >
                    {annotation.author?.[0]?.toUpperCase()}
                  </Avatar>
                  <Typography
                    variant="caption"
                    sx={{ fontWeight: 500, color: theme.palette.text.secondary }}
                  >
                    {annotation.author}
                  </Typography>
                </Box>
                <Typography
                  variant="caption"
                  sx={{ color: theme.palette.text.disabled, fontSize: '0.7rem' }}
                >
                  {formatDate(annotation.createTime)}
                </Typography>
              </Box>
            </AnnotationCard>
          ))
        )}
      </ScrollContainer>
    </PanelContainer>
  );
}

export default CommunityPanel;
