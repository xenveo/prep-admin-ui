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

/** Filled pill colours (page headers): same families as the dots. */
const PILL: Record<ChipStatus, string> = {
  draft: "bg-improve-soft text-improve-text",
  "ai-draft": "bg-improve-soft text-ai-text",
  approved: "bg-primary-tint text-primary-text",
  archived: "bg-neutral-soft text-ink-faint",
  "invite-pending": "bg-improve-soft text-improve-text",
  active: "bg-primary-tint text-primary-text",
  revoked: "bg-neutral-soft text-ink-faint",
  deactivated: "bg-neutral-soft text-ink-faint",
};

export function StatusChip({
  status,
  size = "md",
  appearance = "text",
  className,
}: {
  status: ChipStatus;
  /** sm = 12px label (drawer header); md = 13px (table cells). A pill is 12px at md and 11px at sm. */
  size?: "sm" | "md";
  /** text = dot + plain label (tables, lists); pill = filled rounded chip (page headers). */
  appearance?: "text" | "pill";
  className?: string;
}) {
  if (appearance === "pill") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold",
          size === "sm" ? "px-2 py-0.5 text-[11px] leading-[14px]" : "px-2.5 py-[3px] text-xs leading-4",
          PILL[status],
          className,
        )}
      >
        <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", DOT[status])} />
        {CHIP_LABEL[status]}
      </span>
    );
  }
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
