import { bandForScore, type Band } from "@/lib/bands";
import { BandChip } from "./band-chip";

export function ScoreCell({
  score,
  band,
  emptyLabel,
}: {
  score?: number | null;
  band?: Band;
  /** Shown after the dash when there's no score, e.g. "No sessions yet". */
  emptyLabel?: string;
}) {
  if (score == null) {
    return (
      <span className="inline-flex min-w-0 items-center gap-2.5">
        <span aria-hidden="true" className="w-7 shrink-0 text-right text-[15px] font-semibold text-ink-faint">
          —
        </span>
        {emptyLabel ? (
          <span className="truncate text-xs leading-4 text-ink-faint">{emptyLabel}</span>
        ) : (
          <span className="sr-only">No score yet</span>
        )}
      </span>
    );
  }
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      <span className="w-7 shrink-0 text-right text-[15px] font-semibold text-ink">{score}</span>
      <BandChip band={band ?? bandForScore(score)} />
    </span>
  );
}
