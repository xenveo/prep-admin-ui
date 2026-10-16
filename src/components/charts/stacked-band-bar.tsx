import { BANDS, BAND_LABEL, type Band } from "@/lib/bands";
import { cn } from "@/lib/cn";

/**
 * Segment fill and label colour per band. "Nearly ready" sits on the primary line colour and
 * "Developing" on a dimmed amber, so the four segments stay distinct in both themes.
 */
export const BAND_SEGMENT: Record<Band, { background: string; color: string }> = {
  ready: { background: "var(--band-ready)", color: "var(--band-ready-on)" },
  nearly: { background: "var(--primary-line)", color: "var(--ink)" },
  developing: { background: "color-mix(in oklab, var(--band-developing) 55%, var(--surface))", color: "var(--ink)" },
  not_ready: { background: "var(--band-not-ready)", color: "var(--band-not-ready-on)" },
};

/** Swatch, band name and score range for each band. */
export function BandLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("m-0 flex list-none flex-wrap gap-x-[18px] gap-y-1.5 p-0 text-xs leading-4 text-ink-muted", className)}>
      {BANDS.map((b) => (
        <li key={b.id} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block size-2.5 shrink-0 rounded-[3px]"
            style={{ background: BAND_SEGMENT[b.id].background }}
          />
          {BAND_LABEL[b.id]}
          <span className="text-ink-faint">
            {b.min}–{b.max}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** One 28px bar split by band: counts inside segments, 3px gaps, zero segments omitted. */
export function StackedBandBar({
  label,
  counts,
  legend = true,
  className,
}: {
  /** Names the bar for screen readers, e.g. "Latest". */
  label: string;
  counts: Record<Band, number>;
  /** Show the band legend under the bar. Turn off when several bars share one legend. */
  legend?: boolean;
  className?: string;
}) {
  const total = BANDS.reduce((s, b) => s + (counts[b.id] || 0), 0);
  const visible = BANDS.filter((b) => (counts[b.id] || 0) > 0);
  const aria = `${label}: ${BANDS.map((b) => `${BAND_LABEL[b.id]} ${counts[b.id] || 0}`).join(", ")}`;

  const bar =
    total === 0 ? (
      <div
        role="img"
        aria-label={`${label}: no sessions`}
        className="flex h-7 items-center justify-center rounded-md bg-line text-xs text-ink-faint"
      >
        No sessions
      </div>
    ) : (
      <div role="img" aria-label={aria} className="flex h-7 gap-[3px] text-xs font-bold">
        {visible.map((b) => (
          <span
            key={b.id}
            className="flex min-w-9 items-center justify-center rounded-md"
            style={{ flex: counts[b.id], ...BAND_SEGMENT[b.id] }}
          >
            {counts[b.id]}
          </span>
        ))}
      </div>
    );

  if (!legend) return <div className={className}>{bar}</div>;
  return (
    <div className={cn("flex flex-col gap-3.5", className)}>
      {bar}
      <BandLegend />
    </div>
  );
}
