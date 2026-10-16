"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ProgressLineChart } from "@/components/charts/progress-line-chart";
import { Avatar } from "@/components/ui/avatar";
import { BandChip } from "@/components/ui/band-chip";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Menu } from "@/components/ui/menu";
import { ScoreCell } from "@/components/ui/score-cell";
import { Select } from "@/components/ui/select";
import { SidePanel } from "@/components/ui/side-panel";
import { StatusChip } from "@/components/ui/status-chip";
import { cn } from "@/lib/cn";
import { formatMinutes, formatShortDate, formatShortDateTime, formatSigned, invitedLabel } from "@/lib/format";
import type { CandidateDetail, ProgressPoint } from "@/lib/types";
import { useAsync } from "@/lib/use-async";
import { getCandidate } from "@/services/candidates";
import { candidateMenuItems, STATUS_CHIP } from "./candidate-columns";
import type { ConfirmState } from "./confirm-copy";

function SectionTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h3 id={id} className="m-0 text-sm leading-5 font-semibold text-ink">
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
  const { data, error, reload } = useAsync(() => getCandidate(candidateId), [candidateId, version]);
  const d = data && data.id === candidateId ? data : undefined;
  const name = d?.name ?? fallbackName ?? "Candidate";

  // Progress is charted one role at a time. The pick is keyed to the candidate so it resets
  // when the panel switches candidates, and falls back to the most recent role if it disappears.
  const [rolePick, setRolePick] = useState<{ candidateId: string; roleId: string } | null>(null);
  const progressRoles = rolesByRecency(d?.progress ?? []);
  const progressRole =
    progressRoles.find((r) => rolePick?.candidateId === candidateId && r.roleId === rolePick.roleId) ??
    progressRoles[0];
  const rolePoints = progressRole ? (d?.progress ?? []).filter((p) => p.roleId === progressRole.roleId) : [];
  const roleChange = progressRole
    ? (d?.assignments.find((a) => a.roleId === progressRole.roleId)?.changeSinceBaseline ?? null)
    : null;

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
        <div className="flex items-center gap-3">
          <Avatar name={name} size={40} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={titleId} className="m-0 truncate text-base leading-6 font-semibold text-ink">
                {name}
              </h2>
              {d && <StatusChip status={STATUS_CHIP[d.status]} />}
            </div>
            <p className="m-0 truncate text-[13px] leading-5 text-ink-muted">{d?.email ?? " "}</p>
          </div>
        </div>
      }
      headerActions={d ? <Menu label="Candidate actions" items={menuItems} /> : undefined}
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
        <div className="flex flex-col gap-6">
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
            <div className="flex items-center justify-between">
              <SectionTitle id={`${titleId}-roles`}>Roles</SectionTitle>
              <Button size="sm" variant="secondary" iconLeft="plus" onClick={() => onAssign(d)}>
                Assign role
              </Button>
            </div>
            {d.assignments.length === 0 ? (
              <p className="m-0 text-sm text-ink-muted">No roles assigned yet.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {d.assignments.map((a) => {
                  const draft = a.roleStatus === "draft";
                  return (
                    <li key={a.roleId} className="rounded-md border border-line px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm leading-5 font-semibold text-ink">{a.roleTitle}</span>
                            {draft && <StatusChip status="draft" />}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-5 text-ink-muted">
                            {a.latestScore != null && <ScoreCell score={a.latestScore} band={a.latestBand ?? undefined} />}
                            <span>
                              Sessions used {a.sessionsUsed}
                              {a.maxSessions != null ? ` of ${a.maxSessions}` : ""}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onConfirm({
                              kind: "remove-role",
                              candidateId: d.id,
                              name: d.name,
                              roleId: a.roleId,
                              roleTitle: a.roleTitle,
                              sessionsUsed: a.sessionsUsed,
                              draft,
                            })
                          }
                          aria-label={`Remove ${a.roleTitle}`}
                          className="relative h-8 shrink-0 cursor-pointer rounded-md px-2.5 text-[13px] font-medium text-error hover:bg-neutral-soft after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-['']"
                        >
                          Remove
                        </button>
                      </div>
                      {draft && (
                        <p className="m-0 mt-1.5 text-xs leading-4 text-ink-muted">
                          Not visible to the candidate until you approve this role.
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {d.sessions.length === 0 ? (
            <section aria-labelledby={`${titleId}-progress`} className="flex flex-col gap-2">
              <SectionTitle id={`${titleId}-progress`}>Progress and sessions</SectionTitle>
              <p className="m-0 text-sm text-ink-muted">
                No sessions yet. Scores and the progress chart appear after the first mock interview.
              </p>
            </section>
          ) : (
            <>
              {!progressRole ? (
                <section aria-labelledby={`${titleId}-progress`} className="flex flex-col gap-2">
                  <SectionTitle id={`${titleId}-progress`}>Progress</SectionTitle>
                  <p className="m-0 text-sm text-ink-muted">
                    No scores yet. The progress chart appears after the first scored mock interview.
                  </p>
                </section>
              ) : (
                <section aria-labelledby={`${titleId}-progress`} className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <SectionTitle id={`${titleId}-progress`}>Progress</SectionTitle>
                      {progressRoles.length > 1 && (
                        <Select
                          aria-label="Role shown in the progress chart"
                          value={progressRole.roleId}
                          onChange={(e) => setRolePick({ candidateId, roleId: e.target.value })}
                          className="max-w-[220px] min-w-0"
                        >
                          {progressRoles.map((r) => (
                            <option key={r.roleId} value={r.roleId}>
                              {r.roleTitle}
                            </option>
                          ))}
                        </Select>
                      )}
                    </div>
                    {roleChange !== null ? (
                      <span
                        className={cn(
                          "text-[13px] leading-5 font-semibold",
                          roleChange > 0 ? "text-primary-text" : roleChange < 0 ? "text-improve-text" : "text-ink-muted",
                        )}
                      >
                        {formatSigned(roleChange)} since first session
                      </span>
                    ) : rolePoints.length === 1 ? (
                      <span className="text-[13px] leading-5 text-ink-muted">
                        Baseline only. Change shows after the second session.
                      </span>
                    ) : null}
                  </div>
                  <ProgressLineChart
                    points={rolePoints}
                    label={`${progressRole.roleTitle} progress`}
                    caption={`${progressRole.roleTitle} · session scores, dashed lines are band thresholds`}
                  />
                </section>
              )}

              <section aria-labelledby={`${titleId}-sessions`} className="flex flex-col gap-3">
                <SectionTitle id={`${titleId}-sessions`}>Sessions</SectionTitle>
                <div className="overflow-x-auto rounded-md border border-line">
                  <table className="w-full border-collapse text-left text-[13px] leading-5">
                    <caption className="sr-only">Sessions for {d.name}, newest first</caption>
                    <thead>
                      <tr className="h-9 border-b border-line text-xs leading-4 font-semibold text-ink-muted">
                        <th scope="col" className="px-3 font-semibold">Date</th>
                        <th scope="col" className="px-3 font-semibold">Role</th>
                        <th scope="col" className="px-3 text-right font-semibold">Score</th>
                        <th scope="col" className="px-3 font-semibold">Band</th>
                        <th scope="col" className="px-3 font-semibold">Duration</th>
                        <th scope="col" className="w-8 px-2"><span className="sr-only">Open</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.sessions.map((s) => (
                        <tr key={s.id} className="relative h-11 border-b border-line last:border-b-0 hover:bg-row-hover">
                          <td className="px-3">
                            <Link
                              href={`/candidates/${d.id}/sessions/${s.id}`}
                              className="font-medium text-ink after:absolute after:inset-0 after:content-['']"
                            >
                              {formatShortDate(s.date)}
                              <span className="sr-only">, session {s.number}, {s.roleTitle}</span>
                            </Link>
                          </td>
                          <td className="max-w-[140px] truncate px-3">{s.roleTitle}</td>
                          <td className="px-3 text-right font-semibold">{s.score}</td>
                          <td className="px-3"><BandChip band={s.band} /></td>
                          <td className="px-3 whitespace-nowrap">{formatMinutes(s.durationMin)}</td>
                          <td className="px-2 text-ink-muted"><Icon name="chevron-right" size={16} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          <section aria-labelledby={`${titleId}-activity`} className="flex flex-col gap-3">
            <SectionTitle id={`${titleId}-activity`}>Activity</SectionTitle>
            <ul className="m-0 flex list-none flex-col p-0">
              {d.activity.map((a, i) => (
                <li key={`${a.at}-${i}`} className="flex items-baseline justify-between gap-4 border-b border-line py-2 text-[13px] leading-5 last:border-b-0">
                  <span className="text-ink">{a.text}</span>
                  <span className="shrink-0 text-xs leading-4 text-ink-muted">{formatShortDateTime(a.at)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </SidePanel>
  );
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
