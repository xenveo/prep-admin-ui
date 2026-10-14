# Implementation plan

Stack-agnostic. Pick the stack that fits the target repo (the designs map cleanly onto React + any CSS approach; `tokens/tailwind.preset.js` is there if the repo uses Tailwind). Each phase ends with a **checkpoint**: stop, show the result, wait for review.

## Phase 0 · Orient (no code)

- Read `CLAUDE.md`, `docs/design-system.md`, `docs/components.md`, `docs/interaction-and-a11y.md`.
- Inspect the repo: framework, router, styling, test setup, existing components.
- Propose: stack choices, folder layout, how fixtures from `data/sample-data.json` will be loaded (mock service layer recommended), and which existing components (if any) map to `components.md`.
- **Checkpoint:** a short plan the owner approves.

## Phase 1 · Foundations

- Install tokens (`tokens.css` globally; Tailwind preset if applicable). Font loading for Plus Jakarta Sans with fallback.
- Theme switching: system default + `data-theme` override.
- Mock data layer: typed fixtures from `sample-data.json` behind service functions (`listCandidates`, `getCandidate`, `listRoles`, …) that return promises, so a real API can replace them later.
- `AppShell`, `Sidebar` (expanded/collapsed, persisted), `PageHeader`, routing skeleton for all routes in `screens.md`.
- **Checkpoint:** empty pages with working nav in light and dark at 1440 and 1024.

## Phase 2 · Shared components

Build in this order, each with stories/examples covering every state listed in `components.md`:

1. `StatusChip`, `BandChip`, `ScoreCell`, `ChangeValue`, `ReviewBadge`, `Avatar`
2. Buttons (primary, secondary, secondary-teal, text, destructive), `Tooltip`, `Menu`
3. `DataTable` with sort, selection, row actions, loading, empty, and the full keyboard grid model
4. `BulkActionBar`, `FilterBar`, `SavedFilterChips`
5. `SidePanel`, `Modal`, `ConfirmDialog`, `Toast`
6. `Tabs`, `SegmentedControl`, `Switch`, inputs, `RoleChecklist`, `DropZone`
7. `RichTextEditor`, `BulletListEditor`, `TagInput`, `WeightBar`, `ReorderableList`
8. `StatStrip`, `StackedBandBar`, `ProgressLineChart`, `HorizontalBars`, `SubScoreBars`, `ScoreRing` (each with table alternative)
9. `AudioWaveform` player, `TranscriptHighlights`, `FlashCardPreview`, `EmptyState`

- Recreate the component sheet as a page (or Storybook) in light and dark and compare it with `design-source/Components.dc.html` / screenshots.
- **Checkpoint:** component sheet review + automated a11y checks (axe) passing.

## Phase 3 · Candidates flow (A1, A2, A3)

- A1 table with all columns, filters in URL, saved filters, bulk bar, row menu, every state (default, selected, no results, first-use empty, loading, error).
- A2 invite modal: one-by-one with live validation; CSV upload with client-side parsing and the validation preview; success toast. Services stubbed.
- A3 side panel: Priya (active) and Karan (invite pending) variants, chart with table toggle, sessions linking to A8, activity, all confirmations.
- **Checkpoint:** keyboard-only walkthrough: open, arrow through candidates with the panel open, Esc back to the row; invite flow end to end.

## Phase 4 · Job roles and editor (A4, A5, A6, A7)

- A4 list with Active/Archived tabs and empty state.
- A5 Details (rich text, tags, AI card) and Settings (weights with validation); approve gating + tooltip + approve dialog.
- A6 flash cards: list with reorder (mouse + keyboard), editor, live preview, approve/discard AI drafts, tab badge counts.
- A7 questions table + side panel rubric editor + test evaluation (stub the AI call; render the sample result).
- **Checkpoint:** approve a role end to end against mocks; AI drafts never leak into "candidate preview".

## Phase 5 · Session review and reports (A8, A9)

- A8 with question list, two-try comparison, audio player (mock audio), highlights, sub-scores, applied-from-feedback, delivery metrics, flag form + history.
- A9 with stat strip, band bars (latest vs baseline), hardest questions, dimension bars with computed weakest dimension and note, needs-attention table opening A3.
- **Checkpoint:** every chart's table toggle works; numbers match `sample-data.json`.

## Phase 6 · Settings (A10)

- Subnav sections, Admins table + invite admin, AI and voice, Data and privacy (with retention confirm), Email preview, Audit log with filters. Respect Super admin gating.
- **Checkpoint:** settings review.

## Phase 7 · Hardening

- Full audit against the final review list:
  - one primary action per header (empty states hide it)
  - lists are tables, detail opens in side panels (except A5–A8)
  - consistent chips and colours; no red for scores or statuses
  - AI content labelled "AI draft" until approved
  - preparedness language only (grep for reject|pass|fail|hire|shortlist)
  - destructive actions confirm with exact impact
  - tabular, right-aligned numbers
  - arrow / Enter / Esc navigation on every interactive table
  - chart table alternatives
- axe on every route in light and dark; keyboard walkthrough script; 1024 layout pass; visual comparison with screenshots.
- Replace illustrative data paths with real API contracts once the backend exists (see `open-questions.md`).
