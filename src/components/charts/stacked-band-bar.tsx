import { BANDS, BAND_LABEL, BAND_VAR, type Band } from "@/lib/bands";
import { cn } from "@/lib/cn";

/** Counts inside segments, 2px gaps, zero segments omitted, legend below. */
export function StackedBandBar({
  label,
  counts,
  className,
}: {
  label: string;
  counts: Record<Band, number>;
  className?: string;
}) {
  const total = BANDS.reduce((s, b) => s + (counts[b.id] || 0), 0);
  const visible = BANDS.filter((b) => (counts[b.id] || 0) > 0);
  const aria = `${label}: ${BANDS.map((b) => `${BAND_LABEL[b.id]} ${counts[b.id] || 0}`).join(", ")}`;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {total === 0 ? (
        <div
          role="img"
          aria-label={`${label}: no data`}
          className="flex h-7 items-center rounded-md bg-neutral-soft px-3 text-[12px] text-ink-muted"
        >
          No data
        </div>
      ) : (
        <div role="img" aria-label={aria} className="flex h-7 gap-[2px] overflow-hidden rounded-md text-[13px] font-bold">
          {visible.map((b) => (
            <span
              key={b.id}
              className="flex min-w-0 items-center justify-center"
              style={{
                flex: counts[b.id],
                background: `var(${BAND_VAR[b.id].color})`,
                color: `var(${BAND_VAR[b.id].on})`,
              }}
            >
              {counts[b.id]}
            </span>
          ))}
        </div>
      )}
      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[12px] text-ink">
        {BANDS.map((b) => (
          <li key={b.id} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block size-2 rounded-full"
              style={{ background: `var(${BAND_VAR[b.id].color})` }}
            />
            {BAND_LABEL[b.id]} {counts[b.id] || 0}
          </li>
        ))}
      </ul>
    </div>
  );
}
