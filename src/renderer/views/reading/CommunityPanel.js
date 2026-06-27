/* eslint-disable react/prop-types */
import { useState, useEffect } from 'react';
import { styled, alpha, useTheme } from '@mui/material/styles';
import { Box, Typography, Switch, Chip, Button } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import PeopleIcon from '@mui/icons-material/People';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
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
  // selectedCommunityNote shapes:
  //   - { turns, ... }  (full discussion — Forum Marker click or auto-show match)
  //   - { anchor, passageText, bookTitle, chapterTitle }  (intent from Discuss button)
  //   - null
  const selectedCommunityNote = useSelector(
    (s) => s.reader.selectedCommunityNote,
  );
  const dispatch = useDispatch();
  const [discussion, setDiscussion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  // pendingIntent holds the { anchor, passageText, ... } payload when the user
  // clicked Discuss but the DB had no existing thread — used to show a
  // "Generate discussion" prompt instead of silently spending LLM money.
  const [pendingIntent, setPendingIntent] = useState(null);
  const [replyPending, setReplyPending] = useState(false);

  useEffect(() => {
    if (!selectedCommunityNote) {
      setDiscussion(null);
      setPendingIntent(null);
      return;
    }
    if (selectedCommunityNote.turns) {
      setDiscussion(selectedCommunityNote);
      setPendingIntent(null);
      return;
    }
    if (!selectedCommunityNote.anchor) return;
    // Intent payload — check DB first (free, instant), only prompt the user
    // to spend on a fresh seed if nothing exists yet.
    setLoading(true);
    setDiscussion(null);
    // eslint-disable-next-line promise/catch-or-return
    forumApi
      .find({ anchor: selectedCommunityNote.anchor })
      .then((found) => {
        if (found) {
          setDiscussion(found);
          setPendingIntent(null);
          dispatch(communityNoteSelected(found));
        } else {
          // No existing thread → render the explicit Generate prompt.
          setPendingIntent(selectedCommunityNote);
        }
        return null;
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('forum:find failed', err);
      })
      .finally(() => setLoading(false));
  }, [selectedCommunityNote, dispatch]);

  const handleGenerate = () => {
    if (!pendingIntent) return;
    setGenerating(true);
    // eslint-disable-next-line promise/catch-or-return
    forumApi
      .getOrCreate(pendingIntent)
      .then((d) => {
        setDiscussion(d);
        setPendingIntent(null);
        dispatch(communityNoteSelected(d));
        return null;
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('forum:get-or-create failed', err);
      })
      .finally(() => setGenerating(false));
  };

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
            <Typography variant="body2">Checking for a discussion…</Typography>
          </EmptyState>
        )}
        {generating && (
          <EmptyState>
            <Typography variant="body2">Generating discussion…</Typography>
            <Typography
              variant="caption"
              sx={{ color: theme.palette.text.secondary, mt: 1 }}
            >
              Four readers are talking it through. About 5-15 seconds.
            </Typography>
          </EmptyState>
        )}
        {!loading && !generating && pendingIntent && (
          <EmptyState>
            <AutoAwesomeIcon
              sx={{
                fontSize: 36,
                color: theme.palette.secondary.main,
                mb: 1,
              }}
            />
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              No discussion yet for this passage
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.text.secondary,
                mb: 2,
                maxWidth: 260,
              }}
            >
              Generate a fresh forum thread (four readers will discuss this
              passage). Costs roughly one LLM call.
            </Typography>
            <Button
              variant="contained"
              color="secondary"
              size="small"
              onClick={handleGenerate}
              startIcon={<AutoAwesomeIcon />}
            >
              Generate discussion
            </Button>
          </EmptyState>
        )}
        {!loading && !generating && !pendingIntent && !discussion && (
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
          !generating &&
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
