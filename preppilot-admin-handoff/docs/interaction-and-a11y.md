# Interaction and accessibility

Target: **WCAG 2.1 AA**. These patterns are already prototyped in the canvas source (see the `onKeyDown` handlers in `Candidates.dc.html`, `JobRoles.dc.html`, `RoleQuestions.dc.html`, `CandidatePanel.dc.html`, `RoleCards.dc.html`, `SessionReview.dc.html`).

## Data tables (ARIA grid pattern)

Applies to Candidates, Job roles, Questions, and any table whose rows open something.

| Key | Action |
|---|---|
| Tab | Moves into the grid (to the active or first row), then out of it. One tab stop per grid. |
| ↓ / ↑ | Focus next / previous row. If a side panel is open, it switches to that row's record. |
| Home / End | First / last row. |
| Enter (or Space) on a row | Opens the row's detail (side panel, or the editor page for roles). |
| Esc | Closes the innermost layer: menu → confirm → panel. Focus returns to the row that opened it. |
| Space on the checkbox | Toggles selection (doesn't open the row). |

- Use `role="grid"`, `role="row"`, `role="gridcell"`, `role="columnheader"` with `aria-sort` on the sorted column. (A plain `<table>` with roving focus is fine too.)
- Rows: `tabindex="0"` on the active row, `-1` on others (roving tabindex); `aria-selected` reflects checkbox selection.
- Clicks on checkboxes, ⋯ buttons and menus inside a row must not trigger the row's open action (stop propagation).
- Sortable headers are buttons; announce the new sort ("Sorted by last active, descending") via a polite live region.
- Hidden-until-hover controls (⋯) must also appear on row focus.

## Side panel

- `role="dialog"`, `aria-labelledby` the name heading. Treat it as non-modal for the list's arrow-key switching but trap Tab inside the panel while focus is in it.
- On open, focus the panel heading or close button; on close, return focus to the originating row.
- The list behind stays visible under `--scrim-panel`; clicking the scrim closes the panel.
- Deep-link via URL so refresh and back/forward work.

## Modals and confirmations

- `role="dialog"` (forms) or `role="alertdialog"` (confirmations), `aria-modal="true"`, labelled and described.
- Focus trapped; initial focus on the first field (forms) or **Cancel** (destructive confirmations). Esc cancels.
- Return focus to the trigger on close.

### Destructive confirmation copy pattern

```
Title:  [Verb] [object]?                      e.g. "Deactivate Priya Sharma?"
Body:   What stops working. What is kept. Whether it can be undone.
Buttons: Cancel   [Verb]   ← only this button is red (--error)
```

Required for: Deactivate, Revoke invite, Remove role, Remove admin, Archive role, Discard AI draft, bulk Deactivate (list names and how many pending invites get revoked), shortening data retention, deleting data. Never use "Are you sure?" alone.

## Menus

`aria-haspopup="menu"`, `aria-expanded`; items `role="menuitem"`; ↑ ↓ move, Enter activates, Esc closes and refocuses the trigger. Disabled items keep a `title` explaining why ("Already active").

## Tabs

`role="tablist"` / `tab` / `tabpanel`, ← → move between tabs, Home/End jump. In the role editor, tabs are links to routes and still expose `aria-selected` on the current one.

## Forms

- Every input has a visible `<label>`; helper text linked with `aria-describedby`; errors set `aria-invalid="true"` and are announced.
- Validation errors in this product are amber (`--improve`), not red, because they're "needs fixing", not system failures. System errors (network, server) use `--error`.
- Disabled primary buttons that depend on requirements use `aria-disabled="true"` (still focusable) plus a tooltip with the reason.

## Reorderable lists (flash cards)

Drag handle is a `<button>` with label "Reorder card 4. Use arrow keys to move." ↑ ↓ moves the item; focus stays on the moved item's handle; announce "Card moved to position 3 of 8" in a live region.

## Charts

Every chart has:

1. `role="img"` and an `aria-label` that states the data in words (e.g. "Latest bands: Interview ready 6, Nearly ready 9, Developing 7, Not ready yet 2").
2. A "Show as table" toggle (`aria-pressed`) that swaps in a real `<table>` with caption and `scope` headers.
3. Labels or a legend, never colour alone; stacked segments have 2px gaps and counts.

## Audio

The waveform is decorative (`aria-hidden`). The player needs a real Play/Pause button with an accessible name ("Play first try audio"), a seekable slider (`role="slider"` with arrow-key steps of 5s), and a time readout. Transcripts are the text alternative.

## Highlights in transcripts

Use `<mark>`. Matched evidence and issues differ by fill **and** underline style (solid teal vs dashed amber), and each mark carries a description (tooltip + visually hidden text like "matched: takes ownership").

## Toasts

`role="status"` (polite), auto-dismiss after ~8s, pause on hover and focus, dismiss button with a label. Never put the only path to an action inside a toast.

## Focus and contrast

- Focus ring: 2px `--primary`, offset 2px (inset −2px for rows). Visible in light and dark.
- Text contrast ≥ 4.5:1 everywhere (all token pairs were checked); band colours never carry text directly.
- Hit targets ≥ 44px where possible; 32px icon buttons sit inside 44px rows.

## Responsive

- 1440: full layout. 1280 and below: sidebar collapses by default. 1024: side panel still 560px over the list; three-column editors (A6, A8) wrap the right column below.
- Wide tables scroll horizontally inside their container; the page never does.
- Mobile is view-only and low priority: stack the sidebar into a top menu, hide bulk actions and editors.
