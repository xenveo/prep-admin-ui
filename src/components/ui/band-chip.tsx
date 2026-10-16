import { cn } from "@/lib/cn";
import { BAND_LABEL, bandForScore, type Band } from "@/lib/bands";

// Static class names so Tailwind can see them. Band text colour on the band tint.
const TONE: Record<Band, string> = {
  ready: "bg-band-ready-tint text-band-ready-text",
  nearly: "bg-band-nearly-tint text-band-nearly-text",
  developing: "bg-band-developing-tint text-band-developing-text",
  not_ready: "bg-band-not-ready-tint text-band-not-ready-text",
};

export function BandChip({ band, score, className }: { band?: Band; score?: number; className?: string }) {
  const resolved = band ?? (typeof score === "number" ? bandForScore(score) : undefined);
  if (!resolved) return <span className={cn("text-ink-faint", className)}>–</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-[3px] text-xs leading-4 font-semibold",
        TONE[resolved],
        className,
      )}
    >
      {BAND_LABEL[resolved]}
    </span>
  );
}
