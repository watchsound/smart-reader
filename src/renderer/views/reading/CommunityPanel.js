/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react';
import { styled, alpha, useTheme } from '@mui/material/styles';
import { Box, Typography, Switch, Chip } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import PeopleIcon from '@mui/icons-material/People';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import {
  communityNoteToggled,
  communityNoteSelected,
} from '../../store/reducers/readerSlice';
import forumApi from '../../api/forumApi';
import ForumTurnCard from './ForumTurnCard';
import ForumReplyInput from './ForumReplyInput';

const PanelContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  backgroundColor: theme.palette.background.default,
}));

const HeaderSection = styled(Box)(({ theme }) => ({
  padding: '12px 16px',
  backgroundColor: theme.palette.background.paper,
  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
}));

const ScrollContainer = styled(Box)(() => ({
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: '12px',
}));

const EmptyState = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 24px',
  textAlign: 'center',
});

function CommunityPanel() {
  const theme = useTheme();
  const showCommunityNote = useSelector((s) => s.reader.showCommunityNote);
  // selectedCommunityNote is now a Study Forum signal: either a full
  // ForumDiscussion object (Forum Marker click) or { anchor, passageText, ... }
  // to resolve via getOrCreate (floating Discuss button in the reading view).
  const selectedCommunityNote = useSelector(
    (s) => s.reader.selectedCommunityNote,
  );
  const dispatch = useDispatch();
  const [discussion, setDiscussion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [replyPending, setReplyPending] = useState(false);

  useEffect(() => {
    if (!selectedCommunityNote) {
      setDiscussion(null);
      return;
    }
    if (selectedCommunityNote.turns) {
      setDiscussion(selectedCommunityNote);
      return;
    }
    if (!selectedCommunityNote.anchor) return;
    setLoading(true);
    // eslint-disable-next-line promise/catch-or-return
    forumApi
      .getOrCreate(selectedCommunityNote)
      // eslint-disable-next-line promise/always-return
      .then((d) => {
        setDiscussion(d);
        dispatch(communityNoteSelected(d));
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('forum:get-or-create failed', err);
      })
      .finally(() => setLoading(false));
  }, [selectedCommunityNote, dispatch]);

  const handleReply = ({ userContent, addressedTo }) => {
    if (!discussion) return;
    setReplyPending(true);
    // eslint-disable-next-line promise/catch-or-return
    forumApi
      .reply({ discussionId: discussion.id, userContent, addressedTo })
      .then((updated) => setDiscussion(updated))
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('forum:reply failed', err);
      })
      .finally(() => setReplyPending(false));
  };

  return (
    <PanelContainer>
      <HeaderSection>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {showCommunityNote ? <VisibilityIcon /> : <VisibilityOffIcon />}
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Study Forum
            </Typography>
          </Box>
          <Switch
            checked={showCommunityNote}
            onChange={() => dispatch(communityNoteToggled(!showCommunityNote))}
            color="secondary"
            size="small"
          />
        </Box>
        {discussion && discussion.seedCostUsd > 0 && (
          <Chip
            size="small"
            label={`Seed: $${discussion.seedCostUsd.toFixed(4)}`}
            sx={{
              mt: 1,
              height: 20,
              fontFamily: 'monospace',
              fontSize: '0.65rem',
            }}
          />
        )}
      </HeaderSection>

      <ScrollContainer>
        {loading && (
          <EmptyState>
            <Typography variant="body2">Generating discussion…</Typography>
          </EmptyState>
        )}
        {!loading && !discussion && (
          <EmptyState>
            <PeopleIcon
              sx={{
                fontSize: 36,
                color: alpha(theme.palette.text.primary, 0.3),
                mb: 1,
              }}
            />
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Pick a passage and discuss it
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: theme.palette.text.secondary }}
            >
              Select text in the book and choose &ldquo;Discuss&rdquo; to open a
              thread.
            </Typography>
          </EmptyState>
        )}
        {!loading &&
          discussion &&
          discussion.turns.map((turn, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <ForumTurnCard key={`${turn.ts}-${i}`} turn={turn} />
          ))}
      </ScrollContainer>

      {discussion && (
        <ForumReplyInput onSubmit={handleReply} disabled={replyPending} />
      )}
    </PanelContainer>
  );
}

export default CommunityPanel;
