"use client";

import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusChip } from "@/components/ui/status-chip";
import { cn } from "@/lib/cn";

export type RoleChoice = {
  id: string;
  title: string;
  meta: string;
  status: "approved" | "draft";
  approveHref?: string;
};

export function RoleChecklist({
  roles,
  selectedIds,
  onChange,
  label,
}: {
  roles: RoleChoice[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="rounded-md border border-line bg-surface">
      {roles.map((r, i) => {
        const draft = r.status === "draft";
        const checked = selectedIds.includes(r.id);
        return (
          <div
            key={r.id}
            className={cn(
              "flex min-h-[52px] items-center gap-3 px-3 py-2",
              i > 0 && "border-t border-line",
            )}
          >
            <Checkbox
              checked={checked}
              disabled={draft}
              label={`${r.title}${draft ? " (draft, approve this role first)" : ""}`}
              onChange={(next) =>
                onChange(next ? [...selectedIds, r.id] : selectedIds.filter((id) => id !== r.id))
              }
            />
            <div className={cn("flex min-w-0 flex-1 flex-col", draft && "text-ink-muted")}>
              <span className="truncate text-sm leading-5 font-semibold">{r.title}</span>
              <span className="truncate text-xs leading-4 text-ink-muted">{r.meta}</span>
            </div>
            {draft && (
              <>
                <StatusChip status="draft" />
                {r.approveHref && (
                  <Link
                    href={r.approveHref}
                    className="text-[13px] font-semibold text-primary-text underline"
                  >
                    Approve this role first
                  </Link>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
