import { cn } from "@/lib/cn";

export function ChangeValue({ value, since = "baseline" }: { value: number | null; since?: string }) {
  if (value == null) {
    return (
      <span>
        <span aria-hidden="true" className="text-ink-muted">–</span>
        <span className="sr-only">No change to show yet</span>
      </span>
    );
  }
  const text = value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : "0";
  const sr =
    value > 0
      ? `Up ${value} points since ${since}`
      : value < 0
        ? `Down ${Math.abs(value)} points since ${since}`
        : `No change since ${since}`;
  return (
    <span>
      <span
        aria-hidden="true"
        className={cn("font-semibold", value > 0 ? "text-primary-text" : value < 0 ? "text-improve-text" : "text-ink-muted")}
      >
        {text}
      </span>
      <span className="sr-only">{sr}</span>
    </span>
  );
}
