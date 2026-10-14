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
import { formatDate, relativeTime } from "@/lib/format";
import { SENIORITY_LABEL, type JobRole, type Seniority } from "@/lib/types";
import { useAsync } from "@/lib/use-async";
import { useUrlState } from "@/lib/use-url-state";
import { createRole, listRoles } from "@/services/roles";

const SENIORITIES = Object.keys(SENIORITY_LABEL) as Seniority[];

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
      width: "minmax(240px, 2fr)",
      render: (r) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-ink">{r.title}</span>
          <span className="text-xs leading-4 text-ink-muted">{SENIORITY_LABEL[r.seniority]}</span>
        </span>
      ),
    },
    { id: "status", header: "Status", width: 120, render: (r) => <StatusChip status={r.status} /> },
    { id: "cards", header: "Flash cards", align: "right", width: 104, render: (r) => r.flashCardCount },
    { id: "questions", header: "Questions", align: "right", width: 104, render: (r) => r.questionCount },
    {
      id: "drafts",
      header: "AI drafts",
      width: 136,
      render: (r) =>
        r.aiDraftCardCount > 0 ? (
          <ReviewBadge count={r.aiDraftCardCount} href={`/roles/${encodeURIComponent(r.id)}/cards`} />
        ) : (
          <span className="text-ink-muted">–</span>
        ),
    },
    { id: "candidates", header: "Candidates", align: "right", width: 112, render: (r) => r.candidatesAssigned },
    {
      id: "score",
      header: "Avg latest score",
      width: 188,
      render: (r) =>
        r.avgLatestScore !== null ? (
          <ScoreCell score={r.avgLatestScore} band={r.avgLatestBand ?? undefined} />
        ) : (
          <span className="flex items-center gap-2">
            <ScoreCell score={null} />
            <span className="text-xs leading-4 text-ink-muted">{r.status === "archived" ? "Archived" : "Not live yet"}</span>
          </span>
        ),
    },
    {
      id: "edited",
      header: "Last edited",
      width: 172,
      render: (r) => (
        <span className="flex min-w-0 flex-col">
          <span>{editedLabel(r.updatedAt)}</span>
          <span className="text-xs leading-4 text-ink-muted">{r.updatedByName ?? "–"}</span>
        </span>
      ),
    },
  ];

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
        <section className="rounded-lg border border-line bg-surface py-10">
          <EmptyState
            icon="briefcase"
            title="Create your first job role"
            description="You can write the content yourself or have AI draft it for you to review."
            action={newButton}
          />
        </section>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line">
            <Tabs
              label="Role status"
              activeId={tab}
              onChange={(id) => url.set({ tab: id === "archived" ? "archived" : null })}
              items={[
                { id: "active", label: "Active", count: all ? active.length : undefined },
                { id: "archived", label: "Archived", count: all ? archived.length : undefined },
              ]}
              className="border-b-0"
            />
            <div className="relative mb-2 w-[260px] max-w-full">
              <Icon name="search" size={16} className="pointer-events-none absolute top-2.5 left-2.5 text-ink-muted" />
              <Input
                type="search"
                aria-label="Search roles"
                placeholder="Search roles"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-[34px]"
              />
            </div>
          </div>
          <DataTable
            ariaLabel="Job roles"
            columns={columns}
            rows={rows}
            rowId={(r) => r.id}
            loading={loading && !all}
            twoLine
            onOpenRow={(r) => router.push(`/roles/${encodeURIComponent(r.id)}/details`)}
            emptyState={
              <EmptyState
                icon="search"
                title={query.trim() ? "No roles match your search" : tab === "archived" ? "No archived roles" : "No active roles"}
                description={query.trim() ? "Try a different name." : undefined}
              />
            }
          />
          <p className="m-0 text-xs leading-4 text-ink-muted">Use ↑ ↓ to move between roles and Enter to open one.</p>
        </div>
      )}
      <CreateRoleModal open={creating} onClose={() => setCreating(false)} returnFocusRef={newRef} />
    </PageContainer>
  );
}
