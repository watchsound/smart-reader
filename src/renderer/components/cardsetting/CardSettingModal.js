import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

// Icons
import CloseIcon from '@mui/icons-material/Close';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';

import CardSettingPanel from './CardSettingPanel';
import PageSwitcher from '../note/PageSwitcher';
import { useReplaceNoteMutation } from '../../store/api/noteApiSlice';

function CardSettingModal({ curNote, width, height, open, callback }) {
  const theme = useTheme();

  const [opened, setOpened] = useState(false);
  const [selectedSide, setSelectedSide] = useState(0);
  const [selectedNote, setSelectedNote] = useState(curNote);
  const [ReplaceNote] = useReplaceNoteMutation();

  useEffect(() => {
    setOpened(open);
  }, [open]);

  const close = () => {
    setOpened(false);
    callback(selectedNote);
  };

  const cardSettingChanged = (cardData) => {
    const updatedNote = {
      ...selectedNote,
      cards: selectedNote.cards.map((m, index) => {
        if (index === selectedSide) return { ...m, ...cardData };
        return m;
      }),
    };
    ReplaceNote(updatedNote);
    setSelectedNote(updatedNote);
  };

  const handleSideChange = (event) => {
    const side = event.target.value;
    setSelectedSide(side);
  };

  return (
    <Dialog
      open={opened}
      onClose={close}
      aria-labelledby="card-settings-dialog"
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px',
          overflow: 'hidden',
          bgcolor: theme.palette.background.paper,
          backgroundImage: 'none',
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        id="card-settings-dialog"
        sx={{
          p: 0,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Icon */}
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.2)} 0%, ${alpha(theme.palette.secondary.main, 0.2)} 100%)`,
              }}
            >
              <DashboardCustomizeIcon
                sx={{ fontSize: 24, color: theme.palette.primary.main }}
              />
            </Box>

            {/* Title and subtitle */}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Card Layout Settings
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: theme.palette.text.secondary }}
              >
                Customize the appearance of your note cards
              </Typography>
            </Box>
          </Box>

          {/* Close button */}
          <IconButton
            onClick={close}
            size="small"
            sx={{
              bgcolor: alpha(theme.palette.text.primary, 0.05),
              '&:hover': {
                bgcolor: alpha(theme.palette.text.primary, 0.1),
              },
            }}
          >
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>

        {/* Page Switcher - if multiple sides */}
        {selectedNote?.cards?.length > 1 && (
          <Box
            sx={{
              px: 3,
              pb: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: theme.palette.text.secondary,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Card Side
            </Typography>
            <PageSwitcher
              selectedNote={selectedNote}
              edit={false}
              selectedSide={selectedSide}
              handleSideChange={handleSideChange}
            />
          </Box>
        )}
      </DialogTitle>

      {/* Content */}
      <DialogContent
        sx={{
          p: 0,
          bgcolor: alpha(theme.palette.background.default, 0.5),
        }}
      >
        <CardSettingPanel
          cardData={selectedNote?.cards?.[selectedSide] || {}}
          cardTitle={selectedNote?.title || ''}
          width={width}
          height={height}
          selectionCallback={cardSettingChanged}
        />
      </DialogContent>
    </Dialog>
  );
}

export default CardSettingModal;
