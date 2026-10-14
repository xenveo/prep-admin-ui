# Build contract (Coordinator-owned)

Shared contract for all Coders. Do not redesign it; if something here is wrong or missing, stop and report.
Design references: `preppilot-admin-handoff/` (AGENTS.md says `handoff/`; that is this folder). Read `CLAUDE.md`, `docs/design-system.md`, `docs/components.md`, `docs/interaction-and-a11y.md` and, for screens, `docs/screens.md` + the matching `design-source/*.dc.html` (source wins on pixels and strings).

## Stack and rules

- Next.js 16 (App Router, `src/app`), React 19, Tailwind 4, TypeScript strict. `cacheComponents: true` is on. **Read the relevant docs in `node_modules/next/dist/docs/01-app/` before writing Next code** (layouts-and-pages, linking-and-navigating, server-and-client-components, caching, and `03-api-reference` for `useSearchParams`, `useRouter`, `usePathname`, `Link`).
- No new dependencies. No shadcn, no icon packs, no chart libs, no rich-text libs: everything is hand-built to the handoff.
- Tokens live in `src/styles/tokens.css`; Tailwind colour utilities are mapped in `src/app/globals.css` (`bg-surface`, `text-ink-muted`, `border-line`, `bg-primary-tint`, `text-primary-text`, `bg-improve-soft`, `text-ai-text`, `bg-neutral-soft`, `bg-band-nearly-tint`, …). **Never hard-code a colour**; use a token (Tailwind utility or `var(--token)`). Shadows: `shadow-[var(--shadow-panel)]` / `shadow-[var(--shadow-menu)]` only on panels, modals, menus, toasts.
- Helpers: `cn` from `@/lib/cn`; bands from `@/lib/bands` (`Band`, `BAND_LABEL`, `BAND_VAR`, `bandForScore`, `toBand`, `scoreChange`).
- Numbers: tabular figures (already global); numeric columns right-aligned. Missing value = `–` in `text-ink-muted`.
- Copy: sentence case, no hiring language (no reject/pass/fail/hire/shortlist/rank). Red (`--error`) only on destructive buttons and system errors.
- Client components start with `"use client"`. Keep server components free of hooks. Anything that reads `searchParams`/`useSearchParams`/`params` must sit under `<Suspense>` (cacheComponents). Pattern for pages: a sync server `page.tsx` renders `<Suspense fallback={…}><XxxScreen /></Suspense>` where `XxxScreen` is a client component.
- Every interactive element: visible focus (global `:focus-visible` ring; add class `focus-inset` on rows/list items), proper roles/labels per `docs/interaction-and-a11y.md`.
- Do not commit or touch git. Run `npm run typecheck` and `npm run lint` and fix problems in your own files. Imports from files owned by another Coder may be unresolved until that Coder lands; ignore errors that are only "cannot find module" for contract paths below, and report them.

## File layout and owners (Wave 1)

| Path | Owner |
|---|---|
| `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/(admin)/**`, `src/components/layout/**`, `src/lib/theme.ts` | **A** shell and routes |
| `src/lib/types.ts`, `src/services/**`, `src/lib/format.ts`, `src/lib/csv.ts`, `src/lib/use-async.ts`, `src/lib/use-url-state.ts` | **B** data layer |
| `src/components/ui/{icon,avatar,button,status-chip,band-chip,score-cell,change-value,review-badge,tooltip,menu,side-panel,modal,confirm-dialog,toast,empty-state,tabs,segmented-control,switch,stat-strip}.tsx`, `src/lib/use-focus-trap.ts` | **C1** primitives and overlays |
| `src/components/ui/{data-table,bulk-action-bar,filter-bar,saved-filter-chips,checkbox,field,input,textarea,select,role-checklist,drop-zone,weight-bar,tag-input,bullet-list-editor,rich-text-editor,reorderable-list}.tsx` | **C2** tables, forms, editors |
| `src/components/charts/**`, `src/components/media/**` | **C3** charts and media |

Files are kebab-case; one component per file; named exports (no default exports except Next pages/layouts). No barrel files: import by path, e.g. `import { StatusChip } from "@/components/ui/status-chip"`.

## Routes (A creates placeholder pages; Wave 2 fills them)

```
/                                   -> redirect to /candidates
/candidates                         A1/A2/A3 (?invite=one|csv, ?candidate=:id, filters in URL)
/candidates/[candidateId]/sessions/[sessionId]   A8 (?q=2)
/roles                              A4 (?tab=archived)
/roles/[roleId]  (layout: breadcrumb, header, tabs as links)
   /roles/[roleId]/details | cards | questions | settings | preview     (`/roles/[roleId]` redirects to details)
/reports                            A9 (?role=&from=&to=)
/settings/[section]                 admins | ai | privacy | email | audit   (`/settings` redirects to /settings/admins)
```
Route group `src/app/(admin)/` holds everything under the AppShell. Sidebar active key: `'candidates' | 'roles' | 'reports' | 'settings'`, derived from pathname. Sidebar is collapsed by default below 1280px and on the session review route; user preference persisted in localStorage (guarded).

## Component contracts

Common: all components accept `className?: string` unless noted. `ReactNode` from react.

### C1: `src/components/ui/*`

```ts
// icon.tsx — custom 1.8px stroke line icons, currentColor, aria-hidden unless `label` given
export type IconName =
  | "search" | "plus" | "close" | "check" | "check-circle" | "chevron-down" | "chevron-up" | "chevron-left" | "chevron-right"
  | "sort" | "arrow-up" | "arrow-down" | "more" | "mail" | "users" | "briefcase" | "chart" | "settings" | "help"
  | "panel-collapse" | "panel-expand" | "drag" | "upload" | "file" | "play" | "pause" | "lock" | "info" | "trash"
  | "edit" | "bold" | "italic" | "list-bullet" | "list-number" | "link" | "sparkle" | "filter" | "calendar"
  | "download" | "external" | "alert" | "flag" | "sun" | "moon" | "logo-mark" | "volume" | "refresh" | "eye";
export function Icon(props: { name: IconName; size?: 14 | 16 | 18 | 20 | 24; label?: string; className?: string }): JSX.Element;

// avatar.tsx — initials from name; decorative (aria-hidden)
export function Avatar(props: { name: string; size?: 28 | 40; tone?: "neutral" | "primary"; className?: string }): JSX.Element;

// button.tsx
export type ButtonVariant = "primary" | "secondary" | "secondary-teal" | "text" | "destructive";
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;            // default "secondary"
  size?: "md" | "sm";                 // 36px | 32px, min hit area 44px handled via padding/pseudo
  iconLeft?: IconName; iconRight?: IconName;
  disabledReason?: string;            // when set: renders aria-disabled (stays focusable), blocks onClick, shows <Tooltip>
};
export const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;
export function ButtonLink(props: Omit<ButtonProps, "type"> & { href: string }): JSX.Element; // next/link styled as a button

// status-chip.tsx
export type ChipStatus = "draft" | "ai-draft" | "approved" | "archived" | "invite-pending" | "active" | "revoked" | "deactivated";
export const CHIP_LABEL: Record<ChipStatus, string>; // "Draft","AI draft","Approved","Archived","Invite pending","Active","Revoked","Deactivated"
export function StatusChip(props: { status: ChipStatus; className?: string }): JSX.Element;

// band-chip.tsx — tint bg + 8px band dot + ink text; provide band OR score
export function BandChip(props: { band?: Band; score?: number; className?: string }): JSX.Element;

// score-cell.tsx — score (600, right-aligned in 22px min box) + BandChip; null/undefined => "–" with sr-only "No score yet"
export function ScoreCell(props: { score?: number | null; band?: Band }): JSX.Element;

// change-value.tsx — +24 teal / −5 amber (true minus U+2212) / – muted when null; aria-label "Up 24 points since baseline" (prop `since` default "baseline")
export function ChangeValue(props: { value: number | null; since?: string }): JSX.Element;

// review-badge.tsx — "5 to review", AI-draft styling, 600. Renders a next/link when href is given.
export function ReviewBadge(props: { count: number; href?: string; className?: string }): JSX.Element;

// tooltip.tsx — ink bg, 12px text, 6px radius; shows on hover and focus; wires aria-describedby
export function Tooltip(props: { content: ReactNode; children: ReactElement; side?: "top" | "right" | "bottom" | "left" }): JSX.Element;

// menu.tsx — 200px, 36px items, role="menu"; ↑↓ move, Enter activates, Esc closes + refocuses trigger; opens upward near viewport bottom
export type MenuItem = { id: string; label: string; onSelect: () => void; disabled?: boolean; disabledReason?: string /* used as title */; destructive?: boolean; dividerBefore?: boolean };
export function Menu(props: { label: string; items: MenuItem[]; trigger?: ReactNode /* default: ⋯ icon button 32px */; align?: "start" | "end"; triggerClassName?: string }): JSX.Element;
// Also export a controllable variant for table rows:
export function useMenu(): { open: boolean; setOpen(v: boolean): void }; // optional helper, keep if needed

// side-panel.tsx — 560px right, full height, shadow-panel, scrim-panel behind (list stays visible), role="dialog" aria-labelledby.
// Esc closes (innermost layer first: if a Menu/ConfirmDialog is open, they close first — achieve via event.stopPropagation in those layers), scrim click closes,
// Tab trapped while focus is inside, but arrow keys on the list behind still work (scrim must not capture focus). On open focus the close button; on close focus returns to `returnFocusRef` (or the previously focused element).
export function SidePanel(props: {
  open: boolean; onClose: () => void; titleId: string;
  header: ReactNode;                 // avatar/title/chip area; SidePanel renders the close button (and optional `headerActions` before it)
  headerActions?: ReactNode;         // e.g. a <Menu>
  children: ReactNode; footer?: ReactNode;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  scrimClassName?: string;
}): JSX.Element | null;

// modal.tsx — 640px (width prop for others), header with title + close, optional tabs slot, scrollable body, footer (meta note left, actions right). Focus trap, Esc/Cancel close, scrim-modal.
export function Modal(props: {
  open: boolean; onClose: () => void; title: string; titleId?: string; width?: number;
  tabs?: ReactNode; children: ReactNode; footerNote?: ReactNode; footer: ReactNode; // footer = the buttons
  returnFocusRef?: React.RefObject<HTMLElement | null>; initialFocusRef?: React.RefObject<HTMLElement | null>;
}): JSX.Element | null;

// confirm-dialog.tsx — role="alertdialog", 460px, initial focus on Cancel for destructive tone, Esc cancels, stops propagation so a panel behind stays open
export function ConfirmDialog(props: {
  open: boolean; title: string; body: ReactNode; bullets?: string[];
  confirmLabel: string; cancelLabel?: string /* "Cancel" */; tone?: "default" | "destructive";
  onConfirm: () => void; onCancel: () => void; returnFocusRef?: React.RefObject<HTMLElement | null>;
}): JSX.Element | null;

// toast.tsx — provider mounted once in the AppShell (A mounts <ToastProvider>); role="status", ~8s auto-dismiss, pause on hover/focus, dismiss button, optional action link. Bottom-left of main column.
export type ToastInput = { title: string; detail?: string; action?: { label: string; onClick?: () => void; href?: string } };
export function ToastProvider(props: { children: ReactNode }): JSX.Element;
export function useToast(): { show(t: ToastInput): void };

// empty-state.tsx — 56px circle icon on primary-soft, title 16/600, description, one primary action (ReactNode slot), optional helper
export function EmptyState(props: { icon: IconName; title: string; description?: string; action?: ReactNode; helper?: string; className?: string }): JSX.Element;

// tabs.tsx — 40px tall, 24px gap, active = primary-text 600 + 2px bottom border; optional count / ReviewBadge. Two modes:
export type TabItem = { id: string; label: string; count?: number; badge?: ReactNode; href?: string /* route tabs: renders <Link>, aria-selected still set */ };
export function Tabs(props: { items: TabItem[]; activeId: string; onChange?: (id: string) => void; label: string; className?: string; panelId?: string }): JSX.Element; // ←→ Home/End; role tablist/tab

// segmented-control.tsx — radio group in a 2px-padded bg track; selected = surface pill w/ 1px border
export function SegmentedControl<T extends string>(props: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string; size?: "md" | "sm" }): JSX.Element;

// switch.tsx — 44×24 role="switch"; on = primary, off = neutral gray token
export function Switch(props: { checked: boolean; onChange: (v: boolean) => void; label: string /* aria-label if no visible label */; id?: string; disabled?: boolean }): JSX.Element;

// stat-strip.tsx — single bordered row of plain numbers (label 12px muted above value 20/600), no cards/gradients/arrows
export type Stat = { label: string; value: ReactNode; tone?: "default" | "positive" | "attention"; note?: string };
export function StatStrip(props: { stats: Stat[]; className?: string }): JSX.Element;
```

### C2: `src/components/ui/*`

```ts
// checkbox.tsx — custom, role="checkbox", aria-checked true|false|"mixed"; Space toggles
export function Checkbox(props: { checked: boolean | "mixed"; onChange: (next: boolean) => void; label: string; className?: string; disabled?: boolean; onClick?: React.MouseEventHandler }): JSX.Element;

// data-table.tsx — ARIA grid (role grid/row/gridcell/columnheader), roving tabindex (one tab stop), ↑↓ Home End move; Enter/Space on row => onOpenRow; Esc handled by parent; when `activeRowId` is set (panel open), ↑↓ calls onOpenRow for the new row too. Header 40px, rows 44px (52px with `twoLine`), skeleton loading (5 rows), selection column, sort headers (aria-sort + polite live region "Sorted by X, descending"), hidden-until-hover row actions that also show on focus/selection, horizontal scroll inside the container only.
export type Column<T> = {
  id: string; header: ReactNode; headerTooltip?: string; align?: "left" | "right" | "center"; width?: number | string;
  sortable?: boolean; render: (row: T) => ReactNode; skeletonWidth?: number;
};
export type SortState = { columnId: string; direction: "asc" | "desc" };
export type DataTableProps<T> = {
  columns: Column<T>[]; rows: T[]; rowId: (row: T) => string; ariaLabel: string;
  selectable?: boolean; selectedIds?: ReadonlySet<string>; onSelectionChange?: (ids: Set<string>) => void;
  sort?: SortState; onSortChange?: (s: SortState) => void;
  onOpenRow?: (row: T) => void; activeRowId?: string | null;
  loading?: boolean; emptyState?: ReactNode;  // rendered centred inside the body when rows is empty and not loading
  rowActions?: (row: T) => MenuItem[];        // MenuItem from "@/components/ui/menu"; renders ⋯ Menu per row
  twoLine?: boolean; focusRowIdRef?: React.MutableRefObject<((id: string) => void) | null>; // lets parent call focusRow(id) after panel close
  rowClassName?: (row: T) => string | undefined; className?: string;
};
export function DataTable<T>(props: DataTableProps<T>): JSX.Element;

// bulk-action-bar.tsx — primary-tint bar replacing the toolbar when count ≥ 1
export function BulkActionBar(props: {
  count: number; onClear: () => void;
  actions: { id: string; label: string; onClick: () => void; count?: number /* shown as "(n)" and disables at 0 */; disabled?: boolean }[];
  destructive?: { label: string; onClick: () => void };
}): JSX.Element;

// filter-bar.tsx
export type FilterOption = { value: string; label: string };
export type FilterDef = { id: string; label: string; options: FilterOption[]; multi?: boolean };
export function FilterBar(props: {
  search: string; onSearchChange: (v: string) => void; searchPlaceholder: string; searchLabel: string;
  filters: FilterDef[]; values: Record<string, string[]>; onChange: (id: string, values: string[]) => void;
  onClearAll: () => void;
}): JSX.Element; // active filters render as removable pills ("Remove role filter") + "Clear filters"

// saved-filter-chips.tsx
export function SavedFilterChips(props: { items: { id: string; label: string }[]; activeId: string | null; onSelect: (id: string) => void; onSaveCurrent?: () => void }): JSX.Element;

// field.tsx — label + control slot + helper + error (amber, aria-invalid wiring through render prop)
export function Field(props: { label: string; htmlFor?: string; helper?: ReactNode; error?: ReactNode; optional?: boolean; children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode; className?: string }): JSX.Element;
// input.tsx / textarea.tsx / select.tsx — 36px controls, 8px radius, input-line border; invalid = amber border (aria-invalid)
export const Input: React.ForwardRefExoticComponent<React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; iconLeft?: IconName } & React.RefAttributes<HTMLInputElement>>;
export const Textarea: React.ForwardRefExoticComponent<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean } & React.RefAttributes<HTMLTextAreaElement>>;
export const Select: React.ForwardRefExoticComponent<React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean } & React.RefAttributes<HTMLSelectElement>>; // styled native <select>

// role-checklist.tsx
export type RoleChoice = { id: string; title: string; meta: string; status: "approved" | "draft"; approveHref?: string };
export function RoleChecklist(props: { roles: RoleChoice[]; selectedIds: string[]; onChange: (ids: string[]) => void; label: string }): JSX.Element;

// drop-zone.tsx
export function DropZone(props: { onFile: (file: File) => void; accept?: string; title?: string; helper?: string; disabled?: boolean }): JSX.Element;

// weight-bar.tsx
export type WeightPart = { id: string; label: string };
export function WeightBar(props: { label: string; parts: WeightPart[]; values: Record<string, number>; onChange: (v: Record<string, number>) => void }): JSX.Element; // live Total, amber "Total 95%. Must add up to 100%."
export function weightsValid(values: Record<string, number>): boolean;

// tag-input.tsx
export function TagInput(props: { tags: string[]; onChange: (tags: string[]) => void; label: string; placeholder?: string }): JSX.Element;

// bullet-list-editor.tsx
export function BulletListEditor(props: { items: string[]; onChange: (items: string[]) => void; tone: "strong" | "mistake" | "neutral"; label: string; addLabel?: string /* "+ Add point" */ }): JSX.Element;

// rich-text-editor.tsx — contentEditable + toolbar (bold, italic, bullets, numbers, link); value is sanitised HTML string
export function RichTextEditor(props: { value: string; onChange: (html: string) => void; label: string; helper?: string; minHeight?: number }): JSX.Element;

// reorderable-list.tsx — drag (pointer/HTML5) + keyboard (handle button, ↑↓ moves, focus stays, live-region "Card moved to position 3 of 8")
export function ReorderableList<T>(props: {
  items: T[]; itemId: (item: T) => string; onReorder: (items: T[]) => void;
  renderItem: (item: T, ctx: { index: number; selected: boolean; handle: ReactNode }) => ReactNode;
  itemLabel: (item: T, index: number) => string; selectedId?: string; onSelect?: (id: string) => void; ariaLabel: string;
}): JSX.Element;
```

### C3: `src/components/charts/*`, `src/components/media/*`

All charts: `role="img"` + full-text `aria-label`, plus the shared wrapper `ChartFrame` (`charts/chart-frame.tsx`) which renders title/caption, a "Show as table" toggle button (`aria-pressed`) and swaps in a real `<table>` with caption and `scope` headers.

```ts
// charts/chart-frame.tsx
export type TableAlt = { caption: string; columns: string[]; rows: (string | number)[][] };
export function ChartFrame(props: { title?: ReactNode; caption?: ReactNode; table: TableAlt; children: ReactNode; className?: string; toggleLabel?: string }): JSX.Element;
// charts/stacked-band-bar.tsx — counts inside segments, 2px gaps, zero segments omitted, legend below
export function StackedBandBar(props: { label: string; counts: Record<Band, number>; className?: string }): JSX.Element; // no frame; Reports composes two bars + one ChartFrame table
// charts/progress-line-chart.tsx — SVG; dashed thresholds 50/70/85 labelled "50 Developing", "70 Nearly ready", "85 Interview ready"; value labels above points
export function ProgressLineChart(props: { points: { label: string; date: string; score: number }[]; caption: string }): JSX.Element; // wrapped in ChartFrame internally; table = Session, Date, Score, Band
// charts/horizontal-bars.tsx — weakest bar in --improve with amber label
export function HorizontalBars(props: { items: { id: string; label: string; value: number }[]; weakestId?: string; ariaLabel: string; caption: string }): JSX.Element; // wrapped in ChartFrame internally
// charts/sub-score-bars.tsx — 8px bars, neutral-soft track, teal fill, value right-aligned
export function SubScoreBars(props: { scores: { label: string; value: number; weight?: number }[]; className?: string }): JSX.Element;
// charts/score-ring.tsx — 64–72px ring, band-coloured arc, score centred; always paired with a BandChip by the consumer
export function ScoreRing(props: { score: number; size?: 64 | 72; className?: string }): JSX.Element;
// media/audio-waveform.tsx — mock audio: play/pause button (aria-label `Play ${label} audio`), decorative waveform (aria-hidden), role="slider" seek (←→ ±5s), "0:34 / 1:38"; simulates playback with a timer, no real audio file
export function AudioPlayer(props: { label: string; durationSeconds: number; className?: string }): JSX.Element;
// media/transcript-highlights.tsx — real text with <mark>; match = primary-soft + solid teal underline; issue = improve-soft + dashed amber underline; each mark has title + visually hidden "matched: …"/"issue: …"; legend component exported too
export type Highlight = { text: string; kind: "match" | "issue"; note: string };
export function TranscriptHighlights(props: { transcript: string; highlights: Highlight[]; className?: string }): JSX.Element;
export function HighlightLegend(props: { className?: string }): JSX.Element;
// media/flash-card-preview.tsx — candidate-app card, 12px radius, front/back
export function FlashCardPreview(props: { side: "front" | "back"; category: string; question: string; strong: string[]; tip: string; mistakes: string[]; index?: number; total?: number }): JSX.Element;
```

### A: `src/components/layout/*`

```ts
// app-shell.tsx (client) — Sidebar + main; mounts <ToastProvider>; main is flex-1 min-w-0; page never scrolls horizontally
export function AppShell(props: { children: ReactNode }): JSX.Element;
// sidebar.tsx — `active` derived from pathname inside AppShell; props below used by AppShell
export type NavKey = "candidates" | "roles" | "reports" | "settings";
export function Sidebar(props: { active: NavKey | null; collapsed: boolean; onToggle: () => void }): JSX.Element;
// page-header.tsx — title 20/600 + one-line description; at most ONE primaryAction; breadcrumb above; statusChip next to title; meta line
export function PageHeader(props: { title: string; description?: string; primaryAction?: ReactNode; secondaryActions?: ReactNode; breadcrumb?: { label: string; href?: string }[]; statusChip?: ReactNode; meta?: ReactNode; leading?: ReactNode /* e.g. ScoreRing */ }): JSX.Element;
// page-body helper
export function PageContainer(props: { children: ReactNode; className?: string }): JSX.Element; // padding 24px 32px (24px horizontal ≤1024)
// theme-toggle.tsx + lib/theme.ts: system default, `data-theme="light|dark"` override on <html>, persisted (guarded), no flash (inline script in layout head)
```

### B: data layer

- `src/lib/types.ts`: all domain types from `docs/domain-model.md` + view models the screens need, built from `src/data/sample-data.json` (typed loaders; use `Band` from `@/lib/bands`). Include a `source?: "brief" | "illustrative"` passthrough where fixtures have it.
- `src/services/*.ts` (client-callable async functions, ~120ms simulated latency, in-memory singleton store seeded from fixtures, mutations update the store):
  `candidates.ts`: `listCandidates(query?)`, `getCandidate(id)`, `inviteCandidates(batch)`, `resendInvite(ids)`, `revokeInvite(id)`, `deactivateCandidates(ids)`, `assignRoles(ids, roleIds)`, `removeRole(candidateId, roleId)`, `validateInviteRows(rows)`, `exportCandidatesCsv(ids)`, `listSavedFilters()`.
  `roles.ts`: `listRoles()`, `getRole(id)`, `updateRole(id, patch)`, `approveRole(id)`, `archiveRole(id)`, `createRole(input)`, `listFlashCards(roleId)`, `saveFlashCard`, `reorderFlashCards`, `approveFlashCard`, `discardFlashCard`, `draftFlashCardsWithAI(roleId)` (stub), `listQuestions(roleId)`, `saveQuestion`, `evaluateSampleAnswer(questionId, answer)` (stub returning sample result), `getApproveRequirements(roleId)`.
  `sessions.ts`: `getSessionReview(candidateId, sessionId)`, `submitFlag(...)`, `listFlags(sessionId)`.
  `reports.ts`: `getReport({ roleId, from, to })` (weakest dimension computed from averages), `exportReportCsv(...)`.
  `settings.ts`: `getWorkspaceSettings()`, `saveWorkspaceSettings(patch)`, `listAdmins()`, `inviteAdmin`, `changeAdminAccess`, `removeAdmin`, `listAuditEvents(filters)`, `getCurrentAdmin()` (Arjun, super_admin).
- `src/lib/use-async.ts`: `useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | undefined; error: Error | null; loading: boolean; reload: () => void }`.
- `src/lib/use-url-state.ts`: client hook to read/write URL search params with `router.replace` (no scroll) — `useUrlState(): { get(key): string | null; getAll(key): string[]; set(updates: Record<string, string | string[] | null>): void }`.
- `src/lib/format.ts`: `relativeTime(iso, now?)`, `formatDate`, `formatDateTime`, `formatDuration`, `initials(name)`. Fixed "today" = `2026-10-15` from sample data for deterministic output.
- `src/lib/csv.ts`: `parseCsv(text)` handling header row, quoted values, trailing whitespace; `parseInviteCsv(text, approvedRoleNames, existingEmails)` returning rows with `result` per `domain-model.md` (ready | already_invited | invalid_email | unknown_role | role_not_approved | duplicate_in_file), case-insensitive role match, semicolon-separated roles.
- Fixtures are typed, never inlined into components. Illustrative data stays flagged.
