import { useMemo, useEffect, useState } from 'react';
import Typography from '@mui/material/Typography';
import { useSelector, useDispatch } from 'react-redux';
import { styled } from '@mui/material/styles';
import { green, grey } from '@mui/material/colors';
import { Pagination } from '@mui/material';
import Divider from '@mui/material/Divider';
// import { useGetChatsByQueryQuery } from '../../store/api/chatApiSlice';
import { getChatsByQuery } from '../../api/chatApi';
import { chatQueried, pinnedQueried } from '../../store/reducers/chatSlice';
import ChatItem from './ChatItem';
import customStorage from '../../store/customStorage';

const ColoredTextTypography = styled(Typography)({
  color: green[500],
  variants: 'h6',
  fontSize: '12px',
});
const ScrollPane = styled('div')(({ theme }) => ({
  overflowX: 'hidden',
  overflowY: 'auto',
  height: 'calc(100vh - 120px)',
  width: '100%',
  scrollbarWidth: 'thin',
  scrollbarColor:
    theme.palette.mode === 'light'
      ? grey[100]
      : theme.palette.background.default,
}));
function Chats({ search }: { search: string }) {
 // const [chats, setChats] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const dispatch = useDispatch();
  const curChat = useSelector((state) => state.chat.curChat);
  const unpinnedChats = useSelector((state) => state.chat.chats);
  const pinnedChats = useSelector((state) => state.chat.pinned);

  useEffect(() => {
    async function t() {
      const result = await customStorage.getPinnedChats();
      dispatch(pinnedQueried(result || []));
    }
    t();
  }, []);

  useEffect(() => {
    async function t() {
      const result = await getChatsByQuery({
        query: search || '',
        page,
        limit,
      });
    //  setChats(result.data || []);
      setTotal(result.total);
      dispatch(chatQueried(result.data || []));
    }
    t();
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
  return (
    <ScrollPane>
      {pinnedChats.length > 0 ? (
        <>
          <ColoredTextTypography>Pinned</ColoredTextTypography>
          {pinnedChats.map((chat) => (
            <ChatItem
              key={chat.id}
              chat={chat}
              isActive={curChat && curChat.id === chat.id}
            />
          ))}

          {unpinnedChats.length > 0 ? (
            <ColoredTextTypography>Unpinned</ColoredTextTypography>
          ) : null}
        </>
      ) : null}

      {unpinnedChats.map((chat) => (
        <ChatItem
          key={chat.id}
          chat={chat}
          isActive={curChat && curChat.id === chat.id}
        />
      ))}
      <Divider />
      <Pagination
        count={Math.ceil(total / limit)}
        page={page}
        size="small"
        onChange={handlePageChange}
        variant="outlined"
        color="secondary"
         sx={{ margin: '10px' }}
      />
    </ScrollPane>
  );
}

export default Chats;
