import * as React from 'react';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import IconButton from '@mui/material/IconButton';

import Button from '@mui/material/Button';
import CloseIcon from '@mui/icons-material/Close';

import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Typography from '@mui/material/Typography';
import { NavLink } from 'react-router-dom';

import PinDropIcon from '@mui/icons-material/PinDrop';

import NotListedLocationIcon from '@mui/icons-material/NotListedLocation';
import EditIcon from '@mui/icons-material/Edit';

import Menu from '@mui/material/Menu';

import Grid from '@mui/material/Grid';
import MoreVertSharpIcon from '@mui/icons-material/MoreVertSharp';

import { useDispatch } from 'react-redux';
import PushPinIcon from '@mui/icons-material/PushPin';
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined';

import { MoodBoard } from '../../../../commons/model/MoodBoard';
import DeleteMoodBoardModal from './DeleteMoodBoardModal';
import EditMoodBoardModal from './EditMoodBoardModal';


import { updateMoodBoard } from '../../../api/moodBoardApi';
import {
  moodBoardHandled,
  moodBoardUpdated,
} from '../../../store/reducers/moodBoardSlice';

const UnstyledButton = styled(Button)(({ theme }) => ({
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


function MoodBoardItem({
  moodBoard,
  isActive,
}: {
  moodBoard: MoodBoard;
  isActive: boolean;
}) {
  const [alert, setAlert] = React.useState(false);
  const [alertContent, setAlertContent] = React.useState('');

  const [openEdit, setOpenEdit] = React.useState(false);
  const [openDelete, setOpenDelete] = React.useState(false);

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [open, setOpen] = React.useState(!!anchorEl);

  const dispatch = useDispatch();
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    setOpen(true);
  };
  const handleClose = () => {
    setAnchorEl(null);
    setOpen(false);
  };

  const toggleChatPinAction = async (chatId: string, event: React.UIEvent) => {
    try {
      event.preventDefault();
      const c = await updateMoodBoard(moodBoard.id, 'pinned', !moodBoard.pinned);
      dispatch(moodBoardUpdated(c));
      handleClose();
    } catch (error: any) {
      if (error.toJSON && error.toJSON().message === 'Network Error') {
        handleClose();
        setAlertContent('No internet connection.');
        setAlert(true);
      }
      const m = error.response?.data?.error?.message;
      if (m) {
        handleClose();
        setAlertContent(m);
        setAlert(true);
      }
    }
  };

  return (
    <div key={moodBoard.id}>
      <Box
        className={isActive ? 'active' : undefined}
        sx={(theme) => ({
          flexGrow: 1,
          marginTop: 1,
        })}
      >
        <Grid
          container
          spacing={2}
          sx={{ width: '100%', alignItems: 'center' }}
        >
          <Grid item xs>
            <NavLink to={`/moodboard/${moodBoard.id}`} style={{ flex: 1 }}>
              <UnstyledButton variant="text">
                <Grid container>
                  <Grid item>{
                    moodBoard.pinned ? (
                      <PushPinIcon fontSize="small" />
                    ) : (
                      <QuestionAnswerOutlinedIcon fontSize="small" />
                    )
                  }</Grid>
                  <Grid item xs>
                    <Typography
                      variant="body1" // Choose the variant that fits your needs
                      sx={{
                        fontWeight: 300, // Apply the desired font weight
                        textOverflow: 'ellipsis',
                        fontSize: '16px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        maxWidth: '170px',
                      }}
                    >
                      {moodBoard.name}
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
                      }}
                    >
                      {moodBoard.description}
                    </Typography>
                  </Grid>
                </Grid>
              </UnstyledButton>
            </NavLink>
          </Grid>
          <Grid item>
            <IconButton size="small" onClick={handleClick} aria-label="create">
              <MoreVertSharpIcon fontSize="small" />
            </IconButton>
          </Grid>
          <Menu
            id="lock-menu"
            open={open}
            onClose={handleClose}
            anchorEl={anchorEl}
            MenuListProps={{
              'aria-labelledby': 'lock-button',
              role: 'listbox',
            }}
          >
            <MenuItem
              onClick={(event) => toggleChatPinAction(moodBoard.id, event)}
            >
              <ListItemIcon>
                {moodBoard.pinned ? <NotListedLocationIcon /> : <PinDropIcon />}
              </ListItemIcon>
              <ListItemText />
            </MenuItem>
            <MenuItem
              onClick={async () => {
                setOpenEdit(true);
                handleClose();
              }}
            >
              <ListItemIcon>
                <EditIcon />
              </ListItemIcon>
            </MenuItem>
            <MenuItem
              onClick={async () => {
                setOpenDelete(true);
                handleClose();
              }}
            >
              <ListItemIcon>
                <CloseIcon />
              </ListItemIcon>
            </MenuItem>
          </Menu>
        </Grid>
      </Box>
      <EditMoodBoardModal
        open={openEdit}
        moodBoard={moodBoard}
        callback={async () => setOpenEdit(false)}
      />
      <DeleteMoodBoardModal
        open={openDelete}
        moodBoard={moodBoard}
        callback={async () => setOpenDelete(false)}
      />
      <Snackbar
        open={alert}
        autoHideDuration={6000}
        onClose={() => setAlert(false)}
      >
        <Alert severity="error">{alertContent}</Alert>
      </Snackbar>
    </div>
  );
}

export default MoodBoardItem;
