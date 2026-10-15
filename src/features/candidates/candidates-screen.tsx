"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageContainer, PageHeader } from "@/components/layout/page-header";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type SortState } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar, type FilterDef } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { SavedFilterChips } from "@/components/ui/saved-filter-chips";
import { useToast } from "@/components/ui/toast";
import { BANDS } from "@/lib/bands";
import { downloadTextFile } from "@/lib/csv";
import { firstName, pluralize } from "@/lib/format";
import type { CandidateRow } from "@/lib/types";
import { useAsync } from "@/lib/use-async";
import { useUrlState } from "@/lib/use-url-state";
import {
  deactivateCandidates,
  exportCandidatesCsv,
  listCandidates,
  listSavedFilters,
  reactivateCandidates,
  removeRole,
  resendInvite,
  revokeInvite,
  saveFilter,
} from "@/services/candidates";
import { listRoles } from "@/services/roles";
import { AssignRolesModal } from "./assign-roles-modal";
import { candidateColumns, candidateMenuItems } from "./candidate-columns";
import { CandidatePanel } from "./candidate-panel";
import { confirmCopy, type ConfirmState } from "./confirm-copy";
import { InviteModal, type InviteSent, type InviteTab } from "./invite-modal";
import {
  buildQuery,
  CLEAR_FILTER_UPDATES,
  hasFilters,
  LAST_ACTIVE_OPTIONS,
  readFilters,
  readSort,
  savedFilterUpdates,
  SORT_LABEL,
} from "./url-query";

type AssignTarget = { ids: string[]; subject: string; excludeRoleIds?: string[] };

const STATUS_OPTIONS = [
  { value: "invite_pending", label: "Invite pending" },
  { value: "active", label: "Active" },
  { value: "deactivated", label: "Deactivated" },
];

export function CandidatesScreen() {
  const url = useUrlState();
  const toast = useToast();
  const filters = readFilters(url);
  const sort = readSort(url);
  const candidateId = url.get("candidate");
  const inviteParam = url.get("invite");
  const inviteTab: InviteTab | null = inviteParam === "one" || inviteParam === "csv" ? inviteParam : null;

  const mutationBusy = useRef(false);
  const [version, setVersion] = useState(0);
  const [savedVersion, setSavedVersion] = useState(0);
  const savedQ = useAsync(() => listSavedFilters(), [savedVersion]);
  const rolesQ = useAsync(() => listRoles(), []);
  const query = buildQuery(filters, sort, savedQ.data);
  const queryKey = JSON.stringify(query);
  const listQ = useAsync(() => listCandidates(query), [queryKey, version]);
  const rows = useMemo(() => listQ.data?.rows ?? [], [listQ.data]);
  const firstUse = listQ.data?.totalUnfiltered === 0 && !listQ.error;
  const filtered = hasFilters(filters);

  const [selection, setSelection] = useState<Set<string>>(new Set());
  const selectedRows = useMemo(() => rows.filter((r) => selection.has(r.id)), [rows, selection]);
  const selectedIds = useMemo(() => new Set(selectedRows.map((r) => r.id)), [selectedRows]);
  const pendingSelected = selectedRows.filter((r) => r.status === "invite_pending").length;

  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [assign, setAssign] = useState<AssignTarget | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);

  const focusRowIdRef = useRef<((id: string) => void) | null>(null);
  const pendingFocus = useRef<string | null>(null);
  const columns = useMemo(() => candidateColumns(), []);

  const refresh = () => setVersion((v) => v + 1);

  // Search box: local text, debounced into the URL.
  const [searchText, setSearchText] = useState(filters.search);
  useEffect(() => {
    if (searchText.trim() === filters.search.trim()) return;
    const t = window.setTimeout(() => url.set({ q: searchText.trim() || null, saved: null }), 250);
    return () => window.clearTimeout(t);
  }, [searchText, filters.search, url]);

  // After the panel closes, focus returns to the row that was open.
  useEffect(() => {
    if (candidateId === null && pendingFocus.current) {
      const id = pendingFocus.current;
      pendingFocus.current = null;
      const t = window.setTimeout(() => focusRowIdRef.current?.(id), 0);
      return () => window.clearTimeout(t);
    }
  }, [candidateId]);

  const filterDefs: FilterDef[] = [
    {
      id: "role",
      label: "Role",
      multi: true,
      options: (rolesQ.data ?? []).filter((r) => r.status !== "archived").map((r) => ({ value: r.id, label: r.title })),
    },
    { id: "band", label: "Band", multi: true, options: BANDS.map((b) => ({ value: b.id, label: b.label })) },
    { id: "status", label: "Status", multi: true, options: STATUS_OPTIONS },
    { id: "active", label: "Last active", options: LAST_ACTIVE_OPTIONS },
  ];

  function onFilterChange(id: string, values: string[]) {
    url.set({ [id]: id === "active" ? (values[0] ?? null) : values, saved: null });
  }

  function clearFilters() {
    setSearchText("");
    url.set(CLEAR_FILTER_UPDATES);
  }

  function applySaved(id: string) {
    const f = savedQ.data?.find((s) => s.id === id);
    const q = f?.query ?? (id === "invite_pending" ? { statuses: ["invite_pending" as const] } : {});
    setSearchText(q.search ?? "");
    url.set(savedFilterUpdates(id, q));
  }

  function openRow(r: CandidateRow) {
    url.set({ candidate: r.id });
  }

  function closePanel() {
    pendingFocus.current = candidateId;
    url.set({ candidate: null });
  }

  const savedItems = savedQ.data?.map((s) => ({ id: s.id, label: s.label })) ?? [
    { id: "all", label: "All candidates" },
  ];

  async function guard(fn: () => Promise<void>) {
    if (mutationBusy.current) return;
    mutationBusy.current = true;
    try {
      await fn();
    } catch (error) {
      toast.show({ title: "Something went wrong", detail: error instanceof Error ? error.message : "That didn’t go through. Try again." });
    } finally { mutationBusy.current = false; }
  }

  async function resend(ids: string[]) {
    await guard(async () => {
      const { resent } = await resendInvite(ids);
      toast.show(
        resent > 0
          ? {
              title: resent === 1 ? "Invite resent" : `${resent} invites resent`,
              detail: "Each person gets a new email with a login link.",
            }
          : { title: "Nothing to resend", detail: "Only invite pending candidates can be sent a new invite." },
      );
      refresh();
    });
  }

  async function reactivate(id:string) {
    await guard(async()=>{ const result=await reactivateCandidates([id]); toast.show({title:result.reactivated ? "Candidate reactivated" : "No changes"}); refresh(); });
  }

  async function exportCsv(ids: string[]) {
    await guard(async () => {
      const { filename, csv } = await exportCandidatesCsv(ids);
      downloadTextFile(filename, csv);
      toast.show({ title: `Exported ${pluralize(ids.length || rows.length, "candidate")}`, detail: filename });
    });
  }

  async function runConfirm(c: ConfirmState) {
    setConfirm(null);
    await guard(async () => {
      switch (c.kind) {
        case "deactivate":
          await deactivateCandidates([c.id]);
          toast.show({ title: `${c.name} deactivated`, detail: "Their sessions, scores and transcripts are kept." });
          break;
        case "revoke":
          await revokeInvite(c.id);
          toast.show({ title: "Invite revoked", detail: `The login link in ${firstName(c.name)}’s email no longer works.` });
          break;
        case "remove-role":
          await removeRole(c.candidateId, c.roleId);
          toast.show({ title: "Role removed", detail: `${c.roleTitle} was removed from ${c.name}.` });
          break;
        case "bulk-deactivate": {
          const result = await deactivateCandidates(c.rows.map((r)=>r.id));
          setSelection(new Set());
          toast.show({title:`${pluralize(result.deactivated,"candidate")} updated`,detail:`Sessions and scores are kept.${result.skipped ? ` ${result.skipped} skipped.` : ""}`});
          break;
        }
      }
      refresh();
    });
  }

  function onInviteSent(r: InviteSent) {
    url.set({ invite: null });
    refresh();
    toast.show({
      title: `${pluralize(r.sent, "invite")} sent`,
      detail: `Each person gets an email with a login link.${r.skipped > 0 ? ` ${pluralize(r.skipped, "row")} ${r.skipped === 1 ? "was" : "were"} skipped.` : ""}`,
      action: { label: "Show invite pending", onClick: () => applySaved("invite_pending") },
    });
  }

  async function submitSave(name: string) {
    await guard(async () => {
      const f = await saveFilter(name, query);
      setSavedVersion((v) => v + 1);
      url.set({ saved: f.id });
      setSaveOpen(false);
    });
  }

  const sortState: SortState = { columnId: sort.columnId, direction: sort.direction };
  const openInvite = () => url.set({ invite: "one" });
  const count = listQ.data?.total ?? 0;
  const copy = confirm ? confirmCopy(confirm) : null;

  return (
    <PageContainer>
      <PageHeader
        title="Candidates"
        description="Invite people and track how prepared they are."
        primaryAction={
          firstUse ? undefined : (
            <Button variant="primary" iconLeft="plus" onClick={openInvite}>
              Invite candidates
            </Button>
          )
        }
      />

      {firstUse ? (
        <section className="rounded-md border border-line bg-surface py-12">
          <EmptyState
            icon="mail"
            title="Invite your first candidates"
            description="They'll get an email with a login link."
            action={
              <Button variant="primary" onClick={openInvite}>
                Invite candidates
              </Button>
            }
            helper="Add one email or upload a CSV. Candidates only see job roles you've approved."
          />
        </section>
      ) : (
        <div className="flex flex-col gap-3">
          <FilterBar
            search={searchText}
            onSearchChange={setSearchText}
            searchPlaceholder="Search name or email"
            searchLabel="Search name or email"
            filters={filterDefs}
            values={{ role: filters.roles, band: filters.bands, status: filters.statuses, active: filters.active }}
            onChange={onFilterChange}
            onClearAll={clearFilters}
          />
          <SavedFilterChips
            items={savedItems}
            activeId={filters.saved ?? (filtered ? null : "all")}
            onSelect={applySaved}
            onSaveCurrent={filtered ? () => setSaveOpen(true) : undefined}
          />

          {listQ.error && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-md border border-error bg-surface px-4 py-2.5 text-sm font-medium text-error"
            >
              Couldn’t load candidates. Try again.
              <Button size="sm" variant="secondary" onClick={listQ.reload}>
                Retry
              </Button>
            </div>
          )}

          {!(listQ.error && !listQ.data) && (
            <div>
              {selectedRows.length > 0 ? (
                <div className="rounded-t-md border border-b-0 border-primary bg-surface">
                  <BulkActionBar
                    count={selectedRows.length}
                    onClear={() => setSelection(new Set())}
                    actions={[
                      {
                        id: "assign",
                        label: "Assign roles",
                        onClick: () =>
                          setAssign({
                            ids: selectedRows.map((r) => r.id),
                            subject: pluralize(selectedRows.length, "candidate"),
                          }),
                      },
                      {
                        id: "resend",
                        label: "Resend invites",
                        count: pendingSelected,
                        onClick: () => resend(selectedRows.filter((r) => r.status === "invite_pending").map((r) => r.id)),
                      },
                      { id: "export", label: "Export CSV", onClick: () => exportCsv(selectedRows.map((r) => r.id)) },
                    ]}
                    destructive={{
                      label: "Deactivate",
                      onClick: () =>
                        setConfirm({
                          kind: "bulk-deactivate",
                          rows: selectedRows.map((r) => ({ id: r.id, name: r.name, status: r.status })),
                        }),
                    }}
                  />
                </div>
              ) : (
                <div className="flex h-11 items-center justify-between rounded-t-md border border-b-0 border-line bg-surface px-4 text-[13px] text-ink-muted">
                  <span aria-live="polite">{listQ.data ? pluralize(count, "candidate") : "Loading candidates"}</span>
                  <span>Sorted by {SORT_LABEL[sort.columnId]}</span>
                </div>
              )}
              <DataTable
                className="rounded-t-none"
                ariaLabel="Candidates"
                columns={columns}
                rows={rows}
                rowId={rowId}
                selectable
                selectedIds={selectedIds}
                onSelectionChange={setSelection}
                sort={sortState}
                onSortChange={(s) =>
                  url.set({ sort: s.columnId, dir: s.direction })
                }
                onOpenRow={openRow}
                activeRowId={candidateId}
                focusRowIdRef={focusRowIdRef}
                loading={listQ.loading && !listQ.data}
                emptyState={
                  <div className="flex flex-col items-center gap-3">
                    <p className="m-0 text-sm text-ink-muted">No candidates match these filters.</p>
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  </div>
                }
                rowActions={(r) =>
                  candidateMenuItems(r, {
                    resend: () => resend([r.id]),
                    reactivate: () => reactivate(r.id),
                    assign: () =>
                      setAssign({ ids: [r.id], subject: r.name, excludeRoleIds: r.roles.map((x) => x.id) }),
                    deactivate: () =>
                      setConfirm({ kind: "deactivate", id: r.id, name: r.name, sessions: r.sessions }),
                    revoke: () => setConfirm({ kind: "revoke", id: r.id, name: r.name }),
                  })
                }
              />
            </div>
          )}
        </div>
      )}

      {candidateId && (
        <CandidatePanel
          key="panel"
          candidateId={candidateId}
          fallbackName={rows.find((r) => r.id === candidateId)?.name}
          version={version}
          onClose={closePanel}
          onResend={(id) => resend([id])}
          onReactivate={reactivate}
          onAssign={(d) =>
            setAssign({ ids: [d.id], subject: d.name, excludeRoleIds: d.assignments.map((a) => a.roleId) })
          }
          onConfirm={setConfirm}
        />
      )}

      {inviteTab && (
        <InviteModal
          tab={inviteTab}
          onTabChange={(t) => url.set({ invite: t })}
          onClose={() => url.set({ invite: null })}
          onSent={onInviteSent}
        />
      )}

      {assign && (
        <AssignRolesModal
          candidateIds={assign.ids}
          excludeRoleIds={assign.excludeRoleIds}
          subject={assign.subject}
          onClose={() => setAssign(null)}
          onAssigned={(added) => {
            setAssign(null);
            refresh();
            toast.show({
              title: added > 0 ? "Roles assigned" : "No changes",
              detail: added > 0 ? `${pluralize(added, "assignment")} added for ${assign.subject}.` : "Those roles were already assigned.",
            });
          }}
        />
      )}

      {saveOpen && <SaveFilterModal onClose={() => setSaveOpen(false)} onSave={submitSave} />}

      <ConfirmDialog
        open={confirm !== null}
        title={copy?.title ?? ""}
        body={copy?.body ?? ""}
        confirmLabel={copy?.confirmLabel ?? ""}
        tone="destructive"
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm && runConfirm(confirm)}
      />
    </PageContainer>
  );
}

function rowId(r: CandidateRow) {
  return r.id;
}

function SaveFilterModal({ onClose, onSave }: { onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title="Save current filters"
      width={420}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSave(name)} disabledReason={name.trim() ? undefined : "Name this filter first"}>
            Save filters
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5 text-[13px] leading-5 font-semibold text-ink">
        Name
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="For example, Needs a nudge"
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onSave(name);
          }}
        />
      </label>
    </Modal>
  );
}
