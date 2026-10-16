"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ReviewBadge } from "@/components/ui/review-badge";
import { ScoreCell } from "@/components/ui/score-cell";
import { Select } from "@/components/ui/select";
import { StatusChip } from "@/components/ui/status-chip";
import { Tabs } from "@/components/ui/tabs";
import { Icon } from "@/components/ui/icon";
import { formatDate, pluralize, relativeTime } from "@/lib/format";
import { SENIORITY_LABEL, type JobRole, type RoleStatus, type Seniority } from "@/lib/types";
import { useAsync } from "@/lib/use-async";
import { useUrlState } from "@/lib/use-url-state";
import { createRole, listRoles } from "@/services/roles";

const SENIORITIES = Object.keys(SENIORITY_LABEL) as Seniority[];

/** Shown next to the dash when a role has no average score. */
const EMPTY_SCORE_LABEL: Record<RoleStatus, string> = {
  draft: "Not live yet",
  approved: "No sessions yet",
  archived: "Archived",
};

function editedLabel(iso: string): string {
  const rt = relativeTime(iso);
  return rt.includes(" ") && !rt.startsWith("Today") ? formatDate(iso) : rt;
}

function CreateRoleModal({ open, onClose, returnFocusRef }: { open: boolean; onClose: () => void; returnFocusRef: React.RefObject<HTMLElement | null> }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [seniority, setSeniority] = useState<Seniority>("entry");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const error = touched && title.trim() === "" ? "Enter a role title" : undefined;

  async function submit() {
    setTouched(true);
    if (title.trim() === "") return;
    setBusy(true);
    setFailure(null);
    try {
      const role = await createRole({ title, seniority });
      router.push(`/roles/${encodeURIComponent(role.id)}/details`);
    } catch (e) {
      setFailure(e instanceof Error ? e.message : "Couldn't create the role");
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New job role"
      width={480}
      returnFocusRef={returnFocusRef}
      initialFocusRef={titleRef}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={busy} onClick={submit}>
            {busy ? "Creating…" : "Create role"}
          </Button>
        </>
      }
      footerNote="You can add details, flash cards and questions next."
    >
      <div className="flex flex-col gap-4">
        <Field label="Role title" error={error}>
          {({ id, describedBy, invalid }) => (
            <Input
              ref={titleRef}
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTouched(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
          )}
        </Field>
        <Field label="Seniority">
          {({ id, describedBy }) => (
            <Select id={id} aria-describedby={describedBy} value={seniority} onChange={(e) => setSeniority(e.target.value as Seniority)}>
              {SENIORITIES.map((s) => (
                <option key={s} value={s}>
                  {SENIORITY_LABEL[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {failure && (
          <p role="alert" className="m-0 text-xs leading-4 font-medium text-improve-text">
            {failure}
          </p>
        )}
      </div>
    </Modal>
  );
}

export function RolesScreen() {
  const router = useRouter();
  const url = useUrlState();
  const tab = url.get("tab") === "archived" ? "archived" : "active";
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const newRef = useRef<HTMLButtonElement>(null);
  const { data, error, loading, reload } = useAsync(() => listRoles(), []);

  const all = data;
  const active = useMemo(() => (all ?? []).filter((r) => r.status !== "archived"), [all]);
  const archived = useMemo(() => (all ?? []).filter((r) => r.status === "archived"), [all]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (tab === "archived" ? archived : active)
      .filter((r) => q === "" || r.title.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [tab, active, archived, query]);

  const columns: Column<JobRole>[] = [
    {
      id: "role",
      header: "Role",
      width: "minmax(220px, 2fr)",
      skeletonWidth: 160,
      render: (r) => (
        <span className="flex min-w-0 flex-col gap-[3px]">
          <span className="truncate text-[15px] leading-5 font-semibold text-ink">{r.title}</span>
          <span className="truncate text-[13px] leading-[18px] text-ink-faint">{SENIORITY_LABEL[r.seniority]}</span>
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: 110,
      skeletonWidth: 70,
      render: (r) => <StatusChip status={r.status} appearance="pill" />,
    },
    {
      id: "content",
      header: "Content",
      width: "minmax(150px, 1fr)",
      skeletonWidth: 120,
      render: (r) => (
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13px] text-ink-soft">
            {pluralize(r.flashCardCount, "card")} · {pluralize(r.questionCount, "question")}
          </span>
          {r.aiDraftCardCount > 0 && (
            // The badge links to the cards tab; keep its click from also opening the row.
            <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
              <ReviewBadge count={r.aiDraftCardCount} href={`/roles/${encodeURIComponent(r.id)}/cards`} />
            </span>
          )}
        </span>
      ),
    },
    {
      id: "candidates",
      header: "Candidates",
      align: "right",
      width: 90,
      skeletonWidth: 20,
      render: (r) => <span className="font-mono text-[13px] text-ink">{r.candidatesAssigned}</span>,
    },
    {
      id: "score",
      header: "Avg latest score",
      width: 170,
      skeletonWidth: 110,
      render: (r) => (
        <ScoreCell
          score={r.avgLatestScore}
          band={r.avgLatestBand ?? undefined}
          emptyLabel={EMPTY_SCORE_LABEL[r.status]}
        />
      ),
    },
    {
      id: "edited",
      header: "Last edited",
      align: "right",
      width: 110,
      skeletonWidth: 70,
      render: (r) => (
        <span className="flex min-w-0 flex-col items-end gap-0.5">
          <span className="max-w-full truncate text-[13px] text-ink-soft">{editedLabel(r.updatedAt)}</span>
          <span className="max-w-full truncate text-xs leading-4 text-ink-faint">{r.updatedByName ?? "—"}</span>
        </span>
      ),
    },
    {
      id: "open",
      header: <span className="sr-only">Open</span>,
      align: "right",
      width: 16,
      skeletonWidth: 0,
      render: () => (
        <span aria-hidden="true" className="text-ink-faint">
          ›
        </span>
      ),
    },
  ];

  const emptyCopy = query.trim()
    ? { title: "No roles match", text: "Try a different search." }
    : tab === "archived"
      ? { title: "No archived roles", text: "Roles you archive appear here. Candidates keep their past results." }
      : { title: "No active roles", text: "Create a job role to get started." };

  const isEmpty = !!all && all.length === 0;
  const newButton = (
    <Button ref={newRef} variant="primary" iconLeft="plus" onClick={() => setCreating(true)}>
      New job role
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader
        title="Job roles"
        description="Candidates only see roles you approve and assign to them."
        primaryAction={isEmpty ? undefined : newButton}
      />
      {error && !data ? (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="m-0 text-sm text-ink-muted">Couldn’t load job roles. {error.message}</p>
          <Button onClick={reload}>Try again</Button>
        </div>
      ) : isEmpty ? (
        <section className="rounded-panel border border-line bg-surface py-10">
          <EmptyState
            icon="briefcase"
            title="Create your first job role"
            description="You can write the content yourself or have AI draft it for you to review."
            action={newButton}
          />
        </section>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line">
            {/* The wrapper draws the shared bottom line; Tabs' own border is switched off. */}
            <Tabs
              label="Role status"
              activeId={tab}
              onChange={(id) => url.set({ tab: id === "archived" ? "archived" : null })}
              items={[
                { id: "active", label: "Active", count: all ? active.length : undefined },
                { id: "archived", label: "Archived", count: all ? archived.length : undefined },
              ]}
              className="border-b-0!"
            />
            <label className="mb-2 flex h-9 w-[280px] max-w-full cursor-text items-center gap-2.5 rounded-[9px] border border-input-line bg-surface px-3 focus-within:[outline:var(--focus-ring)] focus-within:[outline-offset:var(--focus-offset)]">
              <Icon name="search" size={14} className="shrink-0 text-ink-faint" />
              <input
                type="search"
                aria-label="Search roles"
                placeholder="Search roles"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-ink outline-none placeholder:text-ink-faint focus-visible:outline-none [&::-webkit-search-cancel-button]:appearance-none"
              />
            </label>
          </div>
          <div className="flex flex-col gap-3">
            <DataTable
              ariaLabel="Job roles"
              columns={columns}
              rows={rows}
              rowId={(r) => r.id}
              loading={loading && !all}
              twoLine
              onOpenRow={(r) => router.push(`/roles/${encodeURIComponent(r.id)}/details`)}
              emptyState={
                <div className="flex flex-col items-center gap-2">
                  <p className="m-0 text-[15px] leading-[22px] font-semibold text-ink">{emptyCopy.title}</p>
                  <p className="m-0 max-w-[420px] text-sm text-ink-faint">{emptyCopy.text}</p>
                </div>
              }
            />
            <p className="m-0 text-xs leading-4 text-ink-faint">Use ↑ ↓ to move between roles and Enter to open one.</p>
          </div>
        </div>
      )}
      <CreateRoleModal open={creating} onClose={() => setCreating(false)} returnFocusRef={newRef} />
    </PageContainer>
  );
}
