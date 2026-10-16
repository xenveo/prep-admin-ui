import { BAND_LABEL, BAND_VAR, bandForScore } from "@/lib/bands";
import { ChartFrame } from "@/components/charts/chart-frame";

/** Right gutter (px) that holds the threshold labels; the plot area ends here. */
const GUTTER = 110;
const THRESHOLDS = [
  { value: 85, label: "Interview ready", color: "var(--primary-line)" },
  { value: 70, label: "Nearly ready", color: "var(--primary-line)" },
  // Dim amber: half-strength developing band, visible on both the light and dark surface.
  { value: 50, label: "Developing", color: "color-mix(in srgb, var(--band-developing) 45%, transparent)" },
];

function clamp(score: number) {
  return Math.max(0, Math.min(100, score));
}

/** Session scores over time on a 0-100 scale, with dashed band thresholds labelled in the right gutter. */
export function ProgressLineChart({
  points,
  caption,
  label,
  hideTableToggle,
}: {
  points: { label: string; date: string; score: number }[];
  caption: string;
  /** Names the chart for screen readers, e.g. "Junior Data Analyst progress". */
  label?: string;
  /** Hide ChartFrame's own table toggle when the consumer provides one. */
  hideTableToggle?: boolean;
}) {
  const n = points.length;
  // x as a percentage of the plot width: one point sits in the middle, more spread over 8%-92%.
  const xs = points.map((_, i) => (n === 1 ? 50 : 8 + (i * 84) / (n - 1)));
  const aria = `${label ? `${label}: s` : "S"}ession scores ${points.map((p) => p.score).join(", ")} with thresholds at 50, 70 and 85`;

  return (
    <ChartFrame
      caption={caption}
      hideToggle={hideTableToggle}
      table={{
        caption,
        columns: ["Session", "Date", "Score", "Band"],
        rows: points.map((p) => [p.label, p.date, p.score, BAND_LABEL[bandForScore(p.score)]]),
      }}
    >
      <div role="img" aria-label={aria} className="flex flex-col gap-2.5 pt-5">
        <div
          aria-hidden="true"
          className="relative h-[170px] border-b border-line"
          style={{ marginRight: GUTTER }}
        >
          {THRESHOLDS.map((t) => (
            <div
              key={t.value}
              className="absolute left-0 flex translate-y-1/2 items-center gap-2"
              style={{ bottom: `${t.value}%`, right: -GUTTER }}
            >
              <span className="flex-1 border-t border-dashed" style={{ borderColor: t.color }} />
              <span className="w-[102px] whitespace-nowrap text-[11px] leading-[14px] text-ink-muted">
                <strong className="font-bold text-ink">{t.value}</strong> {t.label}
              </span>
            </div>
          ))}

          {n > 1 && (
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full overflow-visible"
            >
              <polyline
                points={points.map((p, i) => `${xs[i]},${100 - clamp(p.score)}`).join(" ")}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}

          {points.map((p, i) => (
            <div
              key={`${p.label}-${i}`}
              className="absolute flex -translate-x-1/2 translate-y-1/2 flex-col items-center"
              style={{ left: `${xs[i]}%`, bottom: `${clamp(p.score)}%` }}
            >
              <span className="absolute bottom-3.5 text-[13px] font-bold leading-4 text-ink">{p.score}</span>
              <span
                className="block size-3 rounded-full border-[3px] border-surface"
                style={{ background: `var(${BAND_VAR[bandForScore(p.score)].color})` }}
              />
            </div>
          ))}
        </div>

        <div aria-hidden="true" className="relative h-3.5 text-[11px] leading-[14px] text-ink-faint" style={{ marginRight: GUTTER }}>
          {points.map((p, i) => (
            <span
              key={`${p.label}-${i}`}
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${xs[i]}%` }}
            >
              {p.label}
            </span>
          ))}
        </div>
      </div>
    </ChartFrame>
  );
}
