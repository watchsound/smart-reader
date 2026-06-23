# Inline Note Creation in the EPUB Reader

**Date:** 2026-06-21
**Status:** Approved — moving to implementation.

## Problem

The current note-creation flow in the EPUB reader is two-tier:

1. User selects text → `CreateAnnotationDialog` (inline popover with the 6 quick-action icons + Style/Color/Emoji + "Save Highlight").
2. User clicks the Note icon → popover closes → `CreateNoteModal` opens at `maxHeight: 85vh` with Title / Content / Image / Tags / Summary fields.

The second tier covers the reading view and demands structured thinking (title, tags, summary) for what is often a quick capture. The user reports this interrupts reading cognitive flow. Every other established e-reader (Kindle, Apple Books, Play Books, Readwise) does this as a single-tier inline interaction.

## Goal

Capture quick notes without occluding the page, while preserving the existing modal for power-features (title, tags, image, summary).

## Design — Expand-in-Place

The existing `CreateAnnotationPanel` popover grows downward to host an inline text area when the user clicks the Note quick-action. Saving commits highlight + note in one step. A "Open full editor →" link preserves the modal escape hatch.

### UI states

`CreateAnnotationPanel` adds one boolean state: `noteExpanded`.

- **Compact (default).** Identical to today: Quick Actions row → Style → Color → Emoji → "Save Highlight" button.
- **Expanded.** Above plus a `<TextField multiline rows={3}>` below the Emoji section labeled "Add a note (optional)", with a muted "Open full editor →" link below it. The save button label flips from "Save Highlight" to "Save Highlight + Note" while expanded.

Clicking the Note quick-action toggles `noteExpanded`. It does NOT close the popover and does NOT open the modal.

### Selection-type protocol

New value added to the existing `SelectionType` enum:

```js
SelectionType.QuickNote = 'quick-note'
```

`CreateAnnotationPanel.handleWindowClose` is extended with an optional 5th argument carrying the note text. Existing branches ignore it; only `QuickNote` reads it.

```
handleWindowClose(selectionType, style, color, emoji, noteText?)
```

### Save flow

| Trigger | `selectionType` | Behavior in `EPubView.handleAnnotationWindowClose` |
|---|---|---|
| "Save Highlight" with `noteExpanded=false` | `Highlight` | Existing — add annotation, no note created. |
| "Save Highlight + Note" with empty textarea | `Highlight` | Same as above — empty text = no note. |
| "Save Highlight + Note" with text | `QuickNote` | **New** — add the annotation (same as Highlight branch) **and** call `CreateNote` with the text. Close the popover. No modal. |
| "Open full editor →" link | `Note` | Existing — closes popover, opens `CreateNoteModal` with auto-filled passage. |

The `QuickNote` branch in `EPubView` reuses the existing annotation-add path (the one routed through the custom `underline` annotation type with `mtype: 'Highlight'`) and the existing `CreateNote` API.

### What does NOT change

- The 6 quick-action icons stay (Note / Image / Present / SmartSummary / MindMap / ArgumentXray). Their behavior is unchanged EXCEPT the Note icon now toggles expand instead of dispatching `Note` immediately. Power-users reach the modal via "Open full editor →".
- The 4-style selector (Highlight / Underline / Strike / Dash), color picker, emoji picker — unchanged.
- The existing `CreateNoteModal` / `CreateNotePanel` — unchanged. Reachable via the "Open full editor →" link.
- `note2rendition`, save persistence, learning_point linking — all unchanged.

## Testing

Component tests in jsdom for `CreateAnnotationPanel`:

1. **Note icon expands the panel** — initial render has no textarea; after clicking the Note icon a textarea with `aria-label="Add a note (optional)"` appears.
2. **Save with text dispatches `QuickNote`** — type text, click Save → `handleWindowClose` called with `('quick-note', style, color, emoji, 'typed text')`.
3. **Save with empty text falls back to `Highlight`** — expand panel but don't type → click Save → `handleWindowClose` called with `('highlight', ...)`, no 5th arg.
4. **"Open full editor" dispatches `Note`** — click the link → `handleWindowClose` called with `('note', ...)`. (Existing modal path.)
5. **Existing save-button label test** — still passes; in compact mode it tracks `selectedStyle` ("Save Highlight" / "Save Underline" / etc.); in expanded mode it reads "Save Highlight + Note".

No new test in `EPubView` itself — the QuickNote branch is straightforward delegation to the existing annotation-add + CreateNote calls, both of which have integration coverage today.

## Success criteria

- Existing renderer suite stays green (currently 49 suites / 287 tests).
- New panel-level tests pass.
- Manual gate: open EPUB → select text → click Note → textarea appears inline, no modal, panel does not close. Type + Save → highlight + note both persist. Reopen the book → note shows on the highlight.
- Manual gate: click "Open full editor →" → existing modal opens, behaves as today.

## Out of scope (deliberate)

- Anchored margin sticky-notes (Kindle-style positioning). Approach B from the brainstorm. Significant new positioning logic; revisit if the inline expand still feels inadequate.
- Voice-to-text dictation.
- AI-suggested note text based on the highlighted passage. The Brain has the data to do this, but adding it now would re-bloat the surface the user just asked to shrink.
- PDF reader. Same problem exists there but the PDF view uses a different selection-popover component; address separately if needed.
