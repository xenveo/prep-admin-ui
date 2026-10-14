"use client";

import { useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ProgressLineChart } from "@/components/charts/progress-line-chart";
import { HorizontalBars } from "@/components/charts/horizontal-bars";
import { ChartFrame } from "@/components/charts/chart-frame";
import { ScoreRing } from "@/components/charts/score-ring";
import { StackedBandBar } from "@/components/charts/stacked-band-bar";
import { SubScoreBars } from "@/components/charts/sub-score-bars";
import { AudioPlayer } from "@/components/media/audio-waveform";
import { FlashCardPreview } from "@/components/media/flash-card-preview";
import { HighlightLegend, TranscriptHighlights } from "@/components/media/transcript-highlights";
import { Avatar } from "@/components/ui/avatar";
import { BandChip } from "@/components/ui/band-chip";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { BulletListEditor } from "@/components/ui/bullet-list-editor";
import { Button, ButtonLink } from "@/components/ui/button";
import { ChangeValue } from "@/components/ui/change-value";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column, type SortState } from "@/components/ui/data-table";
import { DropZone } from "@/components/ui/drop-zone";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import { Icon, type IconName } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Menu } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { ReorderableList } from "@/components/ui/reorderable-list";
import { ReviewBadge } from "@/components/ui/review-badge";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { RoleChecklist } from "@/components/ui/role-checklist";
import { SavedFilterChips } from "@/components/ui/saved-filter-chips";
import { ScoreCell } from "@/components/ui/score-cell";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { SidePanel } from "@/components/ui/side-panel";
import { StatStrip } from "@/components/ui/stat-strip";
import { CHIP_LABEL, StatusChip, type ChipStatus } from "@/components/ui/status-chip";
import { Switch } from "@/components/ui/switch";
import { Tabs } from "@/components/ui/tabs";
import { TagInput } from "@/components/ui/tag-input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { WeightBar } from "@/components/ui/weight-bar";
import { BAND_LABEL, type Band } from "@/lib/bands";
import { SAMPLE_CANDIDATES, SAMPLE_HIGHLIGHTS, SAMPLE_TRANSCRIPT, type SampleCandidate } from "./sample";
import { SheetSection, Specimen } from "./sheet-parts";

const BANDS: Band[] = ["ready", "nearly", "developing", "not_ready"];
const CHIPS = Object.keys(CHIP_LABEL) as ChipStatus[];
const ICONS: IconName[] = [
  "search", "plus", "close", "check", "check-circle", "chevron-down", "chevron-up", "chevron-left", "chevron-right", "sort",
  "arrow-up", "arrow-down", "more", "mail", "users", "briefcase", "chart", "settings", "help", "panel-collapse", "panel-expand",
  "drag", "upload", "file", "play", "pause", "lock", "info", "trash", "edit", "bold", "italic", "list-bullet", "list-number",
  "link", "sparkle", "filter", "calendar", "download", "external", "alert", "flag", "sun", "moon", "logo-mark", "volume", "refresh", "eye",
];

const COLUMNS: Column<SampleCandidate>[] = [
  {
    id: "name",
    header: "Name",
    sortable: true,
    render: (c) => (
      <span className="flex items-center gap-2.5">
        <Avatar name={c.name} size={28} />
        <span className="flex flex-col">
          <span className="font-semibold leading-[18px]">{c.name}</span>
          <span className="text-xs leading-4 text-ink-muted">{c.email}</span>
        </span>
      </span>
    ),
  },
  { id: "status", header: "Status", sortable: true, render: (c) => <StatusChip status={c.status} /> },
  { id: "sessions", header: "Sessions", align: "right", render: (c) => c.sessions },
  { id: "score", header: "Latest score", render: (c) => <ScoreCell score={c.score} band={c.band} /> },
  { id: "change", header: "Since baseline", align: "right", headerTooltip: "Change since baseline", render: (c) => <ChangeValue value={c.change} /> },
  { id: "last", header: "Last active", sortable: true, render: (c) => c.last },
];

const ROW_ACTIONS = () => [
  { id: "a", label: "Resend invite", onSelect: () => {} },
  { id: "b", label: "Assign roles", onSelect: () => {} },
  { id: "c", label: "Deactivate", destructive: true, dividerBefore: true, onSelect: () => {} },
];

const FILTERS = [
  { id: "role", label: "Role", multi: true, options: [{ value: "csa", label: "Customer Support Associate" }, { value: "jda", label: "Junior Data Analyst" }] },
  { id: "band", label: "Band", options: BANDS.map((b) => ({ value: b, label: BAND_LABEL[b] })) },
];

function TableStates() {
  const [sort, setSort] = useState<SortState>({ columnId: "last", direction: "desc" });
  const [selected, setSelected] = useState<Set<string>>(new Set(["c3", "c4"]));
  return (
    <div className="flex flex-col gap-6">
      <Specimen label="Default, sortable, with row menu and selection (bulk bar replaces toolbar)" className="w-full">
        <div className="w-full overflow-hidden rounded-md border border-line bg-surface">
          {selected.size > 0 && (
            <BulkActionBar
              count={selected.size}
              onClear={() => setSelected(new Set())}
              actions={[
                { id: "assign", label: "Assign roles", onClick: () => {} },
                { id: "resend", label: "Resend invites", count: 1, onClick: () => {} },
              ]}
              destructive={{ label: "Deactivate", onClick: () => {} }}
            />
          )}
          <DataTable
            ariaLabel="Sample candidates"
            columns={COLUMNS}
            rows={SAMPLE_CANDIDATES}
            rowId={(c) => c.id}
            selectable
            selectedIds={selected}
            onSelectionChange={setSelected}
            sort={sort}
            onSortChange={setSort}
            onOpenRow={() => {}}
            rowActions={ROW_ACTIONS}
            twoLine
          />
        </div>
      </Specimen>
      <div className="grid gap-6 min-[900px]:grid-cols-2">
        <Specimen label="Loading skeleton" className="w-full">
          <div className="w-full overflow-hidden rounded-md border border-line bg-surface">
            <DataTable ariaLabel="Loading example" columns={COLUMNS} rows={[]} rowId={(c) => c.id} loading />
          </div>
        </Specimen>
        <Specimen label="Empty (filtered, no results)" className="w-full">
          <div className="w-full overflow-hidden rounded-md border border-line bg-surface">
            <DataTable
              ariaLabel="Empty example"
              columns={COLUMNS}
              rows={[]}
              rowId={(c) => c.id}
              emptyState={
                <div className="flex flex-col items-center gap-3 py-8 text-ink-muted">
                  <span>No candidates match these filters.</span>
                  <Button size="sm">Clear filters</Button>
                </div>
              }
            />
          </div>
        </Specimen>
      </div>
    </div>
  );
}

function FormsAndEditors() {
  const [tab, setTab] = useState("one");
  const [seg, setSeg] = useState<"short" | "standard">("standard");
  const [on, setOn] = useState(true);
  const [check, setCheck] = useState<boolean | "mixed">("mixed");
  const [tags, setTags] = useState(["SQL", "Dashboards"]);
  const [bullets, setBullets] = useState(["Names a concrete result", "Explains own contribution"]);
  const [mistakes, setMistakes] = useState(["Describes the team, not themselves"]);
  const [html, setHtml] = useState("<p>Builds <b>weekly reports</b> and answers questions from the team.</p>");
  const [weights, setWeights] = useState<Record<string, number>>({ content: 45, structure: 20, delivery: 20, relevance: 10 });
  const [roles, setRoles] = useState<string[]>(["r1"]);
  const [items, setItems] = useState([{ id: "1", t: "Tell me about yourself" }, { id: "2", t: "A time you handled conflict" }, { id: "3", t: "Why this role?" }]);
  const [selItem, setSelItem] = useState("2");
  const [filters, setFilters] = useState<Record<string, string[]>>({ role: ["jda"], band: [] });
  const [search, setSearch] = useState("");
  const [savedId, setSavedId] = useState<string | null>("all");
  const [tabId, setTabId] = useState("active");
  return (
    <div className="flex flex-col gap-6">
      <Specimen label="Filter bar with active pills" className="w-full">
        <div className="w-full">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search name or email"
            searchLabel="Search candidates"
            filters={FILTERS}
            values={filters}
            onChange={(id, v) => setFilters((f) => ({ ...f, [id]: v }))}
            onClearAll={() => setFilters({ role: [], band: [] })}
          />
        </div>
      </Specimen>
      <Specimen label="Saved filter chips">
        <SavedFilterChips
          items={[{ id: "all", label: "All candidates" }, { id: "nr", label: "Not ready yet" }, { id: "pend", label: "Invite pending" }]}
          activeId={savedId}
          onSelect={setSavedId}
          onSaveCurrent={() => {}}
        />
      </Specimen>
      <Specimen label="Tabs (state mode, with count and review badge)" className="w-full">
        <div className="w-full">
          <Tabs
            label="Sample tabs"
            activeId={tabId}
            onChange={setTabId}
            items={[
              { id: "active", label: "Active", count: 3 },
              { id: "cards", label: "Cards", badge: <ReviewBadge count={5} /> },
              { id: "archived", label: "Archived" },
            ]}
          />
        </div>
      </Specimen>
      <div className="grid gap-6 min-[900px]:grid-cols-2">
        <Specimen label="Inputs: default, invalid, disabled, select, textarea" className="w-full">
          <div className="flex w-full flex-col gap-3">
            <Field label="Email" helper="We send the invite here.">
              {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} placeholder="name@company.com" iconLeft="mail" />}
            </Field>
            <Field label="Email" error="Enter a valid email">
              {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} invalid={invalid} defaultValue="priya@" />}
            </Field>
            <Field label="Disabled" optional>
              {({ id }) => <Input id={id} disabled defaultValue="Locked value" />}
            </Field>
            <Field label="Select">
              {({ id }) => (
                <Select id={id} defaultValue="30">
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                </Select>
              )}
            </Field>
            <Field label="Notes">{({ id }) => <Textarea id={id} rows={2} defaultValue="A short note." />}</Field>
          </div>
        </Specimen>
        <Specimen label="Toggles: segmented, switch (on/off/disabled), checkbox (mixed/on/off)" className="w-full">
          <div className="flex w-full flex-col items-start gap-3">
            <SegmentedControl label="Feedback length" options={[{ value: "short", label: "Short" }, { value: "standard", label: "Standard" }]} value={seg} onChange={setSeg} />
            <span className="inline-flex items-center gap-3">
              <Switch label="Candidates can delete their data" checked={on} onChange={setOn} />
              <Switch label="Off example" checked={false} onChange={() => {}} />
              <Switch label="Disabled example" checked disabled onChange={() => {}} />
            </span>
            <span className="inline-flex items-center gap-4">
              <Checkbox label="Mixed" checked={check} onChange={(n) => setCheck(n)} />
              <Checkbox label="Checked" checked onChange={() => {}} />
              <Checkbox label="Unchecked" checked={false} onChange={() => {}} />
              <Checkbox label="Disabled" checked={false} disabled onChange={() => {}} />
            </span>
            <SegmentedControl label="Small" size="sm" options={[{ value: "one", label: "One" }, { value: "two", label: "Two" }]} value={tab} onChange={setTab} />
          </div>
        </Specimen>
      </div>
      <div className="grid gap-6 min-[900px]:grid-cols-2">
        <Specimen label="Rich text editor" className="w-full">
          <div className="w-full">
            <RichTextEditor label="Role description" value={html} onChange={setHtml} helper="Candidates see this text." minHeight={96} />
          </div>
        </Specimen>
        <Specimen label="Tag input" className="w-full">
          <div className="w-full">
            <TagInput label="Key skills" tags={tags} onChange={setTags} placeholder="Add a skill" />
          </div>
        </Specimen>
        <Specimen label="Bullet list editors: strong and mistake" className="w-full">
          <div className="flex w-full flex-col gap-3">
            <BulletListEditor label="Strong answer points" tone="strong" items={bullets} onChange={setBullets} />
            <BulletListEditor label="Common mistakes" tone="mistake" items={mistakes} onChange={setMistakes} />
          </div>
        </Specimen>
        <Specimen label="Weight bar (total 95%, invalid)" className="w-full">
          <div className="w-full">
            <WeightBar
              label="Score weights"
              parts={[{ id: "content", label: "Content" }, { id: "structure", label: "Structure" }, { id: "delivery", label: "Delivery" }, { id: "relevance", label: "Relevance" }]}
              values={weights}
              onChange={setWeights}
            />
          </div>
        </Specimen>
        <Specimen label="Role checklist (approved, draft disabled)" className="w-full">
          <div className="w-full">
            <RoleChecklist
              label="Assign roles"
              selectedIds={roles}
              onChange={setRoles}
              roles={[
                { id: "r1", title: "Customer Support Associate", meta: "12 cards · 15 questions", status: "approved" },
                { id: "r2", title: "Sales Development Rep", meta: "8 cards · 10 questions", status: "draft", approveHref: "#" },
              ]}
            />
          </div>
        </Specimen>
        <Specimen label="Reorderable list" className="w-full">
          <div className="w-full">
            <ReorderableList
              ariaLabel="Questions"
              items={items}
              itemId={(i) => i.id}
              onReorder={setItems}
              itemLabel={(i) => i.t}
              selectedId={selItem}
              onSelect={setSelItem}
              renderItem={(i, { index, handle }) => (
                <span className="flex items-center gap-2 text-sm">
                  {handle}
                  <span className="text-ink-muted">{index + 1}</span>
                  {i.t}
                </span>
              )}
            />
          </div>
        </Specimen>
        <Specimen label="Drop zone" className="w-full">
          <div className="w-full">
            <DropZone onFile={() => {}} accept=".csv" title="Drop a CSV or browse" helper="One person per row." />
          </div>
        </Specimen>
      </div>
    </div>
  );
}

function Overlays() {
  const toast = useToast();
  const [panel, setPanel] = useState(false);
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState<"default" | "destructive" | null>(null);
  const panelRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="flex flex-col gap-4">
      <Specimen label="Triggers">
        <Button ref={panelRef} onClick={() => setPanel(true)}>Open side panel</Button>
        <Button onClick={() => setModal(true)}>Open modal</Button>
        <Button onClick={() => setConfirm("default")}>Default confirm</Button>
        <Button variant="destructive" onClick={() => setConfirm("destructive")}>Destructive confirm</Button>
        <Button onClick={() => toast.show({ title: "Settings saved" })}>Toast</Button>
        <Button onClick={() => toast.show({ title: "3 invites sent", detail: "1 was skipped because it was already active.", action: { label: "View candidates", href: "/candidates" } })}>
          Toast with action
        </Button>
      </Specimen>
      <Specimen label="Menu (default trigger, custom trigger, disabled item) and tooltip">
        <Menu label="Row actions" items={[{ id: "a", label: "Change access", onSelect: () => {} }, { id: "b", label: "Resend invite", disabled: true, disabledReason: "Already active", onSelect: () => {} }, { id: "c", label: "Remove admin", destructive: true, dividerBefore: true, onSelect: () => {} }]} />
        <Menu label="More options" trigger={<span>More options</span>} items={[{ id: "a", label: "Export CSV", onSelect: () => {} }]} triggerClassName="rounded-md border border-line px-3 py-1.5 text-sm" />
        <Tooltip content="Change since baseline">
          <Button variant="text" iconLeft="info">Hover or focus me</Button>
        </Tooltip>
      </Specimen>
      <SidePanel
        open={panel}
        onClose={() => setPanel(false)}
        titleId="cs-panel-title"
        returnFocusRef={panelRef}
        header={
          <span className="flex items-center gap-3">
            <Avatar name="Priya Sharma" size={40} />
            <span id="cs-panel-title" className="font-semibold">Priya Sharma</span>
            <StatusChip status="active" />
          </span>
        }
        footer={<Button onClick={() => setPanel(false)}>Close</Button>}
      >
        <p className="m-0 text-sm text-ink-muted">Panel body. The list stays visible and keyboard navigable behind the scrim.</p>
      </SidePanel>
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Invite candidates"
        footerNote="Nothing is sent until you confirm"
        tabs={<Tabs label="Invite mode" activeId="one" items={[{ id: "one", label: "One by one" }, { id: "csv", label: "Upload CSV" }]} />}
        footer={<><Button onClick={() => setModal(false)}>Cancel</Button><Button variant="primary" onClick={() => setModal(false)}>Send 1 invite</Button></>}
      >
        <Field label="Email">{({ id }) => <Input id={id} placeholder="name@example.com" />}</Field>
      </Modal>
      <ConfirmDialog
        open={confirm === "default"}
        title="Save these changes?"
        body="The new settings apply to every candidate straight away."
        confirmLabel="Save changes"
        onCancel={() => setConfirm(null)}
        onConfirm={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "destructive"}
        tone="destructive"
        title="Deactivate Priya Sharma?"
        body="She can no longer log in. Her scores and sessions are kept. You can reactivate her later."
        confirmLabel="Deactivate"
        onCancel={() => setConfirm(null)}
        onConfirm={() => setConfirm(null)}
      />
    </div>
  );
}

export function ComponentSheet() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Component sheet"
        description="Every shared component in its states. Use the theme toggle to review light and dark."
        secondaryActions={<ThemeToggle />}
      />

      <SheetSection id="layout" title="App shell and page header">
        <div className="grid gap-4 min-[900px]:grid-cols-2">
          <Specimen label="Sidebar expanded, Settings active">
            <div className="h-[460px] overflow-hidden rounded-md border border-line">
              <Sidebar active="settings" collapsed={false} onToggle={() => {}} />
            </div>
          </Specimen>
          <Specimen label="Sidebar collapsed, Candidates active">
            <div className="h-[460px] overflow-hidden rounded-md border border-line">
              <Sidebar active="candidates" collapsed onToggle={() => {}} />
            </div>
          </Specimen>
        </div>
        <Specimen label="Page header with breadcrumb, status chip, meta and one primary action" className="w-full">
          <div className="w-full rounded-md border border-line bg-surface p-4">
            <PageHeader
              breadcrumb={[{ label: "Job roles", href: "/roles" }, { label: "Junior Data Analyst" }]}
              title="Junior Data Analyst"
              statusChip={<StatusChip status="approved" />}
              description="Entry-level analyst interview."
              meta="Updated 2 days ago by Arjun Mehta"
              secondaryActions={<Button>Preview</Button>}
              primaryAction={<Button variant="primary" iconLeft="plus">New role</Button>}
              leading={<ScoreRing score={78} size={64} />}
            />
          </div>
        </Specimen>
      </SheetSection>

      <SheetSection id="buttons" title="Buttons and icons">
        <Specimen label="Variants (md)">
          <Button variant="primary">Primary</Button>
          <Button>Secondary</Button>
          <Button variant="secondary-teal">Secondary teal</Button>
          <Button variant="text">Text</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="primary" disabled>Disabled</Button>
          <Button variant="primary" disabledReason="Approve at least 5 cards first">Disabled with reason</Button>
        </Specimen>
        <Specimen label="Small, with icons, link button">
          <Button size="sm" variant="primary">Small primary</Button>
          <Button size="sm">Small</Button>
          <Button iconLeft="download">Export CSV</Button>
          <Button iconRight="chevron-down">Menu</Button>
          <ButtonLink href="/candidates" variant="secondary-teal">Link button</ButtonLink>
        </Specimen>
        <Specimen label="Icon set">
          {ICONS.map((n) => (
            <span key={n} title={n} className="inline-flex size-8 items-center justify-center rounded-md border border-line text-ink">
              <Icon name={n} size={18} />
            </span>
          ))}
        </Specimen>
      </SheetSection>

      <SheetSection id="chips" title="Chips, scores and avatars">
        <Specimen label="Status chips">
          {CHIPS.map((s) => <StatusChip key={s} status={s} />)}
        </Specimen>
        <Specimen label="Band chips">
          {BANDS.map((b) => <BandChip key={b} band={b} />)}
          <BandChip score={72} />
        </Specimen>
        <Specimen label="Score cells and change values">
          <ScoreCell score={88} band="ready" />
          <ScoreCell score={72} band="nearly" />
          <ScoreCell score={58} band="developing" />
          <ScoreCell score={31} band="not_ready" />
          <ScoreCell score={null} />
          <ChangeValue value={24} />
          <ChangeValue value={-5} />
          <ChangeValue value={null} />
        </Specimen>
        <Specimen label="Review badge, avatars">
          <ReviewBadge count={5} />
          <ReviewBadge count={2} href="/roles" />
          <Avatar name="Priya Sharma" size={28} />
          <Avatar name="Arjun Mehta" size={40} tone="primary" />
        </Specimen>
        <Specimen label="Stat strip" className="w-full">
          <div className="w-full">
            <StatStrip
              stats={[
                { label: "Candidates", value: 42 },
                { label: "Ready for interviews", value: 11, tone: "positive" },
                { label: "Need attention", value: 6, tone: "attention", note: "No change in 2 sessions" },
                { label: "Avg latest score", value: 68 },
              ]}
            />
          </div>
        </Specimen>
      </SheetSection>

      <SheetSection id="tables" title="Tables">
        <TableStates />
      </SheetSection>

      <SheetSection id="forms" title="Filters, tabs, forms and editors">
        <FormsAndEditors />
      </SheetSection>

      <SheetSection id="overlays" title="Overlays, menu, tooltip and toast">
        <Overlays />
      </SheetSection>

      <SheetSection id="empty" title="Empty state">
        <div className="rounded-md border border-line bg-surface py-6">
          <EmptyState
            icon="users"
            title="Invite your first candidates"
            description="They'll get an email with a login link."
            action={<Button variant="primary" iconLeft="plus">Invite candidates</Button>}
            helper="Add one email or upload a CSV. Candidates only see job roles you've approved."
          />
        </div>
      </SheetSection>

      <SheetSection id="charts" title="Charts (each has a Show as table toggle)">
        <div className="grid gap-6 min-[900px]:grid-cols-2">
          <Specimen label="Stacked band bar" className="w-full">
            <div className="w-full">
              <StackedBandBar label="Latest band, all candidates" counts={{ ready: 4, nearly: 9, developing: 7, not_ready: 2 }} />
            </div>
          </Specimen>
          <Specimen label="Chart frame with table alternative" className="w-full">
            <div className="w-full">
              <ChartFrame
                title="Band distribution"
                caption="Candidates by latest band"
                table={{ caption: "Candidates by latest band", columns: ["Band", "Candidates"], rows: BANDS.map((b, i) => [BAND_LABEL[b], [4, 9, 7, 2][i]]) }}
              >
                <StackedBandBar label="Latest band" counts={{ ready: 4, nearly: 9, developing: 7, not_ready: 2 }} />
              </ChartFrame>
            </div>
          </Specimen>
          <Specimen label="Progress line chart with thresholds" className="w-full">
            <div className="w-full">
              <ProgressLineChart
                caption="Priya Sharma, score by session"
                points={[{ label: "Session 1", date: "2026-09-20", score: 54 }, { label: "Session 2", date: "2026-10-01", score: 68 }, { label: "Session 3", date: "2026-10-13", score: 78 }]}
              />
            </div>
          </Specimen>
          <Specimen label="Horizontal bars, weakest highlighted" className="w-full">
            <div className="w-full">
              <HorizontalBars
                ariaLabel="Average score by dimension"
                caption="Average score by dimension"
                weakestId="delivery"
                items={[{ id: "content", label: "Content", value: 74 }, { id: "structure", label: "Structure", value: 69 }, { id: "delivery", label: "Delivery", value: 55 }, { id: "relevance", label: "Relevance", value: 71 }]}
              />
            </div>
          </Specimen>
        </div>
        <Specimen label="Candidate-app pieces: sub-score bars, score ring with band chip">
          <div className="w-[320px]">
            <SubScoreBars scores={[{ label: "Content", value: 74, weight: 45 }, { label: "Structure", value: 69, weight: 20 }, { label: "Delivery", value: 55, weight: 20 }, { label: "Relevance", value: 71, weight: 15 }]} />
          </div>
          <span className="inline-flex items-center gap-3">
            <ScoreRing score={78} size={72} />
            <BandChip band="nearly" />
          </span>
          <span className="inline-flex items-center gap-3">
            <ScoreRing score={42} size={64} />
            <BandChip band="not_ready" />
          </span>
        </Specimen>
      </SheetSection>

      <SheetSection id="media" title="Audio, evidence highlights and flash card">
        <Specimen label="Audio player" className="w-full">
          <div className="w-full max-w-xl">
            <AudioPlayer label="Question 2 answer" durationSeconds={98} />
          </div>
        </Specimen>
        <Specimen label="Evidence highlights (match and issue)" className="w-full">
          <div className="flex w-full flex-col gap-2">
            <HighlightLegend />
            <TranscriptHighlights transcript={SAMPLE_TRANSCRIPT} highlights={SAMPLE_HIGHLIGHTS} />
          </div>
        </Specimen>
        <div className="flex flex-wrap gap-4">
          <FlashCardPreview side="front" category="Behavioural" question="Tell me about a time you handled a difficult customer." strong={[]} tip="" mistakes={[]} index={3} total={12} />
          <FlashCardPreview
            side="back"
            category="Behavioural"
            question="Tell me about a time you handled a difficult customer."
            strong={["Names the situation and your role", "Shows a calm, specific action", "Ends with the result"]}
            tip="Say what you did, not what the team did."
            mistakes={["Blames the customer", "No outcome"]}
          />
        </div>
      </SheetSection>
    </div>
  );
}
