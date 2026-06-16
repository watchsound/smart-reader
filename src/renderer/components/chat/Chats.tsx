import { useMemo, useEffect, useState } from 'react';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { useSelector, useDispatch } from 'react-redux';
import { styled, useTheme, alpha } from '@mui/material/styles';
import { green, grey } from '@mui/material/colors';
import { Pagination } from '@mui/material';
import Divider from '@mui/material/Divider';
import PushPinIcon from '@mui/icons-material/PushPin';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
// import { useGetChatsByQueryQuery } from '../../store/api/chatApiSlice';
import { getChatsByQuery, getLearnAboutByQuery } from '../../api/chatApi';
import {
  chatQueried,
  pinnedQueried,
  learnAboutQueried,
  pinnedLearnAboutsQueried,
} from '../../store/reducers/chatSlice';
import ChatItem from './ChatItem';
import customStorage from '../../store/customStorage';

const SectionLabel = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 1.5),
  marginBottom: theme.spacing(0.5),
}));

const SectionChip = styled(Chip)(({ theme }) => ({
  height: 22,
  fontSize: '0.7rem',
  fontWeight: 600,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
  backgroundColor: alpha(theme.palette.primary.main, 0.1),
  color: theme.palette.primary.main,
  '& .MuiChip-icon': {
    fontSize: 14,
    color: theme.palette.primary.main,
  },
}));

const ScrollPane = styled('div')(({ theme }) => ({
  overflowX: 'hidden',
  overflowY: 'auto',
  flex: 1,
  minHeight: 0,
  width: '100%',
  padding: theme.spacing(0, 1),
  // Hide scrollbar by default, show on hover
  '&::-webkit-scrollbar': {
    width: 0,
    background: 'transparent',
  },
  '&:hover::-webkit-scrollbar': {
    width: 4,
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: alpha(theme.palette.text.primary, 0.15),
    borderRadius: 2,
  },
  // Firefox
  scrollbarWidth: 'none',
  '&:hover': {
    scrollbarWidth: 'thin',
    scrollbarColor: `${alpha(theme.palette.text.primary, 0.15)} transparent`,
  },
}));

const EmptyState = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(4),
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));
function Chats({
  search,
  isLearnAbout,
}: {
  search: string;
  isLearnAbout: boolean;
}) {
  // const [chats, setChats] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const dispatch = useDispatch();
  const curChat = useSelector((state) =>
    isLearnAbout ? state.chat.curLearnAbout : state.chat.curChat,
  );
  const unpinnedChats = useSelector((state) =>
    isLearnAbout ? state.chat.learnAbouts : state.chat.chats,
  );
  const pinnedChats = useSelector((state) =>
    isLearnAbout ? state.chat.pinnedLearnAbouts : state.chat.pinned,
  );

  useEffect(() => {
    async function t() {
      if (isLearnAbout) {
        const result = await customStorage.getPinnedLearnAbout();
        dispatch(pinnedLearnAboutsQueried(result || []));
      } else {
        const result = await customStorage.getPinnedChats();
        dispatch(pinnedQueried(result || []));
      }
    }
    t();
  }, []);

  useEffect(() => {
    // Rapid `search`/`page` changes fire overlapping queries; without a
    // race guard, a slow earlier response can overwrite a faster later
    // one in Redux, displaying stale results.
    let cancelled = false;
    async function t() {
      if (isLearnAbout) {
        const result = await getLearnAboutByQuery({
          query: search || '',
          page,
          limit,
        });
        if (cancelled) return;
        setTotal(result.total);
        dispatch(learnAboutQueried(result.data || []));
        return;
      }
      const result = await getChatsByQuery({
        query: search || '',
        page,
        limit,
      });
      if (cancelled) return;
      setTotal(result.total);
      dispatch(chatQueried(result.data || []));
    }
    t();
    return () => {
      cancelled = true;
    };
  }, [search, page, limit]);

  // const pinnedChats = useMemo(
  //   () => chats.filter((chat) => chat.pinned),
  //   [chats],
  // );
  // const unpinnedChats = useMemo(
  //   () => chats.filter((chat) => !chat.pinned),
  //   [chats],
  // );
  const handlePageChange = (event, value) => {
    setPage(value);
  };
  const theme = useTheme();
  const hasChats = pinnedChats.length > 0 || unpinnedChats.length > 0;

  return (
    <ScrollPane>
      {!hasChats && (
        <EmptyState>
          <ChatBubbleOutlineIcon
            sx={{
              fontSize: 48,
              color: alpha(theme.palette.text.secondary, 0.3),
              mb: 2,
            }}
          />
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            No chats yet
          </Typography>
          <Typography variant="caption" color="text.disabled">
            Start a new conversation
          </Typography>
        </EmptyState>
      )}

      {pinnedChats.length > 0 && (
        <>
          <SectionLabel>
            <SectionChip
              icon={<PushPinIcon />}
              label="Pinned"
              size="small"
            />
          </SectionLabel>
          {pinnedChats.map((chat) => (
            <ChatItem
              key={chat.id}
              chat={chat}
              isActive={curChat && curChat.id === chat.id}
            />
          ))}
        </>
      )}

      {unpinnedChats.length > 0 && (
        <>
          {pinnedChats.length > 0 && (
            <SectionLabel sx={{ mt: 1 }}>
              <SectionChip
                icon={<ChatBubbleOutlineIcon />}
                label="Recent"
                size="small"
                sx={{
                  bgcolor: alpha(theme.palette.text.secondary, 0.08),
                  color: theme.palette.text.secondary,
                  '& .MuiChip-icon': {
                    color: theme.palette.text.secondary,
                  },
                }}
              />
            </SectionLabel>
          )}
          {unpinnedChats.map((chat) => (
            <ChatItem
              key={chat.id}
              chat={chat}
              isActive={curChat && curChat.id === chat.id}
            />
          ))}
        </>
      )}

      {/* Pagination */}
      {total > limit && (
        <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
          <Pagination
            count={Math.ceil(total / limit)}
            page={page}
            size="small"
            onChange={handlePageChange}
            color="primary"
            sx={{
              '& .MuiPaginationItem-root': {
                fontSize: '0.75rem',
                minWidth: 28,
                height: 28,
              },
            }}
          />
        </Box>
      )}
    </ScrollPane>
  );
}

export default Chats;
