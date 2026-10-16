import { BAND_LABEL, BAND_VAR, bandForScore } from "@/lib/bands";
import { ChartFrame } from "@/components/charts/chart-frame";

const W = 560;
const H = 160;
const PAD_L = 8;
const PLOT_R = 440; // plot area right edge; threshold labels sit to the right
const TOP = 16;
const BOTTOM = 134;
const THRESHOLDS = [
  { value: 85, label: "85 Interview ready", band: "ready" as const },
  { value: 70, label: "70 Nearly ready", band: "nearly" as const },
  { value: 50, label: "50 Developing", band: "developing" as const },
];

function y(score: number) {
  const s = Math.max(40, Math.min(100, score));
  return BOTTOM - ((s - 40) / 60) * (BOTTOM - TOP);
}

/** Session scores over time with dashed thresholds. Scale is 40-100 so the threshold lines stay legible. */
export function ProgressLineChart({
  points,
  caption,
  label,
}: {
  points: { label: string; date: string; score: number }[];
  caption: string;
  /** Names the chart for screen readers, e.g. "Junior Data Analyst progress". */
  label?: string;
}) {
  const n = points.length;
  const xs = points.map((_, i) =>
    n === 1 ? (PAD_L + PLOT_R) / 2 : PAD_L + 32 + (i * (PLOT_R - PAD_L - 64)) / (n - 1),
  );
  const aria = `${label ? `${label}: s` : "S"}ession scores ${points.map((p) => p.score).join(", ")} with thresholds at 50, 70 and 85`;

  return (
    <ChartFrame
      caption={caption}
      table={{
        caption,
        columns: ["Session", "Date", "Score", "Band"],
        rows: points.map((p) => [p.label, p.date, p.score, BAND_LABEL[bandForScore(p.score)]]),
      }}
    >
      <div role="img" aria-label={aria} className="max-w-[560px]">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" aria-hidden="true" className="block h-auto overflow-visible">
          {THRESHOLDS.map((t) => (
            <g key={t.value}>
              <line
                x1={0}
                x2={PLOT_R}
                y1={y(t.value)}
                y2={y(t.value)}
                stroke={`var(${BAND_VAR[t.band].color})`}
                strokeDasharray="4 4"
              />
              <text x={PLOT_R + 8} y={y(t.value) + 4} fontSize="12" fill="var(--ink)">
                {t.label}
              </text>
            </g>
          ))}
          <line x1={0} x2={PLOT_R} y1={BOTTOM} y2={BOTTOM} stroke="var(--line)" />
          {n > 1 && (
            <polyline
              points={points.map((p, i) => `${xs[i]},${y(p.score)}`).join(" ")}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          )}
          {points.map((p, i) => (
            <g key={`${p.label}-${i}`}>
              <circle cx={xs[i]} cy={y(p.score)} r="4.5" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2.5" />
              <text
                x={xs[i]}
                y={y(p.score) - 10}
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill="var(--ink)"
              >
                {p.score}
              </text>
              <text x={xs[i]} y={BOTTOM + 16} textAnchor="middle" fontSize="11" fill="var(--ink-muted)">
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </ChartFrame>
  );
}

