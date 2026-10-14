import { BAND_LABEL, BAND_VAR, bandForScore } from "@/lib/bands";
import { cn } from "@/lib/cn";

/** Ring with --line track and band-coloured arc. Consumers always pair it with a BandChip. */
export function ScoreRing({ score, size = 72, className }: { score: number; size?: 64 | 72; className?: string }) {
  const band = bandForScore(score);
  const stroke = 7;
  const r = (size - stroke) / 2 - 1;
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
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
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
        className="absolute inset-0 flex items-center justify-center font-bold text-ink"
        style={{ fontSize: size === 72 ? 22 : 20 }}
      >
        {score}
      </span>
    </div>
  );
}
