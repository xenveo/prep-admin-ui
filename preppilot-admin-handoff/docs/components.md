# Component inventory

Build these first; every screen composes them. Visual reference: `design-source/Components.dc.html` (light) and `ComponentsDark.dc.html` (dark). Names below are suggestions; match your codebase's conventions.

## App shell

### `AppShell`
Sidebar + main column. Flex row; main is `flex: 1; min-width: 0`. Wide tables scroll inside their own container; the page never scrolls horizontally.

### `Sidebar`
- **Props:** `active: 'candidates' | 'roles' | 'reports' | 'settings'`, `collapsed: boolean`, `onToggle`.
- **Expanded (240px):** logo mark + "PrepPilot", collapse button; nav items Candidates, Job roles, Reports, Settings; bottom: Help, admin avatar (initials on `--primary-soft`), name and title.
- **Collapsed (64px):** icon-only items with `aria-label` and tooltip, expand button at the bottom.
- **States:** active (`--primary-soft` bg, `--primary-text`, 600), hover (`--neutral-soft`), focus ring inset.
- Nav items are links with `aria-current="page"` on the active one. Collapse state is a per-user preference (localStorage is fine).
- Source: `design-source/Sidebar.dc.html`.

### `PageHeader`
- **Props:** `title`, `description`, `primaryAction?`, `secondaryActions?`, `breadcrumb?`, `statusChip?`, `meta?`.
- Title 20/600, description in `--ink-muted`. At most **one** primary button. Role editor and session review add a breadcrumb above and a status chip next to the title.

## Data display

### `DataTable`
The core of the product. Implement once, reuse everywhere.
- **Props:** `columns` (id, header, align, width, sortable, render), `rows`, `rowId`, `selectable`, `selectedIds`, `onSelectionChange`, `sort`, `onSortChange`, `onOpenRow`, `activeRowId`, `loading`, `emptyState`, `rowActions?`.
- **Anatomy:** header row 40px (12/600 `--ink-muted`, sentence case), body rows 44px (52px for two-line cells), 1px `--line` dividers, white surface, 8px radius container.
- **Row states:** default, hover (`--row-hover`), selected (`--primary-tint`), active/open (`--primary-tint`, name 600), keyboard focus (2px inset ring).
- **Sorting:** header is a button; sorted column shows a teal arrow and `aria-sort`; others show a neutral up/down glyph.
- **Selection:** custom checkbox (`role="checkbox"`, `aria-checked` true/false/mixed); header checkbox shows mixed when some rows are selected.
- **Row actions:** ⋯ button (32px) visible on hover/focus/selection, opens a `Menu`.
- **Loading:** 5 skeleton rows using `--line` bars sized like the column content.
- **Empty / no results:** centred message inside the table body (see `EmptyState`).
- **Numbers:** right-aligned, tabular figures.
- **Keyboard:** ARIA grid pattern, see `interaction-and-a11y.md`.

### `BulkActionBar`
Replaces the table toolbar when ≥1 row is selected. `--primary-tint` bg, "N selected" (600, `--primary-text`), Clear link, divider, secondary buttons, destructive action right-aligned in `--error` text. Actions that only apply to some rows show a count, e.g. "Resend invites (1)", and disable when the count is 0.

### `StatusChip`
- **Props:** `status: 'draft' | 'ai-draft' | 'approved' | 'archived' | 'invite-pending' | 'active' | 'revoked' | 'deactivated'`.
- Styles in `design-system.md` › Chips. Never accept arbitrary colours.

### `BandChip`
- **Props:** `band` (or `score` → band). Tint bg + 8px dot + ink text. Labels exactly "Interview ready", "Nearly ready", "Developing", "Not ready yet".

### `ScoreCell`
Score (600, right-aligned in a 22px min box) + `BandChip`. `–` with "No score yet" accessible label when absent.

### `ChangeValue`
`+24` teal / `−5` amber / `–` muted. Accessible label "Up 24 points since baseline".

### `ReviewBadge`
"5 to review": AI-draft styling, weight 600; links to the content that needs review.

### `Avatar`
Initials, 28px in tables, 40px in panel header, `--neutral-soft` bg (admin avatar uses `--primary-soft`). Decorative (`aria-hidden`); the name is the label.

### `StatStrip`
A single bordered row of plain numbers (label 12px muted above value 20/600). No cards, no gradients, no trend arrows. Used in Reports and Session review.

## Overlays

### `SidePanel`
560px, right-aligned, full height, `--shadow-panel`, scrim `--scrim-panel` (list visible behind). `role="dialog"` with `aria-labelledby`. Header (avatar/title/status chip, ⋯ menu, close), scrollable body, optional sticky footer. Esc closes and returns focus to the row that opened it. While open, ↑ ↓ on the list switches which record the panel shows.

### `Modal`
640px (invite) with header, tabs, scrollable body, footer (secondary left of primary, right-aligned; optional meta note on the left). Scrim `--scrim-modal`. Focus trapped; Esc and Cancel close.

### `ConfirmDialog`
`role="alertdialog"`, 440–480px. Props: `title`, `body`, `bullets?`, `confirmLabel`, `tone: 'default' | 'destructive'`. Destructive tone = red confirm button only. Initial focus on Cancel for destructive dialogs. Copy patterns in `interaction-and-a11y.md`.

### `Menu`
200px, 4px padding, 36px items, `--shadow-menu`. Disabled items in `--ink-muted` with a `title` explaining why. Destructive item last, after a divider, in `--error`.

### `Toast`
Bottom-left of the main column (left = sidebar width + 32px), 380px max. `--toast-bg`, check icon in `--toast-icon`, title 600 + one line of detail + optional link, dismiss button. `role="status"`, auto-dismiss after ~8s, pauses on hover/focus.

### `Tooltip`
Ink background, white 12px text, 6px radius. Used for disabled-button reasons ("Add at least 5 questions with rubrics") and collapsed nav. Linked with `aria-describedby`.

## Inputs and editors

### `FilterBar`
Search input (280px, leading icon), filter buttons (Role multi-select, Band, Status, Last active), active filters become removable pills (`--primary-tint` bg, teal border, × button with "Remove role filter" label), "Clear filters" text button when any filter is active.

### `SavedFilterChips`
28px chip buttons with `aria-pressed`; active = `--primary-soft`. "+ Save current filters" ghost button.

### `Tabs`
40px tall, 24px gap, active = `--primary-text` 600 + 2px bottom border. Optional count and `ReviewBadge`. `role="tablist"`/`tab`/`tabpanel`. In the role editor tabs are routes.

### `SegmentedControl`
Radio group in a 2px-padded `--bg` track; selected item is a surface pill with a 1px border. Used for Fixed/Random, Easy/Medium/Hard, STAR/Problem-solution/Free, Short/Standard, All/Need fixing.

### `Switch`
44×24, `role="switch"`, on = `--primary`, off = `#9CA3AF`.

### `RichTextEditor`
Toolbar: Bold, Italic | Bulleted list, Numbered list, Link (32px icon buttons with `aria-pressed`). Content min-height 168px. Output should be sanitised HTML or Markdown.

### `BulletListEditor`
Ordered list of single-line inputs with a coloured dot (teal for "strong answer", amber for "common mistakes"), remove button per row, "+ Add point". Empty points are dropped on save.

### `TagInput`
Chips with remove buttons + inline input; Enter adds, Backspace on empty input removes the last tag.

### `WeightBar`
Segmented bar (28px, 2px gaps) showing percentages, plus one numeric input per segment and a live "Total 100%" status. Shows an amber "Total 95%. Must add up to 100%." message and blocks save when ≠ 100. Used for session weights (3 parts) and dimension weights (4 parts).

### `RoleChecklist`
Bordered list of roles with custom checkboxes and meta ("12 cards · 15 questions"). Draft roles are disabled with a Draft chip and an "Approve this role first" link. Archived roles are hidden.

### `DropZone`
Dashed 1.5px border, `--bg` fill, upload icon, "Drop a CSV or browse" (browse is a button), helper line. Highlight border `--primary` on drag-over.

### `ReorderableList`
Drag handle button (6-dot) per item; ↑ ↓ on the focused handle moves the item and keeps focus on it; announce the new position via a live region.

## Charts and media

### `StackedBandBar`
Horizontal bar of the four bands with 2px gaps, counts inside segments, legend below, `role="img"` with a full text `aria-label`, and a "Show as table" toggle. Zero-count segments are omitted.

### `ProgressLineChart`
Session scores over sessions; dashed threshold lines at 50 / 70 / 85 labelled "50 Developing", "70 Nearly ready", "85 Interview ready"; value labels above points; caption names the role. Table alternative: Session, Date, Score, Band.

### `HorizontalBars`
Dimension averages 0–100 with value labels; weakest bar in `--improve` with label also amber. Table alternative.

### `SubScoreBars`
Content / Structure / Delivery / Relevance, 8px bars on `--neutral-soft` track, teal fill, value right-aligned. Shared with the candidate app.

### `ScoreRing`
64–72px ring, `--line` track, band-coloured arc, score centred 20–22/700. Always paired with a `BandChip` (the ring alone isn't enough contrast for Nearly ready).

### `AudioWaveform`
Play button (32px, primary) + bar waveform (3px bars, played part teal, rest muted) + "0:34 / 1:38". Waveform is decorative; the player needs real controls (play/pause, seek with arrow keys, time readout).

### `TranscriptHighlights`
Transcript text with `<mark>` spans: matched rubric evidence = `--primary-soft` fill + solid teal underline; issue = `--improve-soft` fill + dashed amber underline. Each mark has a tooltip/`title` naming the rubric point or issue. A legend sits above.

### `FlashCardPreview`
Candidate-app card, 12px radius, 20px padding. Front: category chip, question 18/26 600, "Tap to flip · Card 4 of 8". Back: "A strong answer" bullets (teal heading), Tip box (`--primary-tint`), "Common mistakes" (amber heading). Swap for the candidate app's real component if one exists.

### `EmptyState`
56px circle icon on `--primary-soft`, title 16/600, one-line description, one primary action, optional helper line.
