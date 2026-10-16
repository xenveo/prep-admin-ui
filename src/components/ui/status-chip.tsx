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

/** Mint = live, amber = not live yet (hollow ring for an AI draft), grey = inactive. */
const DOT: Record<ChipStatus, string> = {
  draft: "bg-improve",
  "ai-draft": "border-[1.5px] border-improve bg-transparent",
  approved: "bg-primary",
  archived: "bg-neutral-line",
  "invite-pending": "bg-improve",
  active: "bg-primary",
  revoked: "bg-neutral-line",
  deactivated: "bg-neutral-line",
};

export function StatusChip({
  status,
  size = "md",
  className,
}: {
  status: ChipStatus;
  /** sm = 12px label (drawer header); md = 13px (table cells). */
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-ink-soft",
        size === "sm" ? "text-xs leading-4" : "text-[13px] leading-5",
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-[7px] shrink-0 rounded-full", DOT[status])} />
      {CHIP_LABEL[status]}
    </span>
  );
}
