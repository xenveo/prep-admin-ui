"use client";

import { cn } from "@/lib/cn";
import type { PreviewAttempt } from "@/services/preview";
import { feedbackRows, feedbackTip, type FeedbackRow } from "./feedback-model";
import { PaceSparkline } from "./pace-sparkline";

/** The choice after a first try, while the question waits for it. */
export type RetryChoice = {
  recommended: "retry" | "next";
  /** The choice being sent, if any. */
  pending: "retry" | "next" | null;
  onRetry: () => void;
  onNext: () => void;
};

function Dots({ label, n }: { label: string; n: number }) {
  return (
    <span role="img" aria-label={`${label} ${n} out of 5`} className="flex gap-1 pt-[5px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className={cn("size-2.5 rounded-full", i < n ? "bg-ink" : "bg-[#3A4240]")} />
      ))}
    </span>
  );
}

/** Content / Pacing / Confidence rows, also shown read-only in the transcript. */
export function FeedbackRows({ rows, dense = false }: { rows: FeedbackRow[]; dense?: boolean }) {
  return (
    <>
      {rows.map((r) => (
        <div
          key={r.key}
          className={cn(
            "grid items-start rounded-[10px] px-3 py-2.5",
            dense ? "grid-cols-[96px_1fr] gap-x-2.5 gap-y-1.5" : "grid-cols-[96px_1fr] gap-x-2.5 gap-y-1.5 md:grid-cols-[110px_80px_minmax(0,1fr)] md:gap-3",
          )}
        >
          <span className="pt-px text-[14px] font-semibold">{r.label}</span>
          <Dots label={r.label} n={r.dots} />
          <div className={cn("col-span-full flex min-w-0 flex-col gap-2", !dense && "md:col-span-1")}>
            {r.text && <span className="text-[14px] leading-[21px] text-neutral-text">{r.text}</span>}
            {r.spark && <PaceSparkline spark={r.spark} />}
            {r.chips && (
              <span className="flex flex-wrap gap-1.5">
                {r.chips.map((c) => (
                  <span key={c} className="inline-flex min-h-[30px] items-center rounded-full border border-neutral-line px-2.5 text-[12px] font-semibold text-neutral-text">
                    {c}
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

function Bulb() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-px shrink-0">
      <path d="M9 18h6" /><path d="M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
    </svg>
  );
}

const BTN = "min-h-12 cursor-pointer rounded-xl px-5 text-[15px] font-semibold max-md:flex-[1_1_100%] disabled:cursor-wait disabled:opacity-70";
const PRIMARY = "bg-primary text-on-primary hover:bg-primary/90";
const SECONDARY = "border border-neutral-line bg-transparent text-ink hover:bg-white/5";

/**
 * Written feedback for one scored try, shown while the interviewer speaks it. After a first try it
 * carries the "try again / next question" choice; after a second try a single "Next question" dismisses it.
 * Below md it becomes a bottom sheet with sticky choices.
 */
export function FeedbackCard({
  questionNumber,
  attemptNo,
  attempt,
  improved = [],
  followUp,
  choice,
  onDismiss,
}: {
  questionNumber: number;
  attemptNo: 1 | 2;
  attempt: PreviewAttempt;
  /** Rows that improved over the first try (second try only). */
  improved?: string[];
  /** The follow-up the second try should answer (first try only). */
  followUp?: string | null;
  choice?: RetryChoice | null;
  onDismiss?: () => void;
}) {
  const rows = feedbackRows(attempt);
  const tip = feedbackTip(attempt.feedback);
  const retry = { key: "retry" as const, label: "Try this question again", onClick: choice?.onRetry };
  const next = { key: "next" as const, label: "Next question →", onClick: choice?.onNext };
  const buttons = choice ? (choice.recommended === "next" ? [next, retry] : [retry, next]) : null;

  return (
    <section
      aria-labelledby="card-h"
      className="flex w-full max-w-[760px] shrink-0 flex-col gap-3 border border-line bg-[#161A19] px-3.5 pt-3.5 pb-4 shadow-[0_-16px_40px_rgba(0,0,0,0.35)] max-md:mt-auto max-md:rounded-t-2xl md:rounded-2xl md:px-5 md:py-[18px]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h2 id="card-h" className="m-0 text-base font-semibold">
          Your answer to Q{questionNumber} · Attempt {attemptNo}
        </h2>
        {attemptNo === 2 && improved.length > 0 && (
          <span className="inline-flex min-h-[26px] items-center gap-1.5 rounded-full bg-primary-soft px-2.5 text-[12px] font-bold text-primary-text">
            {improved.map((l) => `↑ ${l}`).join(" · ")} vs attempt 1
          </span>
        )}
      </div>

      <FeedbackRows rows={rows} />

      {tip && (
        <p className="m-0 flex items-start gap-2.5 px-3 py-2.5 text-[14px] leading-[21px] text-ink">
          <Bulb />
          <span><strong className="font-semibold">Tip:</strong> {tip}</span>
        </p>
      )}

      {attemptNo === 1 && followUp && (
        <div className="flex flex-col gap-1 rounded-[10px] bg-primary-soft px-3 py-2.5">
          <span className="text-[12px] font-bold text-primary-text">Follow-up for your second try</span>
          <p className="m-0 text-[15px] leading-[22px] font-semibold text-ink">{followUp}</p>
        </div>
      )}

      {(buttons || onDismiss) && (
        <div className="flex flex-wrap items-center gap-2.5 max-md:sticky max-md:bottom-0 max-md:-mx-3.5 max-md:-mb-4 max-md:border-t max-md:border-line max-md:bg-[#161A19] max-md:px-3.5 max-md:pt-3 max-md:pb-3.5">
          {buttons ? (
            <>
              {buttons.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  disabled={!!choice?.pending}
                  onClick={b.onClick}
                  className={cn(BTN, b.key === choice?.recommended ? PRIMARY : SECONDARY)}
                >
                  {choice?.pending === b.key ? "One moment…" : b.label}
                </button>
              ))}
              <span className="text-[13px] text-ink-muted max-md:hidden">or just say “again” or “next”</span>
            </>
          ) : (
            <button type="button" onClick={onDismiss} className={cn(BTN, PRIMARY)}>Next question →</button>
          )}
        </div>
      )}
    </section>
  );
}
