import * as React from 'react';
import { styled } from '@mui/material/styles';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import MoreVertSharpIcon from '@mui/icons-material/MoreVertSharp';

import { NavLink } from 'react-router-dom';
import { getFirstMessageByChatId } from '../../api/chatApi';
import { Chat } from '../../../commons/model/chat';

interface MainLinkProps {
  icon: React.ReactNode;
  color: string;
  label: string;
  chat: Chat;
  popupCallback: (event: React.MouseEvent<HTMLElement>) => {};
}

const UnstyledButton = styled(Grid)(({ theme }) => ({
  width: '100%',
  padding: 2,
  borderRadius: 2,
}));

const Text = styled(Typography)(({ theme }) => ({
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  flex: 1,
  width: 0,
}));

function MainLink({ icon, color, label, chat, popupCallback }: MainLinkProps) {
  const [firstMessage, setFirstMessage] = React.useState(null);

  React.useEffect(() => {
    if (!chat) return;
    async function fetchData() {
      const data = await getFirstMessageByChatId(chat.id);
      if (data) setFirstMessage(data);
    }
    fetchData();
  }, [chat]);

  return (
    <UnstyledButton container>
      <Grid item>{icon}</Grid>
      <Grid item xs>
        <NavLink to={`/chat/${chat.id}`} style={{ flex: 1 }}>
          <Typography
            variant="body1" // Choose the variant that fits your needs
            sx={{
              fontWeight: 300, // Apply the desired font weight
              textOverflow: 'ellipsis',
              fontSize: '16px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              maxWidth: '170px',
              color: '#42a5f5',
              marginLeft: '10px',
            }}
          >
            {label}
          </Typography>
          <Typography
            color="dimmed"
            sx={{
              fontWeight: 100,
              fontSize: '10px',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              maxWidth: '170px',
              color: '#42a5f5',
              marginLeft: '10px',
            }}
          >
            {firstMessage?.content}
          </Typography>
        </NavLink>
      </Grid>
      <Grid item>
        <IconButton size="small" onClick={popupCallback} aria-label="create">
          <MoreVertSharpIcon fontSize="small" />
        </IconButton>
      </Grid>
    </UnstyledButton>
  );
}

export default MainLink;
