/* eslint-disable react/prop-types */
/* eslint-disable react/require-default-props */
/**
 * MicroCardChip — soft floating suggestion surface for an AI-proposed
 * micro-card. Rendered while `proposal` is non-null; auto-hides on action.
 *
 * Positioning:
 *   - Paragraph-anchored when `anchorAccessor` is provided AND the proposal's
 *     source paragraph can be located in the iframe (lives in the current
 *     page). The chip floats below the paragraph, clamped to the viewport.
 *   - Falls back to fixed bottom-right when no accessor is given, the
 *     proposal has no `paragraphHash`, or the paragraph is no longer in the
 *     DOM (the user paged past it before the LLM returned).
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

import React, { useEffect, useState } from 'react';
import { Box, Typography, IconButton, Slide, Stack, Chip } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import {
  Lightbulb as LightbulbIcon,
  CheckCircle as CheckIcon,
  Bookmark as BookmarkIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { DOMAIN_COLORS } from '../study/components/cards/CardShell';

const CHIP_WIDTH = 360;
const CHIP_ESTIMATED_HEIGHT = 180; // matches header + body + actions
const VIEWPORT_MARGIN = 16;
const ANCHOR_GAP = 8; // px between paragraph edge and chip

// Compute outer-viewport position from iframe-relative element rect.
// Returns null if anchor is unusable (missing pieces / element detached /
// element scrolled fully outside the iframe viewport).
//
// The element may live in any of the rendition's iframes (two-page spread
// renders one iframe per page). We derive the owning iframe from the
// element's own document, then offset by that iframe's outer-viewport rect.
function computeAnchorPosition(accessor, paragraphHash) {
  if (!accessor || !paragraphHash) return null;
  const lookup =
    typeof accessor.getElementByHash === 'function'
      ? accessor.getElementByHash
      : null;
  if (!lookup) return null;
  const el = lookup(paragraphHash);
  if (!el || !el.isConnected) return null;
  // `frameElement` is the iframe that contains this document. Null when the
  // element is in the top window (tests, or a future inline rendition).
  const iframe = el.ownerDocument?.defaultView?.frameElement || null;
  const iframeRect = iframe ? iframe.getBoundingClientRect() : null;
  const elRect = el.getBoundingClientRect();
  if (!elRect || elRect.width === 0 || elRect.height === 0) return null;
  const top = (iframeRect ? iframeRect.top : 0) + elRect.bottom + ANCHOR_GAP;
  const left = (iframeRect ? iframeRect.left : 0) + elRect.left;
  // If the paragraph itself is fully outside the iframe viewport (user
  // scrolled past it within a flow-mode rendition), fall back to floating.
  if (iframeRect) {
    const elTopAbs = iframeRect.top + elRect.top;
    const elBotAbs = iframeRect.top + elRect.bottom;
    if (elBotAbs < iframeRect.top || elTopAbs > iframeRect.bottom) return null;
  }
  return { top, left };
}

// Clamp a (top,left) for a CHIP_WIDTH × CHIP_ESTIMATED_HEIGHT box so it
// stays inside the viewport. If there's not enough room below, place above.
function clampToViewport(pos) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(pos.left, vw - CHIP_WIDTH - VIEWPORT_MARGIN),
  );
  let { top } = pos;
  if (top + CHIP_ESTIMATED_HEIGHT + VIEWPORT_MARGIN > vh) {
    // Not enough room below — try placing above the gap point.
    top = pos.top - CHIP_ESTIMATED_HEIGHT - ANCHOR_GAP * 2;
  }
  top = Math.max(VIEWPORT_MARGIN, Math.min(top, vh - VIEWPORT_MARGIN - 60));
  // For very narrow viewports, just hug the left margin.
  if (vw < CHIP_WIDTH + 2 * VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
  return { top, left };
}

function MicroCardChip({
  proposal,
  anchorAccessor,
  onAccept,
  onAcknowledge,
  onDismiss,
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const open = !!proposal;
  const domainColor =
    (proposal && DOMAIN_COLORS[proposal.domain]?.primary) ||
    theme.palette.primary.main;

  // `null` means "fall back to fixed bottom-right"; otherwise an anchored
  // {top,left} pair (in outer viewport coords).
  //
  // Re-measure strategy: a 150ms interval is good enough — the chip is
  // brief, the accessor is held in a ref (so we can't subscribe to its
  // changes), and EPUB pagination updates the accessor's underlying map
  // on every page-load. window.resize + iframe-scroll listeners would
  // miss the page-flip case; the interval covers everything cheaply.
  const [anchorPos, setAnchorPos] = useState(null);

  useEffect(() => {
    if (!open) {
      setAnchorPos(null);
      return undefined;
    }
    const hash = proposal?.paragraphHash || null;

    let lastSerialized = '';
    const measure = () => {
      const accessor = anchorAccessor?.current || null;
      const raw = computeAnchorPosition(accessor, hash);
      const next = raw ? clampToViewport(raw) : null;
      const serialized = next ? `${next.top}|${next.left}` : 'fallback';
      if (serialized !== lastSerialized) {
        lastSerialized = serialized;
        setAnchorPos(next);
      }
    };
    measure();
    const intervalId = window.setInterval(measure, 150);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [open, anchorAccessor, proposal?.paragraphHash]);

  // Choose positioning style based on whether we have a live anchor.
  const positionSx = anchorPos
    ? {
        position: 'fixed',
        top: anchorPos.top,
        left: anchorPos.left,
        right: 'auto',
        bottom: 'auto',
      }
    : { position: 'fixed', right: 24, bottom: 24 };

  return (
    <Slide direction="up" in={open} mountOnEnter unmountOnExit>
      <Box
        sx={{
          ...positionSx,
          width: CHIP_WIDTH,
          maxWidth: 'calc(100vw - 48px)',
          bgcolor: theme.palette.background.paper,
          borderRadius: 2.5,
          boxShadow: `0 12px 36px ${alpha('#000', isDark ? 0.5 : 0.18)}`,
          border: `1px solid ${alpha(domainColor, 0.3)}`,
          overflow: 'hidden',
          zIndex: theme.zIndex.snackbar,
          transition: 'top 180ms ease, left 180ms ease',
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
