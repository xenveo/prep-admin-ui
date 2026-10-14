import { bandForScore, type Band } from "@/lib/bands";
import { BandChip } from "./band-chip";

export function ScoreCell({ score, band }: { score?: number | null; band?: Band }) {
  if (score == null) {
    return (
      <span className="inline-flex items-center justify-end">
        <span aria-hidden="true" className="text-ink-muted">–</span>
        <span className="sr-only">No score yet</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="min-w-[22px] text-right font-semibold">{score}</span>
      <BandChip band={band ?? bandForScore(score)} />
    </span>
  );
}
