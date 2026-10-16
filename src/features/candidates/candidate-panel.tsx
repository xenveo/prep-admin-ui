"use client";

import Link from "next/link";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { ProgressLineChart } from "@/components/charts/progress-line-chart";
import { Avatar } from "@/components/ui/avatar";
import { BandChip } from "@/components/ui/band-chip";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Menu } from "@/components/ui/menu";
import { SidePanel } from "@/components/ui/side-panel";
import { StatusChip } from "@/components/ui/status-chip";
import { cn } from "@/lib/cn";
import { formatMinutes, formatShortDate, formatShortDateTime, formatSigned, invitedLabel, relativeDay } from "@/lib/format";
import type { CandidateDetail, ProgressPoint, RoleAssignment } from "@/lib/types";
import { useAsync } from "@/lib/use-async";
import { getCandidate } from "@/services/candidates";
import { candidateMenuItems, STATUS_CHIP } from "./candidate-columns";
import type { ConfirmState } from "./confirm-copy";

/** Most pips drawn for a session limit; larger limits are scaled down to this many. */
const MAX_PIPS = 10;

function SectionTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h3 id={id} className="m-0 font-mono text-xs leading-4 font-medium tracking-[0.08em] text-ink-faint uppercase">
      {children}
    </h3>
  );
}

/** A3. Rendered while ?candidate= is set. `version` bumps after a mutation so the detail reloads. */
export function CandidatePanel({
  candidateId,
  fallbackName,
  version,
  onClose,
  onResend,
  onReactivate,
  onAssign,
  onConfirm,
}: {
  candidateId: string;
  fallbackName?: string;
  version: number;
  onClose: () => void;
  onResend: (id: string) => void;
  onReactivate: (id: string) => void;
  onAssign: (d: CandidateDetail) => void;
  onConfirm: (c: ConfirmState) => void;
}) {
  const titleId = useId();
  const progressRegionId = useId();
  const { data, error, reload } = useAsync(() => getCandidate(candidateId), [candidateId, version]);
  const d = data && data.id === candidateId ? data : undefined;
  const name = d?.name ?? fallbackName ?? "Candidate";

  // Progress is charted one role at a time. The pick is keyed to the candidate so it resets
  // when the panel switches candidates, and falls back to the most recent role if it disappears.
  const [rolePick, setRolePick] = useState<{ candidateId: string; roleId: string } | null>(null);
  const [asTable, setAsTable] = useState(false);
  const assignments = d?.assignments ?? [];
  const recentRoleId = rolesByRecency(d?.progress ?? []).find((r) =>
    assignments.some((a) => a.roleId === r.roleId),
  )?.roleId;
  const progressRole =
    assignments.find((a) => rolePick?.candidateId === candidateId && a.roleId === rolePick.roleId) ??
    assignments.find((a) => a.roleId === recentRoleId) ??
    assignments[0];
  const rolePoints = progressRole ? (d?.progress ?? []).filter((p) => p.roleId === progressRole.roleId) : [];
  const roleChange = progressRole?.changeSinceBaseline ?? null;

  const pending = d?.status === "invite_pending";
  const menuItems = d
    ? candidateMenuItems(d, {
        resend: () => onResend(d.id),
        reactivate: () => onReactivate(d.id),
        deactivate: () =>
          onConfirm({ kind: "deactivate", id: d.id, name: d.name, sessions: d.sessions.length }),
        revoke: () => onConfirm({ kind: "revoke", id: d.id, name: d.name }),
      })
    : [];

  return (
    <SidePanel
      open
      onClose={onClose}
      titleId={titleId}
      header={
        <div className="flex items-center gap-3.5">
          <Avatar name={name} size={44} />
          <div className="flex min-w-0 flex-col gap-[3px]">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 id={titleId} className="m-0 truncate text-[18px] leading-6 font-semibold tracking-[-0.01em] text-ink">
                {name}
              </h2>
              {d && <StatusChip status={STATUS_CHIP[d.status]} size="sm" />}
            </div>
            <p className="m-0 truncate text-[13px] leading-5 text-ink-faint">
              {d ? `${d.email}${d.lastActiveAt ? ` · last active ${relativeDay(d.lastActiveAt)}` : ""}` : " "}
            </p>
          </div>
        </div>
      }
      headerActions={d ? <Menu label="Candidate actions" items={menuItems} triggerVariant="outline" /> : undefined}
    >
      {error && !d && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-error px-3 py-2 text-sm text-error">
          Couldn’t load this candidate.
          <Button size="sm" variant="secondary" onClick={reload}>
            Retry
          </Button>
        </div>
      )}
      {!d && !error && <PanelSkeleton />}
      {d && (
        <div className="flex flex-col gap-8">
          {error && <p role="alert" className="text-sm text-improve-text">Candidate information could not be refreshed. <Button onClick={reload}>Retry</Button></p>}
          {pending && (
            <div className="flex items-center gap-3 rounded-md bg-improve-soft px-3 py-2.5 text-improve-text">
              <Icon name="mail" size={18} />
              <p className="m-0 flex-1 text-[13px] leading-5 font-medium">
                {invitedLabel(d.invitedAt)}, not yet logged in.
              </p>
              <Button size="sm" variant="secondary" onClick={() => onResend(d.id)}>
                Resend invite
              </Button>
            </div>
          )}

          <section aria-labelledby={`${titleId}-roles`} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle id={`${titleId}-roles`}>Roles · {d.assignments.length}</SectionTitle>
              <Button size="sm" variant="secondary" iconLeft="plus" onClick={() => onAssign(d)}>
                Assign role
              </Button>
            </div>
            <div className="rounded-card border border-line bg-surface">
              {d.assignments.length === 0 ? (
                <p className="m-0 px-4 py-3.5 text-sm text-ink-faint">No roles assigned yet.</p>
              ) : (
                <ul className="m-0 list-none p-0">
                  {d.assignments.map((a) => (
                    <RoleRow
                      key={a.roleId}
                      assignment={a}
                      onRemove={() =>
                        onConfirm({
                          kind: "remove-role",
                          candidateId: d.id,
                          name: d.name,
                          roleId: a.roleId,
                          roleTitle: a.roleTitle,
                          sessionsUsed: a.sessionsUsed,
                          draft: a.roleStatus === "draft",
                        })
                      }
                    />
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section aria-labelledby={`${titleId}-progress`} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle id={`${titleId}-progress`}>Progress</SectionTitle>
              {rolePoints.length > 0 && (
                <button
                  type="button"
                  aria-controls={progressRegionId}
                  onClick={() => setAsTable((v) => !v)}
                  className="relative cursor-pointer text-[13px] leading-5 font-semibold text-ink-muted hover:text-ink after:absolute after:-inset-2 after:content-['']"
                >
                  {asTable ? "Show as chart" : "Show as table"}
                </button>
              )}
            </div>
            {progressRole && (
              <RolePicker
                label="Role shown in progress"
                options={d.assignments}
                value={progressRole.roleId}
                onChange={(roleId) => setRolePick({ candidateId, roleId })}
              />
            )}
            <div
              id={progressRegionId}
              className="flex flex-col gap-2.5 rounded-card border border-line bg-surface px-4 pt-4 pb-3"
            >
              {!progressRole ? (
                <p className="m-0 py-6 text-center text-sm text-ink-faint">
                  {d.sessions.length === 0
                    ? "No sessions yet. Scores and the progress chart appear after the first mock interview."
                    : "No roles assigned yet."}
                </p>
              ) : rolePoints.length === 0 ? (
                <p className="m-0 py-6 text-center text-sm text-ink-faint">No sessions for this role yet.</p>
              ) : asTable ? (
                <table className="w-full border-collapse text-left text-sm leading-5">
                  <caption className="sr-only">{progressRole.roleTitle} session scores, oldest first</caption>
                  <thead className="sr-only">
                    <tr>
                      <th scope="col">Session</th>
                      <th scope="col">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rolePoints.map((p, i) => (
                      <tr key={`${p.label}-${i}`}>
                        <th scope="row" className="py-1.5 font-normal text-ink-muted">
                          {p.label} · {formatShortDate(p.date)}
                        </th>
                        <td className="py-1.5 text-right font-bold text-ink">{p.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <ProgressLineChart
                  points={rolePoints}
                  label={`${progressRole.roleTitle} progress`}
                  caption=""
                  hideTableToggle
                />
              )}
              {progressRole && (
                <p className="m-0 border-t border-line pt-2.5 text-[13px] leading-5 text-ink-faint">
                  {progressNote(rolePoints.length, roleChange, asTable)}
                </p>
              )}
            </div>
          </section>

          <section aria-labelledby={`${titleId}-sessions`} className="flex flex-col gap-3">
            <SectionTitle id={`${titleId}-sessions`}>Sessions</SectionTitle>
            <div className="overflow-hidden rounded-card border border-line bg-surface">
              {d.sessions.length === 0 ? (
                <p className="m-0 p-6 text-center text-sm text-ink-faint">No sessions yet.</p>
              ) : (
                <ul className="m-0 list-none p-0">
                  {d.sessions.map((s) => (
                    <li key={s.id} className="border-t border-line first:border-t-0">
                      <Link
                        href={`/candidates/${d.id}/sessions/${s.id}`}
                        className="focus-inset grid grid-cols-[minmax(0,1fr)_44px_120px_16px] items-center gap-3.5 px-4 py-3.5 text-ink no-underline hover:bg-row-hover hover:no-underline"
                      >
                        <span className="flex min-w-0 flex-col gap-[3px]">
                          <span className="truncate text-sm leading-5 font-semibold">{s.roleTitle}</span>
                          <span className="truncate text-xs leading-4 text-ink-faint">
                            {formatShortDateTime(s.date)} · {formatMinutes(s.durationMin)} · session {s.number}
                          </span>
                        </span>
                        <span className="text-right text-base leading-6 font-semibold">
                          <span className="sr-only">, score </span>
                          {s.score}
                        </span>
                        <BandChip band={s.band} className="justify-self-start" />
                        <span className="text-ink-faint">
                          <Icon name="chevron-right" size={16} />
                          <span className="sr-only">, open session</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section aria-labelledby={`${titleId}-activity`} className="flex flex-col gap-3">
            <SectionTitle id={`${titleId}-activity`}>Activity</SectionTitle>
            {d.activity.length === 0 ? (
              <p className="m-0 text-sm text-ink-faint">No activity yet.</p>
            ) : (
              <ol className="m-0 flex list-none flex-col p-0">
                {d.activity.map((a, i) => {
                  const last = i === d.activity.length - 1;
                  return (
                    <li key={`${a.at}-${i}`} className="grid grid-cols-[12px_minmax(0,1fr)_auto] items-start gap-3.5">
                      <span aria-hidden="true" className="flex flex-col items-center self-stretch">
                        <span
                          className={cn("mt-[5px] h-[9px] w-[9px] shrink-0 rounded-full", i === 0 ? "bg-primary" : "bg-neutral-line")}
                        />
                        <span className={cn("mt-1 w-px flex-1", last ? "bg-transparent" : "bg-input-line")} />
                      </span>
                      <span className="pb-4 text-sm leading-normal text-ink">{a.text}</span>
                      <span className="pt-[3px] font-mono text-[11px] whitespace-nowrap text-ink-faint">
                        {formatShortDateTime(a.at)}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      )}
    </SidePanel>
  );
}

function RoleRow({ assignment: a, onRemove }: { assignment: RoleAssignment; onRemove: () => void }) {
  const draft = a.roleStatus === "draft";
  const pips = a.maxSessions != null ? Math.min(a.maxSessions, MAX_PIPS) : 0;
  // Limits above MAX_PIPS are drawn proportionally.
  const filled =
    a.maxSessions != null && a.maxSessions > 0
      ? Math.min(pips, Math.round((a.sessionsUsed / a.maxSessions) * pips))
      : 0;

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_120px_64px] items-center gap-4 border-t border-line px-4 py-3.5 first:border-t-0">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm leading-5 font-semibold text-ink">{a.roleTitle}</span>
          {draft && <StatusChip status="draft" />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {a.latestScore != null ? (
            <>
              <span className="text-sm leading-5 font-semibold text-ink">{a.latestScore}</span>
              <BandChip band={a.latestBand ?? undefined} score={a.latestScore} />
            </>
          ) : (
            <>
              <span className="text-sm leading-5 font-semibold text-ink-faint">
                <span aria-hidden="true">—</span>
                <span className="sr-only">No score</span>
              </span>
              <span className="inline-flex items-center rounded-full bg-neutral-soft px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-ink-faint">
                No sessions yet
              </span>
            </>
          )}
        </div>
        {draft && (
          <p className="m-0 text-xs leading-4 text-ink-faint">
            Not visible to the candidate until you approve this role.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs leading-4 text-ink-faint">
          {a.maxSessions != null ? `Sessions ${a.sessionsUsed} of ${a.maxSessions}` : `${a.sessionsUsed} sessions`}
        </span>
        {pips > 0 && (
          <span aria-hidden="true" className="flex gap-[3px]">
            {Array.from({ length: pips }, (_, i) => (
              <span key={i} className={cn("h-1 flex-1 rounded-sm", i < filled ? "bg-primary" : "bg-line")} />
            ))}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${a.roleTitle}`}
        className="relative cursor-pointer justify-self-end text-[13px] leading-5 font-semibold text-ink-faint hover:text-error after:absolute after:-inset-2 after:content-['']"
      >
        Remove
      </button>
    </li>
  );
}

/** Segmented role picker for the progress card: a radiogroup with arrow-key navigation. */
function RolePicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { roleId: string; roleTitle: string }[];
  value: string;
  onChange: (roleId: string) => void;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  const activeIndex = Math.max(0, options.findIndex((o) => o.roleId === value));

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    let next = activeIndex;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (activeIndex + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (activeIndex - 1 + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    else return;
    e.preventDefault();
    onChange(options[next].roleId);
    groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex gap-1 overflow-x-auto rounded-[9px] border border-line bg-bg p-[3px]"
    >
      {options.map((o, i) => {
        const selected = i === activeIndex;
        return (
          <button
            key={o.roleId}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.roleId)}
            className={cn(
              "flex-1 cursor-pointer rounded-md px-2.5 py-[7px] text-xs leading-4 font-semibold whitespace-nowrap",
              selected ? "bg-selected text-ink" : "text-ink-faint hover:text-ink",
            )}
          >
            {o.roleTitle}
          </button>
        );
      })}
    </div>
  );
}

function progressNote(points: number, change: number | null, asTable: boolean): string {
  if (points === 0) return "Progress appears after the first session.";
  if (points === 1) return "Baseline only. Change shows after the second session.";
  const parts = [
    change !== null ? `${formatSigned(change)} since first session` : null,
    asTable ? null : "Dashed lines are band thresholds.",
  ];
  return parts.filter(Boolean).join(" · ");
}

/** Distinct roles in `progress`, the one with the most recent session first. */
function rolesByRecency(progress: ProgressPoint[]): { roleId: string; roleTitle: string }[] {
  const latest = new Map<string, { roleId: string; roleTitle: string; time: number; index: number }>();
  progress.forEach((p, index) => {
    const time = Date.parse(p.date);
    const prev = latest.get(p.roleId);
    // Points are oldest first, so a later index wins ties and unparseable dates.
    if (!prev || !(time < prev.time)) latest.set(p.roleId, { roleId: p.roleId, roleTitle: p.roleTitle, time, index });
  });
  return [...latest.values()]
    .sort((a, b) => (b.time === a.time || Number.isNaN(a.time) || Number.isNaN(b.time) ? b.index - a.index : b.time - a.time))
    .map(({ roleId, roleTitle }) => ({ roleId, roleTitle }));
}

function PanelSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      {[70, 100, 100, 60].map((w, i) => (
        <span key={i} className="block h-4 rounded-sm bg-line" style={{ width: `${w}%` }} />
      ))}
      <span className="block h-32 rounded-md bg-line" />
    </div>
  );
}
