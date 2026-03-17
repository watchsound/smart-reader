/* eslint-disable react/jsx-props-no-spreading */
import React, { useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { styled, alpha, useTheme } from '@mui/material/styles';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';

import { useLongPress } from '../../hooks/useLongPress';
import QuickWordDialog from './QuickWordDialog';
import QuickNoteDialog from './QuickNoteDialog';
import CreateVocabularyModal from '../../views/vocabulary/CreateVocabularyModal';
import CreateNoteModal from '../chat/CreateNoteModal';
import { NoteType } from '../../../commons/model/Note';
import customStorage from '../../store/customStorage';

const StyledIconButton = styled(IconButton)(({ theme }) => ({
  width: 36,
  height: 36,
  borderRadius: 8,
  color: '#ffffff',
  backgroundColor: alpha(theme.palette.common.white, 0.1),
  transition: 'all 0.15s ease-in-out',
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
    transform: 'scale(1.08)',
  },
  '& .MuiSvgIcon-root': {
    fontSize: 22,
  },
}));

function HeaderQuickActions() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  // Quick dialogs state
  const [quickWordOpen, setQuickWordOpen] = useState(false);
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);

  // Full modals state
  const [fullWordModalOpen, setFullWordModalOpen] = useState(false);
  const [fullNoteModalOpen, setFullNoteModalOpen] = useState(false);

  // Long press handlers for Word button
  const wordLongPressHandlers = useLongPress(
    // onLongPress - open full modal
    () => {
      setFullWordModalOpen(true);
    },
    // onClick - open quick dialog
    () => {
      setQuickWordOpen(true);
    },
    { threshold: 1000 },
  );

  // Long press handlers for Note button
  const noteLongPressHandlers = useLongPress(
    // onLongPress - open full modal
    () => {
      setFullNoteModalOpen(true);
    },
    // onClick - open quick dialog
    () => {
      setQuickNoteOpen(true);
    },
    { threshold: 1000 },
  );

  // Handler for saving vocabulary from full modal
  const handleVocabularySave = async (vocabulary) => {
    try {
      await customStorage.createVocabulary({
        word: vocabulary.name || vocabulary.word,
        definition: vocabulary.definition || '',
        relatedWords: vocabulary.relatedWord || vocabulary.relatedWords || '',
        example: vocabulary.example || '',
        setId: -1,
        score: 0,
      });
    } catch (error) {
      console.error('Error saving vocabulary:', error);
    }
  };

  // Handler for note dialog close
  const handleNoteDialogClose = () => {
    setFullNoteModalOpen(false);
    // Note is saved within the CreateNoteModal/CreateNotePanel
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        mr: 2,
      }}
    >
      {/* Add Word Button */}
      <Tooltip title="Add Word (hold for full editor)" arrow>
        <IconButton
          aria-label="add word"
          {...wordLongPressHandlers}
          sx={{
            width: '36px !important',
            height: '36px !important',
            borderRadius: '8px !important',
            color: isDark ? '#ffffff !important' : '#4a154b !important',
            backgroundColor: isDark
              ? 'rgba(255, 255, 255, 0.12) !important'
              : 'rgba(74, 21, 75, 0.1) !important',
            transition: 'all 0.15s ease-in-out',
            '&:hover': {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.25) !important'
                : 'rgba(74, 21, 75, 0.2) !important',
              transform: 'scale(1.05)',
            },
          }}
        >
          <AddCircleOutlineIcon
            sx={{ fontSize: 22, color: isDark ? '#ffffff' : '#4a154b' }}
          />
        </IconButton>
      </Tooltip>

      {/* Add Note Button */}
      <Tooltip title="Add Note (hold for full editor)" arrow>
        <IconButton
          aria-label="add note"
          {...noteLongPressHandlers}
          sx={{
            width: '36px !important',
            height: '36px !important',
            borderRadius: '8px !important',
            color: isDark ? '#ffffff !important' : '#4a154b !important',
            backgroundColor: isDark
              ? 'rgba(255, 255, 255, 0.12) !important'
              : 'rgba(74, 21, 75, 0.1) !important',
            transition: 'all 0.15s ease-in-out',
            '&:hover': {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.25) !important'
                : 'rgba(74, 21, 75, 0.2) !important',
              transform: 'scale(1.05)',
            },
          }}
        >
          <NoteAddOutlinedIcon
            sx={{ fontSize: 22, color: isDark ? '#ffffff' : '#4a154b' }}
          />
        </IconButton>
      </Tooltip>

      {/* Quick Word Dialog */}
      <QuickWordDialog
        open={quickWordOpen}
        onClose={() => setQuickWordOpen(false)}
        onSaved={() => {
          // Optional: could dispatch Redux action or show success
        }}
      />

      {/* Quick Note Dialog */}
      <QuickNoteDialog
        open={quickNoteOpen}
        onClose={() => setQuickNoteOpen(false)}
        onSaved={() => {
          // Optional: could dispatch Redux action or show success
        }}
      />

      {/* Full Vocabulary Modal */}
      <CreateVocabularyModal
        word=""
        open={fullWordModalOpen}
        onClose={() => setFullWordModalOpen(false)}
        onSave={handleVocabularySave}
      />

      {/* Full Note Modal */}
      <CreateNoteModal
        sourceType={NoteType.Note}
        sourceKey=""
        content=""
        openDialog={fullNoteModalOpen}
        dialogHandle={handleNoteDialogClose}
      />
    </Box>
  );
}

export default HeaderQuickActions;
