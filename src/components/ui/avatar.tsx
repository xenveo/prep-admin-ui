import { cn } from "@/lib/cn";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export type AvatarSize = 28 | 32 | 40 | 44;

const SIZE: Record<AvatarSize, string> = {
  28: "size-7 text-[11px] leading-4",
  32: "size-8 text-xs leading-4",
  40: "size-10 text-[13px] leading-5",
  44: "size-11 text-sm leading-5",
};

export function Avatar({
  name,
  size = 28,
  tone = "neutral",
  className,
}: {
  name: string;
  size?: AvatarSize;
  /** primary = the signed-in admin (sidebar). */
  tone?: "neutral" | "primary";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold select-none",
        SIZE[size],
        tone === "primary" ? "bg-primary-soft text-primary-text" : "bg-neutral-soft text-neutral-text",
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
