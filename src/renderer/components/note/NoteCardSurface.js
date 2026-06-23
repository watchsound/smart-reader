/* eslint-disable react/prop-types */
import React, { forwardRef } from 'react';
import { Box } from '@mui/material';
import { styled, alpha, useTheme } from '@mui/material/styles';

/**
 * NoteCardSurface — Editorial Premium card chrome for the Note component.
 *
 * Replaces the plain MUI `Card` chrome that was wrapping `NoteUI` content.
 * Provides:
 *
 *   - 14px rounded soft-elevation card with hairline border
 *   - 4px solid accent stripe on the left edge in the note's color
 *   - A 90deg accent-tinted gradient overlay fading to invisible by ~30%
 *     of the card width — gives every note a visual identity without
 *     painting the whole surface
 *   - Hover lift (3px translateY, shadow deepens)
 *   - Tactile tap scale (0.99 on :active)
 *   - Entry animation: fade + translateY + scale via @keyframes; staggered
 *     by parent setting --note-card-entry-delay
 *   - Typography refresh: serif highlight quote + monospace meta inside
 *
 * Public API:
 *   <NoteCardSurface
 *     accentColor="#FFEB3B"
 *     entryDelay={index * 30}   // ms; for staggered list entry
 *     onClick={handler}
 *     sx={...}                  // forwarded sx for sizing in callers
 *   >
 *     { ...existing CardHeader + CardContent + CardMedia + tags ... }
 *   </NoteCardSurface>
 *
 * Internals only depend on theme + props. Existing prop API of `NoteUI` is
 * untouched — the swap is internal.
 */

const cardEnterKeyframes = `
  @keyframes note-card-enter {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.985);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
`;

// Notes can have their `color` field stored as either a CSS color string
// (e.g. '#42a5f5') or an MUI palette name ('primary', 'secondary', 'error',
// 'warning', 'info', 'success' — see AnnotationNoteUtil's `colorsMui`).
// MUI's `alpha()` accepts only CSS color values; palette names crash it.
// This resolver maps a palette name to its `.main` value and passes valid
// CSS colors through unchanged.
function resolveAccent(theme, value) {
  if (!value) return theme.palette.primary.main;
  if (typeof value === 'string' && theme.palette[value]?.main) {
    return theme.palette[value].main;
  }
  return value;
}

const Surface = styled(Box, {
  shouldForwardProp: (prop) =>
    prop !== 'accentColor' &&
    prop !== 'entryDelay' &&
    prop !== 'useFlatBackground' &&
    prop !== 'dense',
})(({
  theme,
  accentColor,
  entryDelay = 0,
  useFlatBackground = false,
  dense = false,
}) => {
  const isDark = theme.palette.mode === 'dark';
  const accent = resolveAccent(theme, accentColor);
  return {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
    // Presentation contexts (MoodBoard, Leitner flip, slider) historically
    // painted the whole card in the note's color. We preserve that via
    // `useFlatBackground`. Browsing contexts (sidebar, Notes view) use the
    // theme paper bg + accent stripe for color signal without washing out
    // the text. The stripe + gradient ::before/::after are suppressed in
    // flat-background mode so they don't double up on the same color.
    backgroundColor: useFlatBackground
      ? accent
      : theme.palette.background.paper,
    border: `1px solid ${
      isDark ? alpha('#fff', 0.06) : alpha('#000', 0.06)
    }`,
    boxShadow: isDark
      ? '0 2px 8px rgba(0,0,0,0.30), 0 12px 28px -8px rgba(0,0,0,0.45)'
      : '0 2px 8px rgba(0,0,0,0.06), 0 12px 28px -8px rgba(0,0,0,0.10)',
    transition:
      'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), ' +
      'box-shadow 200ms cubic-bezier(0.16, 1, 0.3, 1), ' +
      'border-color 200ms ease',
    cursor: 'pointer',
    isolation: 'isolate',
    // Entry animation. Parent controls stagger by passing entryDelay.
    animation: `note-card-enter 360ms cubic-bezier(0.16, 1, 0.3, 1) both`,
    animationDelay: `${entryDelay}ms`,

    // Hover lift
    '&:hover': {
      transform: 'translateY(-3px)',
      boxShadow: isDark
        ? '0 4px 12px rgba(0,0,0,0.40), 0 20px 40px -8px rgba(0,0,0,0.60)'
        : '0 4px 12px rgba(0,0,0,0.08), 0 20px 40px -8px rgba(0,0,0,0.16)',
      borderColor: alpha(accent, 0.25),
    },

    // Tactile tap
    '&:active': {
      transform: 'translateY(-1px) scale(0.99)',
      transition: 'transform 80ms ease',
    },

    // Accent stripe on the left edge (4px) + gradient fade across body.
    // Suppressed in flat-background mode where the whole card already wears
    // the accent — drawing them would double up on the same color.
    '&::before': useFlatBackground
      ? { content: 'none' }
      : {
          content: '""',
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 4,
          background: accent,
          zIndex: 1,
          transition: 'background 250ms ease',
        },
    '&::after': useFlatBackground
      ? { content: 'none' }
      : {
          content: '""',
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 4,
          width: '30%',
          background: `linear-gradient(90deg, ${alpha(accent, 0.15)} 0%, ${alpha(
            accent,
            0,
          )} 100%)`,
          pointerEvents: 'none',
          zIndex: 0,
          transition: 'background 250ms ease',
        },

    // Typography refresh applied inside the surface.
    //
    // Two strategies layered:
    //
    // 1) Explicit classes (.note-quote / .note-title / .note-meta) for
    //    new content that opts in.
    //
    // 2) Descendant selectors targeting the existing content scaffolding
    //    (`.note__body` from CardContentPanel's dangerouslySetInnerHTML +
    //    MUI CardHeader's `.MuiCardHeader-title`). Lets the refresh fire
    //    on already-rendered content without touching content code.
    //
    // Inline styles on user-customized cards (cardData.fontSize, etc.)
    // still win over these — explicit user prefs aren't overridden.
    '& .note-quote, & .note__body': {
      fontFamily:
        "'Source Serif Pro', Georgia, 'Times New Roman', serif",
      fontSize: '1.05rem',
      lineHeight: 1.55,
      fontWeight: 400,
      color: theme.palette.text.primary,
    },
    '& .note__body h1, & .note__body h2, & .note__body h3': {
      fontFamily:
        "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.3,
      marginTop: 0,
      marginBottom: '0.5rem',
      color: theme.palette.text.primary,
    },
    '& .note-title, & .MuiCardHeader-title': {
      fontFamily:
        "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      fontSize: '0.95rem',
      fontWeight: 600,
      lineHeight: 1.4,
      color: theme.palette.text.primary,
    },
    '& .note-meta, & .MuiCardHeader-subheader': {
      fontFamily:
        "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
      fontSize: '0.72rem',
      fontWeight: 500,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: theme.palette.text.secondary,
    },

    // The card-templates in `cardsetting/card-templates.js` render
    // their content inside a `.card-container` div with an *inline*
    // `style="width: ${width}px"` — a fixed pixel width baked in at
    // render time. CardContentSwitcher feeds it a pixel value derived
    // from `cardWidth - 8`, so when the surface now stretches to fill
    // the column the inner container stays at the old narrow width
    // and leaves visible whitespace inside the card (see screenshot).
    //
    // External CSS with `!important` overrides inline styles per the
    // CSS spec (unless the inline also uses !important, which the
    // templates do not). Forcing `width: 100%` + `box-sizing: border-box`
    // on `.card-container` makes the content fill the surface width.
    '& .note__body .card-container': {
      width: '100% !important',
      maxWidth: '100% !important',
      boxSizing: 'border-box !important',
    },
    // Inline images (cover snapshots, pasted screenshots, etc.) also
    // get fluid sizing so they scale to the now-wider container while
    // preserving aspect ratio.
    '& .note__body img': {
      maxWidth: '100%',
      height: 'auto',
      borderRadius: 8,
      display: 'block',
    },

    // Force symmetric horizontal layout on the body content area.
    //
    // `CardContentSwitcher` sets `sx={{ margin: '2px', padding: '2px',
    // width: w }}` on CardContent — where `w = size.width - 8`. The
    // explicit width leaves CardContent 8px narrower than the surface;
    // it anchors at the left, so the leftover 8px collects against
    // the right edge. Combined with the asymmetric stripe + gradient
    // on the left, the text ended up visibly drifting toward one side.
    //
    // Forcing `width: 100%` + box-sizing + symmetric padding + zero
    // margins overrides all four inline-set properties and pins the
    // body content with true equal left/right margins. The `!important`
    // is required because the inline `sx` produces higher-specificity
    // styles than a normal CSS selector.
    // Dense mode (MoodBoard diagram nodes, ~250x180px) tightens horizontal
    // padding so content actually fills the small canvas. The 16px default
    // was tuned for full-size cards where the stripe+gradient on the left
    // need breathing room — at diagram-node sizes that padding eats most
    // of the readable width and the text gets clipped before it should.
    '& .MuiCardContent-root': {
      width: '100% !important',
      boxSizing: 'border-box !important',
      marginLeft: '0 !important',
      marginRight: '0 !important',
      paddingLeft: dense ? '4px !important' : '16px !important',
      paddingRight: dense ? '4px !important' : '16px !important',
      ...(dense && {
        paddingTop: '4px !important',
        paddingBottom: '4px !important',
      }),
    },

    // Content sits above the gradient overlay.
    '& > *': {
      position: 'relative',
      zIndex: 2,
    },
  };
});

const NoteCardSurface = forwardRef(function NoteCardSurface(
  {
    accentColor,
    entryDelay,
    useFlatBackground = false,
    dense = false,
    onClick,
    children,
    sx,
    className,
    ...rest
  },
  ref,
) {
  // Inject the @keyframes once globally. Emotion's styled API doesn't
  // emit @keyframes from inside its style object reliably across remounts,
  // so we ensure the keyframe definition is in the document head.
  // (A single <style> block is idempotent across multiple mounts.)
  useTheme(); // touch theme so HMR refreshes typography overrides
  return (
    <>
      <style data-note-card-keyframes>{cardEnterKeyframes}</style>
      <Surface
        ref={ref}
        accentColor={accentColor}
        entryDelay={entryDelay}
        useFlatBackground={useFlatBackground}
        dense={dense}
        onClick={onClick}
        sx={sx}
        className={className}
        {...rest}
      >
        {children}
      </Surface>
    </>
  );
});

export default NoteCardSurface;
