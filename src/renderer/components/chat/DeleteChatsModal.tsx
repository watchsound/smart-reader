import {  useState } from 'react';

import Typography from '@mui/material/Typography';
import Modal from '@mui/material/Modal';
import Stack from '@mui/material/Stack';

import TireRepairIcon from '@mui/icons-material/TireRepair';
import { useDispatch } from 'react-redux';

import customStorage from '../../store/customStorage';
import { chatQueried } from '../../store/reducers/chatSlice';
import SmallButton from '../Button/SmallButton';

function DeleteChatsModal({ onOpen }: { onOpen: () => void }) {
  const [opened, setOpened] = useState(false);
  const dispatch = useDispatch();
  return (
    <>
      <SmallButton
        variant="outlined"
        onClick={() => {
          setOpened(true);
          onOpen();
        }}
        startIcon={<TireRepairIcon />}
      >
        Delete Chats
      </SmallButton>
      <Modal open={opened} onClose={() => setOpened(false)} title="Delete Chat">
        <Stack>
          <Typography>Are you sure you want to delete your chats?</Typography>
          <SmallButton
            onClick={async () => {
              customStorage.deleteAllChat();
              dispatch(chatQueried([]));
            }}
          >
            Delete
          </SmallButton>
        </Stack>
      </Modal>
    </>
  );
}

export default DeleteChatsModal;
