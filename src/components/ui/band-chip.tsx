import { cn } from "@/lib/cn";
import { BAND_LABEL, bandForScore, type Band } from "@/lib/bands";

// Static class names so Tailwind can see them. Text is always ink: never on the band colour.
const TINT: Record<Band, string> = {
  ready: "bg-band-ready-tint",
  nearly: "bg-band-nearly-tint",
  developing: "bg-band-developing-tint",
  not_ready: "bg-band-not-ready-tint",
};
const DOT: Record<Band, string> = {
  ready: "bg-band-ready",
  nearly: "bg-band-nearly",
  developing: "bg-band-developing",
  not_ready: "bg-band-not-ready",
};

export function BandChip({ band, score, className }: { band?: Band; score?: number; className?: string }) {
  const resolved = band ?? (typeof score === "number" ? bandForScore(score) : undefined);
  if (!resolved) return <span className={cn("text-ink-muted", className)}>–</span>;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium text-ink",
        TINT[resolved],
        className,
      )}
    >
      <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", DOT[resolved])} />
      {BAND_LABEL[resolved]}
    </span>
  );
}
