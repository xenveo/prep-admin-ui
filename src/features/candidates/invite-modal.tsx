"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropZone } from "@/components/ui/drop-zone";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { RoleChecklist } from "@/components/ui/role-checklist";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import {
  downloadTextFile,
  INVITE_CSV_TEMPLATE,
  parseInviteCsv,
  problemRowsFirst,
  validateInviteInput,
} from "@/lib/csv";
import { firstName, pluralize } from "@/lib/format";
import { INVITE_RESULT_LABEL, type CandidateRow, type InviteCsvParse, type InviteRow } from "@/lib/types";
import { useAsync } from "@/lib/use-async";
import { getInviteContext, inviteCandidates, listCandidates, validateInviteRows } from "@/services/candidates";
import { listRoles } from "@/services/roles";
import { toRoleChoices } from "./role-choices";

export type InviteTab = "one" | "csv";
export type InviteSent = { sent: number; skipped: number };

type PersonRow = { key: number; email: string; name: string };

const STATUS_WORD: Record<CandidateRow["status"], string> = {
  active: "active",
  invite_pending: "invite pending",
  deactivated: "deactivated",
  revoked: "revoked",
};

const SAMPLE_PREVIEW_READY = 5;

/** A2. Mount only while open so its state resets on close. The tab lives in the URL (?invite=one|csv). */
export function InviteModal({
  tab,
  onTabChange,
  onClose,
  onSent,
}: {
  tab: InviteTab;
  onTabChange: (t: InviteTab) => void;
  onClose: () => void;
  onSent: (r: InviteSent) => void;
}) {
  const panelId = useId();
  const rolesQ = useAsync(() => listRoles(), []);
  const contextQ = useAsync(getInviteContext, []);
  const peopleQ = useAsync(() => listCandidates(), []);
  const roles = rolesQ.data;
  const existing = peopleQ.data?.rows;
  const ready = Boolean(roles && existing && contextQ.data);

  const [rows, setRows] = useState<PersonRow[]>([{ key: 1, email: "", name: "" }]);
  const [nextKey, setNextKey] = useState(2);
  const [roleIds, setRoleIds] = useState<string[] | null>(null); // null = untouched, defaults to first approved
  const [accessUntil, setAccessUntil] = useState("");
  const [maxSessions, setMaxSessions] = useState("");
  const [csv, setCsv] = useState<{ fileName: string; parse: InviteCsvParse } | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvFilter, setCsvFilter] = useState<"all" | "fix">("all");
  const [discard, setDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const approved = useMemo(() => (roles ?? []).filter((r) => r.status === "approved"), [roles]);
  const drafts = useMemo(() => (roles ?? []).filter((r) => r.status === "draft"), [roles]);
  const choices = useMemo(() => toRoleChoices(roles ?? []), [roles]);
  const selectedRoleIds = useMemo(() => roleIds ?? (approved[0] ? [approved[0].id] : []), [roleIds, approved]);
  const selectedRoleNames = useMemo(
    () => approved.filter((r) => selectedRoleIds.includes(r.id)).map((r) => r.title),
    [approved, selectedRoleIds],
  );

  const existingByEmail = useMemo(() => {
    const m = new Map<string, CandidateRow>();
    for (const c of existing ?? []) m.set(c.email.trim().toLowerCase(), c);
    return m;
  }, [existing]);

  const ctx = useMemo(
    () => ({
      approvedRoleNames: contextQ.data?.approvedRoleNames ?? approved.map((r) => r.title),
      draftRoleNames: contextQ.data?.draftRoleNames ?? drafts.map((r) => r.title),
      existingEmails: contextQ.data?.existingEmails ?? existing?.map((c) => c.email) ?? [],
    }),
    [approved, drafts, existing, contextQ.data],
  );

  // One by one: live validation. Roles are checked separately (the Send button), so a stand-in role name is used here.
  const results = useMemo(() => {
    const filled = rows.filter((r) => r.email.trim() || r.name.trim());
    const standIn = selectedRoleNames.length > 0 ? selectedRoleNames : [approved[0]?.title ?? "role"];
    const out = validateInviteInput(
      filled.map((r) => ({ email: r.email, name: r.name, roles: standIn })),
      ctx,
    );
    const byKey = new Map<number, InviteRow>();
    filled.forEach((r, i) => byKey.set(r.key, out[i]));
    return byKey;
  }, [rows, ctx, selectedRoleNames, approved]);

  const oneReady = [...results.values()].filter((r) => r.result === "ready").length;
  const oneSkipped = [...results.values()].filter(
    (r) => r.result === "already_invited" || r.result === "duplicate_in_file",
  ).length;

  function rowMessage(r: InviteRow | undefined): string | null {
    if (!r) return null;
    if (r.result === "invalid_email") return "Enter a valid email";
    if (r.result === "already_invited") {
      const c = existingByEmail.get(r.email.toLowerCase());
      return c
        ? `Already invited. ${firstName(c.name)} is ${STATUS_WORD[c.status]}, so this row will be skipped.`
        : "Already invited, so this row will be skipped.";
    }
    if (r.result === "duplicate_in_file") return "Already in this list, so this row will be skipped.";
    return null;
  }

  const sessionsInvalid = maxSessions.trim() !== "" && !/^[1-9]\d*$/.test(maxSessions.trim());

  // CSV
  const csvRows = csv?.parse.rows ?? [];
  const csvSummary = csv?.parse.summary;
  const csvProblems = csvRows.filter((r) => r.result !== "ready");
  const csvReadyRows = csvRows.filter((r) => r.result === "ready");
  const ordered = problemRowsFirst(csvRows);
  const shownRows =
    csvFilter === "fix"
      ? csvProblems
      : [...ordered.filter((r) => r.result !== "ready"), ...csvReadyRows.slice(0, SAMPLE_PREVIEW_READY)];
  const hiddenReady = csvFilter === "fix" ? 0 : Math.max(0, csvReadyRows.length - SAMPLE_PREVIEW_READY);

  const dirty = rows.some((r) => r.email.trim() || r.name.trim()) || csv !== null;

  function requestClose() {
    if (busy) return;
    if (dirty) setDiscard(true);
    else onClose();
  }

  async function onFile(file: File) {
    setCsvError(null);
    const text = await file.text();
    const parse = parseInviteCsv(
      text,
      ctx.approvedRoleNames,
      ctx.existingEmails,
      ctx.draftRoleNames,
    );
    if (parse.missingColumns.length > 0) {
      setCsv(null);
      setCsvError(`This file is missing the ${parse.missingColumns.join(", ")} ${parse.missingColumns.length === 1 ? "column" : "columns"}. Download the template to see the format.`);
      return;
    }
    if (parse.rows.length === 0) {
      setCsv(null);
      setCsvError("No rows found in this file. Add one person per row under the header.");
      return;
    }
    try {
      const checked = await validateInviteRows(parse.rows.map(({email,name,roles})=>({email,name,roles})));
      setCsv({ fileName: file.name, parse: {...parse, ...checked} });
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : "Validation failed. Upload the file again.");
      return;
    }
    setCsvFilter("all");
  }

  const roleIdByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of approved) m.set(r.title.toLowerCase(), r.id);
    return m;
  }, [approved]);

  async function send() {
    setBusy(true);
    setSendError(null);
    try {
      if (tab === "one") {
        const filled = rows.filter((r) => r.email.trim() || r.name.trim());
        const checked = await validateInviteRows(filled.map((r)=>({email:r.email.trim(),name:r.name.trim(),roles:selectedRoleNames})));
        const toSend = checked.rows.filter((r)=>r.result === "ready").map((r)=>({email:r.email,name:r.name,roleIds:selectedRoleIds}));
        if (!toSend.length) throw new Error("No rows are ready to send. Check names, email addresses and approved roles.");
        const res = await inviteCandidates({
          source: "single",
          rows: toSend,
          accessUntil: accessUntil || null,
          maxSessions: maxSessions.trim() ? Number(maxSessions) : null,
        });
        onSent({ sent: res.sent, skipped: res.skipped + checked.summary.needFixing });
      } else if (csv) {
        const toSend = csv.parse.rows
          .filter((r) => r.result === "ready")
          .map((r) => ({
            email: r.email,
            name: r.name,
            roleIds: r.roles.map((n) => roleIdByName.get(n.toLowerCase())).filter((x): x is string => Boolean(x)),
          }));
        const res = await inviteCandidates({ source: "csv", fileName: csv.fileName, rows: toSend });
        onSent({ sent: res.sent, skipped: res.skipped + (csvSummary?.needFixing ?? 0) });
      }
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "The invites weren't sent. Try again.");
      setBusy(false);
    }
  }

  const count = tab === "one" ? oneReady : (csvSummary?.ready ?? 0);
  let disabledReason: string | undefined;
  if (!ready) disabledReason = "Loading";
  else if (tab === "one") {
    if (selectedRoleIds.length === 0) disabledReason = "Pick at least one role";
    else if (sessionsInvalid) disabledReason = "Fix max sessions first";
    else if (oneReady === 0) disabledReason = "Add at least one valid email";
  } else if (!csv) disabledReason = "Upload a CSV first";
  else if (count === 0) disabledReason = "No rows are ready to send";
  if (busy) disabledReason = undefined;

  const sendLabel = tab === "csv" && !csv ? "Send invites" : `Send ${pluralize(count, "invite")}`;

  let footerNote: string;
  if (tab === "one") {
    footerNote = oneSkipped > 0 ? `${oneSkipped} already invited, will be skipped` : "Nothing is sent until you confirm";
  } else if (csvSummary && csvSummary.needFixing > 0) {
    footerNote = `${pluralize(csvSummary.needFixing, "row")} will be skipped`;
  } else {
    footerNote = "Nothing is sent until you confirm";
  }

  return (
    <>
      <Modal
        open
        onClose={requestClose}
        title="Invite candidates"
        tabs={
          <Tabs
            label="Invite method"
            panelId={panelId}
            activeId={tab}
            onChange={(id) => onTabChange(id as InviteTab)}
            items={[
              { id: "one", label: "One by one" },
              { id: "csv", label: "Upload CSV" },
            ]}
          />
        }
        footerNote={footerNote}
        footer={
          <>
            <Button variant="secondary" onClick={requestClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={send}
              disabled={busy}
              disabledReason={disabledReason}
              aria-busy={busy || undefined}
            >
              {sendLabel}
            </Button>
          </>
        }
      >
        <div id={panelId} role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex flex-col gap-5">
          {(rolesQ.error || peopleQ.error || contextQ.error) && <p role="alert" className="text-sm text-improve-text">Invite information could not be loaded. <Button onClick={()=>{rolesQ.reload();peopleQ.reload();contextQ.reload();}}>Try again</Button></p>}
          {tab === "one" ? (
            <>
              <section className="flex flex-col gap-2" aria-labelledby={`${panelId}-people`}>
                <h3 id={`${panelId}-people`} className="m-0 text-[13px] leading-5 font-semibold text-ink">
                  People
                </h3>
                <div className="grid grid-cols-[1fr_1fr_32px] gap-x-2 text-xs leading-4 text-ink-muted" aria-hidden="true">
                  <span>Email</span>
                  <span>Name</span>
                  <span />
                </div>
                {rows.map((row, i) => {
                  const res = results.get(row.key);
                  const msg = rowMessage(res);
                  const msgId = `${panelId}-row-${row.key}-msg`;
                  return (
                    <div key={row.key} className="flex flex-col gap-1">
                      <div className="grid grid-cols-[1fr_1fr_32px] items-center gap-x-2">
                        <Input
                          type="email"
                          value={row.email}
                          invalid={Boolean(msg)}
                          aria-label={`Email, person ${i + 1}`}
                          aria-describedby={msg ? msgId : undefined}
                          placeholder="name@example.com"
                          onChange={(e) =>
                            setRows((rs) => rs.map((x) => (x.key === row.key ? { ...x, email: e.target.value } : x)))
                          }
                        />
                        <Input
                          value={row.name}
                          aria-label={`Name, person ${i + 1}`}
                          placeholder="Full name"
                          onChange={(e) =>
                            setRows((rs) => rs.map((x) => (x.key === row.key ? { ...x, name: e.target.value } : x)))
                          }
                        />
                        <button
                          type="button"
                          aria-label={`Remove person ${i + 1}`}
                          aria-disabled={rows.length === 1 || undefined}
                          onClick={() => {
                            if (rows.length === 1) {
                              setRows([{ key: row.key, email: "", name: "" }]);
                              return;
                            }
                            setRows((rs) => rs.filter((x) => x.key !== row.key));
                          }}
                          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-neutral-soft hover:text-ink after:absolute after:-inset-1.5 after:content-['']"
                        >
                          <Icon name="close" size={16} />
                        </button>
                      </div>
                      {msg && (
                        <p id={msgId} role="alert" className="m-0 text-xs leading-4 font-medium text-improve-text">
                          {msg}
                        </p>
                      )}
                    </div>
                  );
                })}
                <div>
                  <Button
                    variant="text"
                    size="sm"
                    iconLeft="plus"
                    onClick={() => {
                      setRows((rs) => [...rs, { key: nextKey, email: "", name: "" }]);
                      setNextKey((k) => k + 1);
                    }}
                  >
                    Add another
                  </Button>
                </div>
              </section>

              <section className="flex flex-col gap-2" aria-labelledby={`${panelId}-roles`}>
                <h3 id={`${panelId}-roles`} className="m-0 text-[13px] leading-5 font-semibold text-ink">
                  Assign roles
                </h3>
                <p className="m-0 text-xs leading-4 text-ink-muted">Candidates see only approved roles. Pick one or more.</p>
                {!roles && !rolesQ.error && <p className="m-0 text-sm text-ink-muted">Loading roles…</p>}
                {rolesQ.error && (
                  <p role="alert" className="m-0 text-sm font-medium text-error">
                    Couldn’t load roles.{" "}
                    <button type="button" onClick={rolesQ.reload} className="font-semibold underline">
                      Try again
                    </button>
                  </p>
                )}
                {roles && (
                  <RoleChecklist roles={choices} selectedIds={selectedRoleIds} onChange={setRoleIds} label="Roles to assign" />
                )}
              </section>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Access until" optional helper="They can't log in after this date.">
                  {({ id, describedBy, invalid }) => (
                    <Input
                      id={id}
                      type="date"
                      value={accessUntil}
                      invalid={invalid}
                      aria-describedby={describedBy}
                      onChange={(e) => setAccessUntil(e.target.value)}
                    />
                  )}
                </Field>
                <Field
                  label="Max sessions per role"
                  optional
                  helper="Mock interviews each person can take per role."
                  error={sessionsInvalid ? "Enter a whole number, 1 or more" : undefined}
                >
                  {({ id, describedBy, invalid }) => (
                    <Input
                      id={id}
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      placeholder="No limit"
                      value={maxSessions}
                      invalid={invalid}
                      aria-describedby={describedBy}
                      onChange={(e) => setMaxSessions(e.target.value)}
                    />
                  )}
                </Field>
              </div>
            </>
          ) : (
            <>
              {!csv ? (
                <>
                  <DropZone
                    onFile={onFile}
                    disabled={!ready}
                    helper="One person per row. Separate multiple roles with a semicolon."
                  />
                  {csvError && (
                    <p role="alert" className="m-0 text-sm font-medium text-improve-text">
                      {csvError}
                    </p>
                  )}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3 text-xs leading-4 text-ink-muted">
                      <button
                        type="button"
                        onClick={() => downloadTextFile("invite-template.csv", INVITE_CSV_TEMPLATE)}
                        className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-semibold text-primary-text underline"
                      >
                        <Icon name="download" size={14} />
                        Download template
                      </button>
                      <span>Columns: email, name, roles</span>
                    </div>
                    <p className="m-0 text-xs leading-4 text-ink-muted">
                      Role names must match an approved job role: {approved.map((r) => r.title).join(", ") || "none yet"}.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 rounded-md border border-line bg-bg px-3 py-2">
                    <span className="text-ink-muted">
                      <Icon name="file" size={20} />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm leading-5 font-semibold text-ink">{csv.fileName}</span>
                      <span className="text-xs leading-4 text-ink-muted">
                        {pluralize(csv.parse.summary.total, "row")} · checked just now
                      </span>
                    </div>
                    <ReplaceFile onFile={onFile} />
                  </div>
                  {csvError && (
                    <p role="alert" className="m-0 text-sm font-medium text-improve-text">
                      {csvError}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div role="status" aria-live="polite" className="flex items-center gap-3 text-sm font-semibold">
                      <span className="inline-flex items-center gap-1 text-primary-text">
                        <Icon name="check" size={16} />
                        {csvSummary?.ready} ready
                      </span>
                      {(csvSummary?.needFixing ?? 0) > 0 && (
                        <span className="text-improve-text">{csvSummary?.needFixing} need fixing</span>
                      )}
                    </div>
                    <SegmentedControl
                      label="Show rows"
                      size="sm"
                      value={csvFilter}
                      onChange={setCsvFilter}
                      options={[
                        { value: "all", label: `All ${csvSummary?.total ?? 0}` },
                        { value: "fix", label: `Need fixing ${csvSummary?.needFixing ?? 0}` },
                      ]}
                    />
                  </div>
                  <div className="overflow-x-auto rounded-md border border-line">
                    <table className="w-full border-collapse text-left text-[13px] leading-5">
                      <caption className="sr-only">Invite file preview, problem rows first</caption>
                      <thead>
                        <tr className="h-9 border-b border-line text-xs leading-4 font-semibold text-ink-muted">
                          <th scope="col" className="w-[56px] pr-2 pl-3 text-right font-semibold">
                            Row
                          </th>
                          <th scope="col" className="px-3 font-semibold">Email</th>
                          <th scope="col" className="px-3 font-semibold">Name</th>
                          <th scope="col" className="px-3 font-semibold">Roles</th>
                          <th scope="col" className="px-3 font-semibold">Check</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shownRows.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-center text-ink-muted">
                              No rows need fixing.
                            </td>
                          </tr>
                        )}
                        {shownRows.map((r) => {
                          const bad = r.result !== "ready";
                          return (
                            <tr key={r.rowNumber} className={cn("h-9 border-b border-line last:border-b-0", bad && "bg-improve-soft")}>
                              <td className="pr-2 pl-3 text-right text-ink-muted">{r.rowNumber}</td>
                              <td className={cn("px-3", r.problemCell === "email" && "font-semibold text-improve-text")}>{r.email}</td>
                              <td className="px-3">{r.name}</td>
                              <td className={cn("px-3", r.problemCell === "roles" && "font-semibold text-improve-text")}>
                                {r.roles.join("; ")}
                              </td>
                              <td className="px-3 whitespace-nowrap">
                                {bad ? (
                                  <span className="font-semibold text-improve-text">{INVITE_RESULT_LABEL[r.result]}</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 font-medium text-primary-text">
                                    <Icon name="check" size={14} />
                                    Ready
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {hiddenReady > 0 && (
                          <tr className="h-9">
                            <td colSpan={5} className="px-3 text-ink-muted">
                              {hiddenReady} more ready {hiddenReady === 1 ? "row" : "rows"}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {(csvSummary?.needFixing ?? 0) > 0 && (
                    <p className="m-0 text-xs leading-4 text-ink-muted">
                      Rows that need fixing are skipped. Fix them in the file and upload it again, or send now and add them later.
                    </p>
                  )}
                </>
              )}
            </>
          )}
          {sendError && (
            <p role="alert" className="m-0 text-sm font-medium text-error">
              {sendError}
            </p>
          )}
        </div>
      </Modal>
      <ConfirmDialog
        open={discard}
        title="Discard these invites?"
        body="Nothing has been sent. If you close now, the emails, roles and file you added are lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onCancel={() => setDiscard(false)}
        onConfirm={() => {
          setDiscard(false);
          onClose();
        }}
      />
    </>
  );
}

function ReplaceFile({ onFile }: { onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button variant="text" size="sm" onClick={() => inputRef.current?.click()}>
        Replace file
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        tabIndex={-1}
        aria-label="Choose replacement file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </>
  );
}
