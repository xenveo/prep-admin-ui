import { clock, type PaceSpark } from "./feedback-model";

const W = 300;
const H = 56;

/** Words per minute across the answer, with the comfortable band shaded and the rushed parts in amber. */
export function PaceSparkline({ spark }: { spark: PaceSpark }) {
  const { series, target, scale } = spark;
  const span = Math.max(1, scale.max - scale.min);
  const y = (v: number) => H - ((Math.min(scale.max, Math.max(scale.min, v)) - scale.min) / span) * H;
  const pts = series.map((v, i) => `${((i / (series.length - 1)) * W).toFixed(1)},${y(v).toFixed(1)}`);

  // Runs of segments where either end is above the band.
  const rushed: string[][] = [];
  for (let i = 0; i < series.length - 1; i++) {
    if (series[i] <= target.max && series[i + 1] <= target.max) continue;
    const run = rushed[rushed.length - 1];
    if (run && run[run.length - 1] === pts[i]) run.push(pts[i + 1]);
    else rushed.push([pts[i], pts[i + 1]]);
  }
  const fast = series.some((v) => v > target.max);
  const slow = series.some((v) => v < target.min);
  const aria = fast
    ? `Pace over time, above ${target.max} words a minute in parts of the answer`
    : slow
      ? `Pace over time, below ${target.min} words a minute in parts of the answer`
      : `Pace over time, inside the ${target.min} to ${target.max} band throughout`;

  return (
    <div className="flex flex-col gap-1">
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={aria}>
        <rect x="0" y={y(target.max)} width={W} height={Math.max(0, y(target.min) - y(target.max))} fill="#5EEAD4" fillOpacity="0.2" />
        <polyline points={pts.join(" ")} fill="none" stroke="#C9CDCB" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {rushed.map((run, i) => (
          <polyline key={i} points={run.join(" ")} fill="none" stroke="#FBBF24" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        ))}
      </svg>
      <span className="flex justify-between gap-2 text-[11px] text-ink-muted">
        <span>0:00</span>
        <span className="text-center text-primary-text">Shaded: comfortable {target.min}–{target.max} wpm</span>
        <span>{clock(spark.durationSec)}</span>
      </span>
    </div>
  );
}
