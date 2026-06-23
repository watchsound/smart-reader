# Note Component UI Upgrade — Editorial Premium

**Date:** 2026-06-22
**Status:** Approved — implementing in phases.

## Goal

Replace the plain MUI Card chrome that wraps `NoteUI` with a custom-built **Editorial Premium** visual language. AI is the *tool* that makes a custom design affordable (it writes the code); it is NOT a UI engine driving layout from content. The Note component is reused in 9 contexts and must remain prop-API-compatible.

## Why now

User feedback: the current MUI-default look is "too naive", typography is wrong, color is missing. MUI is popular because of its usability/simplicity tradeoff — not because it's the best-looking. With AI writing the code, custom UI is now affordable.

## Visual language

### Card surface

- **Shape**: 14px rounded corners. Soft elevation — `0 2px 8px rgba(0,0,0,0.06), 0 12px 28px -8px rgba(0,0,0,0.10)` baseline; on hover deepens to `0 4px 12px rgba(0,0,0,0.08), 0 20px 40px -8px rgba(0,0,0,0.16)`.
- **Border**: 1px hairline `rgba(0,0,0,0.06)` in light mode, `rgba(255,255,255,0.06)` in dark.
- **Padding**: generous — outer card 0 (rounded surface), content sections internally padded 16–20px.
- **Color = ambient gradient stripe**, NOT flat background fill:
  - A 4px solid left edge bar in the note's accent color.
  - From there, a `linear-gradient(90deg, accent@15%, accent@0% 30%)` overlay on the card body fades to invisible by ~30% width. Subtle tint, never overwhelming.
  - Card base color stays `theme.palette.background.paper` so text remains legible.

### Typography hierarchy

System fonts only — no external font loading (Electron offline-safe).

| Slot | Font stack | Size | Weight | Other |
|---|---|---|---|---|
| Highlight quote (the *hero*) | `'Source Serif Pro', Georgia, 'Times New Roman', serif` | 1.05rem | 400 | line-height 1.55 |
| Title | `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` | 0.875rem | 600 | line-height 1.4 |
| Source meta | `'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace` | 0.72rem | 500 | uppercase tracking 0.04em, muted color |
| Tag pill | same as title | 0.7rem | 500 | rounded 999px, low-saturation bg of accent color |

The serif quote is the deliberate visual anchor — it tells the reader "this is the content you cared about".

### Motion (CSS — no Framer Motion)

- **Entry**: stagger via parent-controlled `animation-delay`. Each card: `@keyframes note-card-enter` runs `fade + translateY(8px → 0) + scale(0.985 → 1)` over 360ms with a custom cubic-bezier (`cubic-bezier(0.16, 1, 0.3, 1)` — "ease-out-expo"-ish, matches Apple's spring-like easing).
- **Hover**: `transition: transform 200ms, box-shadow 200ms`. `transform: translateY(-3px)`. Stripe brightens 10%.
- **Tap**: `transition: transform 80ms`. `transform: scale(0.99)` on `:active`. Tactile.
- **Color change**: 250ms crossfade on the stripe gradient (`transition: background 250ms`).
- **No 3D tilt** in v1 — adds complexity; revisit if motion feels insufficient.

### Brain accent moments (deferred to a later phase)

The existing `animation-core` already provides shimmer / halo / particle effects. Future phases will hook those into accept/mastery-up/due-for-review events on the new card. Out of scope for Phase 1.

## Architecture

```
NoteUI (existing, public API preserved)
  ├─ NoteCardSurface (NEW — replaces MUI Card)
  │   props: { accentColor, mode: 'sidebar' | 'full', entryDelay, onClick, children }
  │   responsibilities: card chrome, gradient stripe, hover/entry motion
  │
  ├─ CardHeaderNoSwitch (existing, untouched in Phase 1)
  ├─ CardContent / CardMedia / CardContentSwitcher (existing MUI, internally untouched)
  └─ existing footer/tags
```

`NoteUI`'s 3 render paths (edit / no-annotation / full) all wrap their content in `NoteCardSurface` instead of MUI's `StyledCard`. Surface knows how to:
- Apply the accent color stripe + gradient.
- Run the entry animation.
- Render hover lift / tap scale.
- Forward `onClick` to its child surface.

Existing MUI components inside the surface (CardHeader, CardContent, image, tag chips) are untouched in Phase 1. They get *typographic* refresh via the theme override applied inside the surface.

## Phases

**Phase 1 — Editorial Premium baseline** *(this iteration)*
- Build `NoteCardSurface`.
- Build a typography helper that targets the highlight quote + meta inside the surface.
- Replace all 3 `StyledCard` usages in `NoteUI`.
- Verify the 9 callers — they should all benefit automatically.

**Phase 2 — Header refinement** *(later)*
- ⋮ menu fades in on hover, hidden when idle.
- Tag pills replace MUI chip default.
- Mastery / Leitner badges as resting-state chrome.

**Phase 3 — Per-context tuning** *(later)*
- Sidebar variant: 2-line clamp on the quote, no image, denser meta.
- MoodBoard variant: image-prominent, larger surface.
- Leitner variant: flip-card respects new typography on both faces.

**Phase 4 — Brain accent moments** *(later)*
- Hook `animation-core`'s shimmer/halo/particle effects to accept/mastery/due events on the card.

Phases 2-4 are listed for completeness but are NOT part of the current implementation contract. Each will have its own spec when it lands.

## Testing

- **Visual regression** — manual gate. Walk through all 9 callers post-Phase 1:
  1. Main Notes view (NotesUI)
  2. EPUB reader sidebar (BookNotesPanel)
  3. Browser sidebar (BrowserSidebar)
  4. Notes slider (NotesSliderView)
  5. MoodBoard diagram (NoteNodeWidget)
  6. Leitner flip card (FlipCard)
  7. Note detail modal (NoteDetailModal)
  8. Leitner list (NotesLeitnerListView)
  9. MoodBoard grid (DetailedMoodBoardPanel)
- **Unit tests** — `NoteCardSurface` is a pure-presentation component; add a small jsdom test verifying gradient color + animation class + hover handlers.
- **Renderer suite** — must remain green (currently 50/300).

## Success criteria

- No prop-API break across the 9 callers — all keep rendering with their existing props.
- Renderer suite stays green.
- Visual identity is recognizably different from MUI default: gradient stripe visible, serif quote, soft layered shadow.
- Hover state moves; entry has staggered choreography.
- User confirms: looks more professional, color comes through, typography hierarchy clear.

## Out of scope (explicit)

- AI-driven color extraction from note content. User explicitly rejected this framing.
- AI-generated micro-illustrations.
- Framer Motion or React Spring as dependencies. CSS-only motion in v1.
- External font loading. System fonts only.
- The 3D tilt hover effect.
- Replacing MUI's input components (TextField, MenuItem, etc.) inside the card.
