"use client";

import { Avatar } from "@/components/ui/avatar";
import { ChangeValue } from "@/components/ui/change-value";
import type { Column } from "@/components/ui/data-table";
import type { MenuItem } from "@/components/ui/menu";
import { ScoreCell } from "@/components/ui/score-cell";
import { StatusChip, type ChipStatus } from "@/components/ui/status-chip";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import type { CandidateRow, CandidateStatus, RoleRef } from "@/lib/types";

export const STATUS_CHIP: Record<CandidateStatus, ChipStatus> = {
  invite_pending: "invite-pending",
  active: "active",
  deactivated: "deactivated",
  revoked: "revoked",
};

function RoleName({ role }: { role: RoleRef }) {
  if (role.status === "draft") {
    return (
      <Tooltip content="This role is still a draft, so the candidate cannot see it yet">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[13px] text-ink-soft">{role.title}</span>
          <span className="shrink-0 text-xs font-semibold text-improve-text">Draft</span>
        </span>
      </Tooltip>
    );
  }
  return <span className="truncate text-[13px] text-ink-soft">{role.title}</span>;
}

export function candidateColumns(): Column<CandidateRow>[] {
  return [
    {
      id: "name",
      header: "Candidate",
      width: "minmax(240px, 2.2fr)",
      sortable: true,
      skeletonWidth: 150,
      render: (r) => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={r.name} size={32} />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm leading-5 font-semibold text-ink">{r.name}</span>
            <span className="truncate text-[13px] leading-[18px] text-ink-faint">{r.email}</span>
          </span>
        </span>
      ),
    },
    {
      id: "roles",
      header: "Roles",
      width: "minmax(200px, 1.6fr)",
      skeletonWidth: 120,
      render: (r) => {
        if (r.roles.length === 0) return <span className="text-[13px] text-ink-faint">—</span>;
        const rest = r.roles.slice(1);
        return (
          <span title={r.roles.map((x) => x.title).join(", ")} className="flex min-w-0 items-center gap-1.5">
            <RoleName role={r.roles[0]} />
            {rest.length > 0 && (
              <span className="flex-none rounded-md bg-neutral-soft px-1.5 py-0.5 text-xs leading-4 text-ink-muted">
                +{rest.length}
                <span className="sr-only"> more: {rest.map((x) => x.title).join(", ")}</span>
              </span>
            )}
          </span>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      width: 90,
      sortable: true,
      skeletonWidth: 60,
      // 90px column (design); "Invite pending" wraps rather than spilling into the next column.
      render: (r) => <StatusChip status={STATUS_CHIP[r.status]} className="min-w-0 whitespace-normal" />,
    },
    {
      id: "sessions",
      header: "Sessions",
      width: 72,
      align: "right",
      sortable: true,
      skeletonWidth: 20,
      render: (r) => (
        <span className={cn("font-mono text-[13px]", r.sessions === 0 ? "text-ink-faint" : "text-ink")}>{r.sessions}</span>
      ),
    },
    {
      id: "score",
      header: "Latest score",
      width: "minmax(180px, 1.3fr)",
      sortable: true,
      skeletonWidth: 110,
      render: (r) => (
        <ScoreCell score={r.latestScore} band={r.band ?? undefined} emptyLabel={r.sessions === 0 ? "No sessions yet" : undefined} />
      ),
    },
    {
      id: "change",
      header: "Since baseline",
      headerTooltip: "Change since baseline",
      width: 110,
      sortable: true,
      skeletonWidth: 30,
      render: (r) => (
        <span className="text-[13px] text-ink-faint">
          <ChangeValue value={r.change} />
        </span>
      ),
    },
    {
      id: "lastActive",
      header: "Last active",
      width: 100,
      align: "right",
      sortable: true,
      skeletonWidth: 70,
      render: (r) => (
        <span className="flex min-w-0 flex-col items-end">
          <span className="max-w-full truncate text-[13px] text-ink-soft">{r.lastActiveLabel}</span>
          {r.lastActiveNote && <span className="max-w-full truncate text-xs leading-4 text-ink-faint">{r.lastActiveNote}</span>}
        </span>
      ),
    },
  ];
}

/** Menu shared by the row ⋯ menu and the panel header menu. */
export function candidateMenuItems(
  r: { status: CandidateStatus },
  on: { resend: () => void; assign?: () => void; reactivate?: () => void; deactivate: () => void; revoke: () => void },
): MenuItem[] {
  const items: MenuItem[] = [
    {
      id: "resend",
      label: "Resend invite",
      onSelect: on.resend,
      disabled: r.status !== "invite_pending",
      disabledReason: r.status === "active" ? "Already active" : "Invite can’t be resent",
    },
  ];
  if (on.assign) items.push({ id: "assign", label: "Assign roles", onSelect: on.assign });
  if (r.status === "deactivated" && on.reactivate) items.push({id:"reactivate",label:"Reactivate",onSelect:on.reactivate});
  if (r.status === "active") {
    items.push({ id: "deactivate", label: "Deactivate", onSelect: on.deactivate, destructive: true, dividerBefore: true });
  } else if (r.status === "invite_pending") {
    items.push({ id: "revoke", label: "Revoke invite", onSelect: on.revoke, destructive: true, dividerBefore: true });
  }
  return items;
}
