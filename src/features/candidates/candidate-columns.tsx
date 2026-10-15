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

const roleChip = "inline-flex h-6 max-w-[200px] items-center rounded-full border px-2.5 text-xs font-medium whitespace-nowrap";

function RoleChip({ role }: { role: RoleRef }) {
  if (role.status === "draft") {
    return (
      <Tooltip content="This role is still a draft, so the candidate cannot see it yet">
        <span className={cn(roleChip, "border-improve bg-surface text-improve-text")}>
          <span className="truncate">{role.title}</span>
          <span className="shrink-0">&nbsp;· Draft</span>
        </span>
      </Tooltip>
    );
  }
  return (
    <span className={cn(roleChip, "border-neutral-soft bg-neutral-soft text-neutral-text")}>
      <span className="truncate">{role.title}</span>
    </span>
  );
}

export function candidateColumns(): Column<CandidateRow>[] {
  return [
    {
      id: "name",
      header: "Name",
      width: "minmax(220px, 2fr)",
      sortable: true,
      skeletonWidth: 150,
      render: (r) => (
        <span className="flex min-w-0 items-center gap-3">
          <Avatar name={r.name} size={28} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold text-ink">{r.name}</span>
            <span className="truncate text-xs leading-4 text-ink-muted">{r.email}</span>
          </span>
        </span>
      ),
    },
    {
      id: "roles",
      header: "Roles",
      width: "minmax(170px, 1.4fr)",
      skeletonWidth: 120,
      render: (r) => {
        if (r.roles.length === 0) return <span className="text-ink-muted">–</span>;
        const rest = r.roles.slice(1);
        return (
          <span className="flex min-w-0 items-center gap-1.5">
            <RoleChip role={r.roles[0]} />
            {rest.length > 0 && (
              <span
                title={rest.map((x) => x.title).join(", ")}
                className={cn(roleChip, "shrink-0 border-neutral-soft bg-neutral-soft text-neutral-text")}
              >
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
      width: 128,
      sortable: true,
      skeletonWidth: 80,
      render: (r) => <StatusChip status={STATUS_CHIP[r.status]} />,
    },
    {
      id: "sessions",
      header: "Sessions",
      width: 84,
      align: "right",
      sortable: true,
      skeletonWidth: 20,
      render: (r) => <span>{r.sessions}</span>,
    },
    {
      id: "score",
      header: "Latest score",
      width: 188,
      sortable: true,
      skeletonWidth: 110,
      render: (r) => <ScoreCell score={r.latestScore} band={r.band ?? undefined} />,
    },
    {
      id: "change",
      header: "Since baseline",
      headerTooltip: "Change since baseline",
      width: 120,
      align: "right",
      sortable: true,
      skeletonWidth: 30,
      render: (r) => <ChangeValue value={r.change} />,
    },
    {
      id: "lastActive",
      header: "Last active",
      width: 132,
      sortable: true,
      skeletonWidth: 80,
      render: (r) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{r.lastActiveLabel}</span>
          {r.lastActiveNote && <span className="truncate text-xs leading-4 text-ink-muted">{r.lastActiveNote}</span>}
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
