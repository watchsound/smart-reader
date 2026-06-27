/* eslint-disable react/prop-types */
import React, { useEffect, useState } from 'react';
import { Box, Tooltip, IconButton } from '@mui/material';
import ForumIcon from '@mui/icons-material/Forum';
import { useSelector, useDispatch } from 'react-redux';
import forumApi from '../../api/forumApi';
import { communityNoteSelected } from '../../store/reducers/readerSlice';

/**
 * In-book gutter overlay listing existing Forum Discussions for the current chapter.
 * Click a marker → opens that discussion in CommunityPanel.
 *
 * v1: shows discussions as a vertical stack in the right gutter, not yet
 * positioned per-paragraph. Per-paragraph cfi alignment is a polish item.
 */
export default function ForumMarkerLayer({ bookId, chapterId }) {
  const dispatch = useDispatch();
  const visible = useSelector((s) => s.reader.showCommunityNote);
  const [discussions, setDiscussions] = useState([]);

  useEffect(() => {
    if (!bookId || !chapterId) return;
    // eslint-disable-next-line promise/catch-or-return
    forumApi
      .listByChapter({ bookId, chapterId })
      .then(setDiscussions)
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('forum:list-by-chapter failed', err);
      });
  }, [bookId, chapterId]);

  if (!visible || discussions.length === 0) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        right: 4,
        top: 0,
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
      }}
    >
      {discussions.map((d) => (
        <Tooltip
          key={d.id}
          title={`${d.turns.length} turn${d.turns.length === 1 ? '' : 's'}${
            d.selectionText ? ` · "${d.selectionText.slice(0, 30)}…"` : ''
          }`}
        >
          <IconButton
            size="small"
            onClick={() => dispatch(communityNoteSelected(d))}
          >
            <ForumIcon fontSize="small" color="secondary" />
          </IconButton>
        </Tooltip>
      ))}
    </Box>
  );
}
