/* eslint-disable react/prop-types */
/* eslint-disable react/require-default-props */
/**
 * MicroCardChip — soft floating suggestion surface for an AI-proposed
 * micro-card. Rendered while `proposal` is non-null; auto-hides on action.
 *
 * Positioning: bottom-right floating panel (not paragraph-edge yet). True
 * paragraph-edge positioning needs DOM-coordinate tracking — deferred until
 * the paragraph-detection wiring lands.
 *
 * Actions:
 *   💡 Save card               → onAccept()      (Box 1 — fresh learning)
 *   💡✓ I know this, track it  → onAcknowledge() (Box 4 — deep-decay refresher)
 *   ✕                           → onDismiss()     (skip; backoff after 3 in a row)
 *
 * The chip intentionally avoids interrupting reading flow — no overlay,
 * no modal, no auto-focus. The user can ignore it and it will be replaced
 * by the next proposal (or dismissed when they navigate away).
 */

import React from 'react';
import { Box, Typography, IconButton, Slide, Stack, Chip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import {
  Lightbulb as LightbulbIcon,
  CheckCircle as CheckIcon,
  Bookmark as BookmarkIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { DOMAIN_COLORS } from '../study/components/cards/CardShell';

function MicroCardChip({ proposal, onAccept, onAcknowledge, onDismiss }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const open = !!proposal;
  const domainColor =
    (proposal && DOMAIN_COLORS[proposal.domain]?.primary) ||
    theme.palette.primary.main;

  return (
    <Slide direction="up" in={open} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          width: 360,
          maxWidth: 'calc(100vw - 48px)',
          bgcolor: theme.palette.background.paper,
          borderRadius: 2.5,
          boxShadow: `0 12px 36px ${alpha('#000', isDark ? 0.5 : 0.18)}`,
          border: `1px solid ${alpha(domainColor, 0.3)}`,
          overflow: 'hidden',
          zIndex: theme.zIndex.snackbar,
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 1,
            bgcolor: alpha(domainColor, 0.1),
            borderBottom: `1px solid ${alpha(domainColor, 0.2)}`,
          }}
        >
          <LightbulbIcon sx={{ color: domainColor, fontSize: 18 }} />
          <Typography
            variant="caption"
            sx={{
              color: domainColor,
              fontWeight: 600,
              letterSpacing: 0.5,
              flex: 1,
              textTransform: 'uppercase',
            }}
          >
            Save as flashcard?
          </Typography>
          {proposal?.domain && (
            <Chip
              label={proposal.domain}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.65rem',
                bgcolor: alpha(domainColor, 0.15),
                color: domainColor,
              }}
            />
          )}
          <IconButton
            size="small"
            onClick={() => onDismiss && onDismiss('header-close')}
            aria-label="dismiss"
            sx={{ ml: 0.5, color: theme.palette.text.secondary }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>

        {/* Body */}
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 600,
              color: theme.palette.text.primary,
              mb: 0.5,
              lineHeight: 1.4,
            }}
          >
            {proposal?.front}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.secondary,
              display: 'block',
              lineHeight: 1.5,
              maxHeight: 80,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {proposal?.back}
          </Typography>
        </Box>

        {/* Actions */}
        <Stack
          direction="row"
          spacing={1}
          sx={{
            px: 1.5,
            py: 1,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            bgcolor: alpha(domainColor, 0.03),
          }}
        >
          <Box
            component="button"
            type="button"
            onClick={() => onAccept && onAccept()}
            sx={{
              flex: 1,
              border: 'none',
              cursor: 'pointer',
              bgcolor: domainColor,
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: 1.5,
              py: 0.75,
              px: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              transition: 'opacity 0.15s ease',
              '&:hover': { opacity: 0.9 },
            }}
            aria-label="save card"
          >
            <CheckIcon sx={{ fontSize: 14 }} />
            Save
          </Box>
          <Box
            component="button"
            type="button"
            onClick={() => onAcknowledge && onAcknowledge()}
            sx={{
              flex: 1,
              border: `1px solid ${alpha(domainColor, 0.4)}`,
              cursor: 'pointer',
              bgcolor: 'transparent',
              color: domainColor,
              fontSize: '0.75rem',
              fontWeight: 500,
              borderRadius: 1.5,
              py: 0.75,
              px: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
              transition: 'background-color 0.15s ease',
              '&:hover': { bgcolor: alpha(domainColor, 0.05) },
            }}
            aria-label="acknowledge — already know this"
            title="Already know it — track for occasional refresh"
          >
            <BookmarkIcon sx={{ fontSize: 14 }} />
            Know it
          </Box>
        </Stack>
      </Box>
    </Slide>
  );
}

export default MicroCardChip;
