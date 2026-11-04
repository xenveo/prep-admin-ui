import { cn } from "@/lib/cn";
import { clock } from "./feedback-model";

export type Segment = { state: "done" | "current" | "future"; retried: boolean };

const SEG: Record<Segment["state"], string> = { done: "bg-primary", current: "bg-[#99F6E4]", future: "bg-line" };

/** LIVE + elapsed call time, question progress, and the admin "Test mode" chip. */
export function CallHeader({ connection, elapsedSec, questionNumber, segments }: {
  /** live: connected. reconnecting: was live and is coming back. connecting: never live yet on this page. */
  connection: "live" | "reconnecting" | "connecting";
  elapsedSec: number | null;
  questionNumber: number;
  segments: Segment[];
}) {
  const live = connection === "live";
  return (
    <header className="grid h-[52px] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 md:h-14 md:px-6">
      <span className="inline-flex items-center gap-2 text-[13px] font-bold tracking-[0.02em]">
        <span aria-hidden className={cn("size-2 rounded-full", live ? "bg-primary" : "bg-ink-muted")} />
        {live ? "LIVE" : connection === "reconnecting" ? "RECONNECTING" : "CONNECTING"}
        {elapsedSec !== null && (
          <span className="font-medium text-ink-muted tabular-nums">
            <span className="sr-only">, call time </span>
            {clock(elapsedSec)}
          </span>
        )}
      </span>
      <span className="flex items-center gap-2.5">
        <span className="text-[13px] font-semibold text-neutral-text">Q{questionNumber} of {segments.length}</span>
        <span
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={segments.length}
          aria-valuenow={questionNumber}
          aria-label={`Question ${questionNumber} of ${segments.length}`}
          className="flex gap-1"
        >
          {segments.map((s, i) => (
            <span key={i} className={cn("relative h-1.5 w-[18px] rounded-full md:w-7", SEG[s.state])}>
              {s.retried && (
                <span aria-hidden className="absolute -top-[15px] left-1/2 -translate-x-1/2 text-[11px] leading-none text-primary-text">↻</span>
              )}
            </span>
          ))}
        </span>
      </span>
      <span className="flex items-center justify-self-end gap-2">
        <span className="inline-flex min-h-[26px] items-center rounded-full border border-dashed border-input-line px-2.5 text-[12px] font-semibold text-neutral-text">
          Test mode
        </span>
      </span>
    </header>
  );
}
