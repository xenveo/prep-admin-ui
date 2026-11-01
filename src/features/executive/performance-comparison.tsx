import { cn } from "@/lib/cn";

export function ScoreChange({
  value,
  className,
}: {
  value: number | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        value == null || value === 0
          ? "text-ink-muted"
          : value > 0
            ? "text-primary-text"
            : "text-improve-text",
        className,
      )}
    >
      {value == null
        ? "—"
        : `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)} pts`}
    </span>
  );
}

/** A shared 0–100 score scale. The outlined point is first; the solid point is latest. */
export function ScoreComparison({
  first,
  latest,
  label,
  compact = false,
}: {
  first: number | null;
  latest: number | null;
  label: string;
  compact?: boolean;
}) {
  if (first == null || latest == null)
    return (
      <span className="text-xs text-ink-faint">Not enough practice yet</span>
    );
  const a = 16 + first * 2.68;
  const b = 16 + latest * 2.68;
  const tone = latest >= first ? "var(--primary)" : "var(--improve)";
  return (
    <svg
      className={cn(
        "block w-full overflow-visible",
        compact ? "h-7" : "h-[76px]",
      )}
      viewBox={`0 0 300 ${compact ? 28 : 76}`}
      role="img"
      aria-label={`${label}: first ${first.toFixed(1)}, latest ${latest.toFixed(1)}, out of 100`}
    >
      {!compact &&
        [0, 25, 50, 75, 100].map((n) => (
          <g key={n}>
            <line
              x1={16 + n * 2.68}
              x2={16 + n * 2.68}
              y1="26"
              y2="52"
              stroke="var(--line)"
            />
            <text
              x={16 + n * 2.68}
              y="69"
              textAnchor="middle"
              fontSize="10"
              fill="var(--ink-faint)"
            >
              {n}
            </text>
          </g>
        ))}
      <line
        x1="16"
        x2="284"
        y1={compact ? 14 : 40}
        y2={compact ? 14 : 40}
        stroke="var(--line)"
        strokeWidth="2"
      />
      <line
        x1={Math.min(a, b)}
        x2={Math.max(a, b)}
        y1={compact ? 14 : 40}
        y2={compact ? 14 : 40}
        stroke={tone}
        strokeWidth="4"
      />
      <circle
        cx={a}
        cy={compact ? 14 : 40}
        r="5"
        fill="var(--surface)"
        stroke="var(--ink-muted)"
        strokeWidth="2"
      />
      <circle cx={b} cy={compact ? 14 : 40} r="5" fill={tone} />
      {!compact && (
        <>
          <text
            x={a - 5}
            y="17"
            textAnchor="end"
            fontSize="12"
            fill="var(--ink-muted)"
          >
            {first.toFixed(1)}
          </text>
          <text
            x={b + 5}
            y="17"
            textAnchor="start"
            fontSize="12"
            fill={
              latest >= first ? "var(--primary-text)" : "var(--improve-text)"
            }
          >
            {latest.toFixed(1)}
          </text>
        </>
      )}
    </svg>
  );
}

export function ComparisonLegend() {
  return (
    <div className="flex flex-wrap items-center gap-5 text-xs text-ink-muted">
      <span className="inline-flex items-center gap-2">
        <i className="size-2.5 rounded-full border-2 border-ink-muted bg-surface" />
        First session
      </span>
      <span className="inline-flex items-center gap-2">
        <i className="size-2.5 rounded-full bg-primary" />
        Latest session
      </span>
      <span className="text-ink-faint">Score out of 100</span>
    </div>
  );
}
