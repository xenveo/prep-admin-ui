import { BAND_LABEL, BAND_VAR, bandForScore } from "@/lib/bands";
import { cn } from "@/lib/cn";

/** Ring with --line track and band-coloured arc. Consumers always pair it with a BandChip. */
export function ScoreRing({ score, size = 72, className }: { score: number; size?: 64 | 72; className?: string }) {
  const band = bandForScore(score);
  // Design geometry at 72px: r 31, stroke 6. 64px scales proportionally.
  const scale = size / 72;
  const stroke = 6 * scale;
  const r = 31 * scale;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const mid = size / 2;
  return (
    <div
      role="img"
      aria-label={`Score ${score}, ${BAND_LABEL[band]}`}
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="block">
        <circle cx={mid} cy={mid} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={mid}
          cy={mid}
          r={r}
          fill="none"
          stroke={`var(${BAND_VAR[band].color})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform={`rotate(-90 ${mid} ${mid})`}
        />
      </svg>
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-0 flex items-center justify-center font-bold leading-none text-ink",
          size === 72 ? "text-2xl" : "text-xl",
        )}
      >
        {score}
      </span>
    </div>
  );
}
