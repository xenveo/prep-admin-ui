import { cn } from "@/lib/cn";

export type ChipStatus =
  | "draft" | "ai-draft" | "approved" | "archived" | "invite-pending" | "active" | "revoked" | "deactivated";

export const CHIP_LABEL: Record<ChipStatus, string> = {
  draft: "Draft",
  "ai-draft": "AI draft",
  approved: "Approved",
  archived: "Archived",
  "invite-pending": "Invite pending",
  active: "Active",
  revoked: "Revoked",
  deactivated: "Deactivated",
};

/** outline = not live yet, fill = live, gray = inactive, dashed = AI draft. */
const STYLE: Record<ChipStatus, string> = {
  draft: "border border-improve text-improve-text",
  "ai-draft": "border border-dashed border-improve bg-improve-soft text-ai-text",
  approved: "bg-primary-soft text-primary-text",
  archived: "bg-neutral-soft text-neutral-text",
  "invite-pending": "border border-improve text-improve-text",
  active: "bg-primary-soft text-primary-text",
  revoked: "border border-neutral-line text-neutral-text",
  deactivated: "bg-neutral-soft text-neutral-text",
};

export function StatusChip({ status, className }: { status: ChipStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-medium",
        STYLE[status],
        className,
      )}
    >
      {CHIP_LABEL[status]}
    </span>
  );
}
