import { cn } from "@/lib/cn";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function Avatar({
  name,
  size = 28,
  tone = "neutral",
  className,
}: {
  name: string;
  size?: 28 | 40;
  tone?: "neutral" | "primary";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none",
        size === 28 ? "h-7 w-7 text-[11px] leading-4" : "h-10 w-10 text-sm",
        tone === "primary" ? "bg-primary-soft text-primary-text" : "bg-neutral-soft text-neutral-text",
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
