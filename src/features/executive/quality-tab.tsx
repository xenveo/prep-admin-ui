"use client";

import type {
  ExecutiveInsights,
  ExecutiveFlagType,
} from "@/lib/api/executive-contracts";
import { Card, KpiStrip, Meter, fmtNum, fmtPct } from "./parts";
const FLAG_LABEL: Record<ExecutiveFlagType, string> = {
  too_high: "Score too high",
  too_low: "Score too low",
  feedback: "Feedback inaccurate",
  transcript: "Transcript wrong",
};

export function QualityTab({ data }: { data: ExecutiveInsights["quality"] }) {
  const flagMax = Math.max(1, ...Object.values(data.flags.byType));
  return (
    <div className="flex flex-col gap-5">
      <KpiStrip
        label="Session quality summary"
        items={[
          {
            label: "Session completion",
            value: fmtPct(data.completion),
            note: `${data.sessions.completed} of ${data.sessions.started} started · ${data.sessions.abandoned} abandoned · ${data.sessions.unfinished} unfinished`,
            info: "Sessions started in the reporting month with at least one submitted answer. A still-open session is unfinished, not abandoned.",
          },
          {
            label: "Evaluation flags",
            value: fmtNum(data.flagRate, 1),
            unit: "per 100 sessions",
            note: `${data.flags.total} flags`,
            info: "Flags created in the reporting period per 100 completed sessions. This is a review signal, not a proof of score accuracy.",
          },
          {
            label: "Flag resolution",
            value: fmtNum(data.resolutionHours, 1),
            unit: "hours median",
            note: `${data.flags.unresolved} still open at cutoff`,
            info: "Only flags resolved before the report cutoff contribute to resolution time. Later resolutions do not rewrite historical open counts.",
          },
        ]}
      />
      <Card
        id="flags-h"
        title="What recruiters are flagging"
        sub={`${data.flags.total} flags on scores or feedback in this period`}
      >
        <ul className="m-0 flex max-w-[720px] list-none flex-col gap-3 p-0">
          {(Object.keys(FLAG_LABEL) as ExecutiveFlagType[]).map((k) => (
            <li
              key={k}
              className="grid grid-cols-[150px_minmax(0,1fr)_32px] items-center gap-3 text-sm"
            >
              <span className="text-ink">{FLAG_LABEL[k]}</span>
              <Meter value={data.flags.byType[k] / flagMax} className="h-2" />
              <span className="text-right font-semibold tabular-nums">
                {data.flags.byType[k]}
              </span>
            </li>
          ))}
        </ul>
        <p className="m-0 text-[13px] leading-5 text-ink-muted">
          Compare flags by dimension and prompt version before changing scoring.
        </p>
      </Card>
    </div>
  );
}
