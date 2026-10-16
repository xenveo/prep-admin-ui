"use client";

import { useRef, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ScoreRing } from "@/components/charts/score-ring";
import { BandChip } from "@/components/ui/band-chip";
import { Button } from "@/components/ui/button";
import { ChangeValue } from "@/components/ui/change-value";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { downloadBlobFile } from "@/lib/csv";
import { formatDateTime, formatMinutes } from "@/lib/format";
import type { SessionQuestion, SessionReview } from "@/lib/types";
import { useAsync } from "@/lib/use-async";
import { useUrlState } from "@/lib/use-url-state";
import { exportSessionPdf, getSessionReview, listFlags } from "@/services/sessions";
import { FlagRail, type QuestionMode } from "./flag-rail";
import { SessionSkeleton } from "./session-skeleton";
import { TryCard, tryMode } from "./try-card";

const EYEBROW = "m-0 font-mono text-xs font-normal uppercase tracking-[0.08em] text-ink-faint";

/** "49 → 52", "49 · retry skipped", or "49 → —" when no second try was recorded. */
function ScorePair({ q }: { q: SessionQuestion }) {
  if (q.retrySkipped) return <>{q.firstScore} · retry skipped</>;
  if (q.secondScore === null) {
    return (
      <>
        {q.firstScore} <span aria-hidden="true">→ —</span>
        <span className="sr-only">, no second try</span>
      </>
    );
  }
  return (
    <>
      {q.firstScore} <span aria-hidden="true">→</span>
      <span className="sr-only">to</span> {q.secondScore}
    </>
  );
}

function scoresOnlyDescription(q: SessionQuestion): string {
  const first = `Only the scores are available: ${q.firstScore} on the first try`;
  if (q.retrySkipped) return `${first}; the retry was skipped.`;
  if (q.secondScore === null) return `${first}; no second try was recorded.`;
  return `${first}, ${q.secondScore} on the second.`;
}

/** Answer mode per question that has tries: shared by all tries, or "mixed". */
function questionModes(questions: SessionQuestion[]): Partial<Record<number, QuestionMode>> {
  const out: Partial<Record<number, QuestionMode>> = {};
  for (const q of questions) {
    const modes = new Set(q.tries?.map(tryMode));
    if (modes.size > 0) out[q.n] = modes.size === 1 ? [...modes][0] : "mixed";
  }
  return out;
}

/** "typed answers", "voice answers", "mixed answers", or null when no question has tries. */
function sessionModeLabel(questions: SessionQuestion[]): string | null {
  const modes = new Set(questions.flatMap((q) => q.tries?.map(tryMode) ?? []));
  if (modes.size === 0) return null;
  if (modes.size > 1) return "mixed answers";
  return modes.has("voice") ? "voice answers" : "typed answers";
}

/** First try avg × 20% + Second try avg × 55% + Learning score × 25% = Session score. */
function ScoreFormula({ r }: { r: SessionReview }) {
  const terms = [
    { label: "First try avg", weight: r.weights.firstTry, value: r.firstTryAvg, op: "+" },
    { label: "Second try avg", weight: r.weights.secondTry, value: r.secondTryAvg, op: "+" },
    { label: "Learning score", weight: r.weights.learning, value: r.learningScore, op: "=" },
  ];
  return (
    <section
      aria-label={`Session score formula: ${r.formulaText}`}
      className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-3 rounded-panel border border-line bg-surface px-[22px] py-[18px]"
    >
      <h2 className={cn(EYEBROW, "mr-1")}>Session score</h2>
      {terms.map((t) => (
        <div key={t.label} className="flex items-center gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-ink-faint">
              {t.label}
              <span aria-hidden="true" className="opacity-75"> × {t.weight}%</span>
              <span className="sr-only">, weighted {t.weight}%:</span>
            </span>
            <span className="text-xl font-semibold leading-7 text-ink">
              {t.value ?? (
                <>
                  <span aria-hidden="true">–</span>
                  <span className="sr-only">not available</span>
                </>
              )}
            </span>
          </div>
          <span aria-hidden="true" className="text-lg text-ink-faint">
            {t.op}
          </span>
        </div>
      ))}
      <div
        className={cn(
          "flex flex-col gap-0.5 rounded-[10px] px-3.5 py-1.5",
          r.score < 50 ? "bg-improve-soft text-improve-text" : "bg-primary-soft text-primary-text",
        )}
      >
        <span className="text-xs">
          Session score<span className="sr-only">:</span>
        </span>
        <span className="text-xl font-bold leading-7">{r.score}</span>
      </div>
    </section>
  );
}

export function SessionScreen({ candidateId, sessionId }: { candidateId: string; sessionId: string }) {
  const url = useUrlState();
  const review = useAsync(() => getSessionReview(candidateId, sessionId), [candidateId, sessionId]);
  const toast = useToast();
  const [exportingPdf, setExportingPdf] = useState(false);

  async function exportPdf() {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      const { blob, filename } = await exportSessionPdf(candidateId, sessionId);
      downloadBlobFile(filename, blob);
    } catch (error) {
      toast.show({ title: "Couldn’t export the PDF", detail: error instanceof Error ? error.message : "Try again." });
    } finally {
      setExportingPdf(false);
    }
  }
  const flags = useAsync(() => listFlags(sessionId), [sessionId]);
  const listRef = useRef<HTMLOListElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const r = review.data;
  if (review.error && !r) {
    return (
      <>
        <PageHeader title="Session review" breadcrumb={[{ label: "Candidates", href: "/candidates" }, { label: "Session" }]} />
        <EmptyState
          icon="alert"
          title="This session didn’t load"
          description="Something went wrong while loading the session. Your data is safe."
          action={<Button variant="primary" onClick={review.reload}>Try again</Button>}
        />
      </>
    );
  }
  if (!r) {
    return <SessionSkeleton />;
  }

  const qn = Math.min(Math.max(Number(url.get("q")) || 1, 1), Math.max(r.questions.length, 1));
  const cur = r.questions.find((q) => q.n === qn);
  const selectQuestion = (n: number) => url.set({ q: n === 1 ? null : String(n), try: null });

  const tries = cur?.tries ?? [];
  const firstTry = tries.find((t) => t.attempt === 1) ?? tries[0];
  const secondTry = tries.find((t) => t.attempt === 2 && t !== firstTry);
  const showSecond = url.get("try") === "2" && Boolean(secondTry);
  const selectedTry = showSecond ? secondTry : firstTry;
  const selectTry = (second: boolean) => url.set({ try: second ? "2" : null });

  const onListKey = (e: React.KeyboardEvent, n: number) => {
    const d = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = n + d;
    if (next < 1 || next > r.questions.length) return;
    selectQuestion(next);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLButtonElement>(`[data-q="${next}"]`)?.focus());
  };

  const onTabKey = (e: React.KeyboardEvent) => {
    if (!secondTry) return;
    let second: boolean;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") second = !showSecond;
    else if (e.key === "Home") second = false;
    else if (e.key === "End") second = true;
    else return;
    e.preventDefault();
    selectTry(second);
    tabsRef.current?.querySelector<HTMLButtonElement>(`[data-try="${second ? 2 : 1}"]`)?.focus();
  };

  const name = `${r.candidateName} · Session ${r.sessionNumber}`;
  const modeLabel = sessionModeLabel(r.questions);

  const tabClass = (on: boolean, disabled = false) =>
    cn(
      "inline-flex items-center gap-2 rounded-[7px] px-3.5 py-2 text-[13px] font-semibold",
      on ? "bg-selected text-ink" : disabled ? "text-ink-faint" : "text-ink-muted",
      disabled ? "cursor-not-allowed" : !on && "cursor-pointer hover:text-ink",
    );

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Candidates", href: "/candidates" },
          { label: r.candidateName, href: `/candidates?candidate=${encodeURIComponent(r.candidateId)}` },
          { label: `Session ${r.sessionNumber}` },
        ]}
        leading={<ScoreRing score={r.score} size={72} />}
        title={name}
        statusChip={<BandChip band={r.band} />}
        meta={
          <>
            {r.changeVsPrevious !== null && (
              <p className="m-0 mb-0.5">
                <ChangeValue value={r.changeVsPrevious} since={`session ${r.sessionNumber - 1}`} />
                <span> vs session {r.sessionNumber - 1}</span>
              </p>
            )}
            <p className="m-0">
              {r.roleTitle} · {formatDateTime(r.date)} · {formatMinutes(r.durationMin)}
              {modeLabel ? ` · ${modeLabel}` : ""}
            </p>
          </>
        }
        secondaryActions={
          <Button
            iconLeft="download"
            disabled={exportingPdf}
            aria-busy={exportingPdf || undefined}
            onClick={() => void exportPdf()}
            className="border-neutral-line! hover:border-ink-faint!"
          >
            {exportingPdf ? "Exporting…" : "Export PDF"}
          </Button>
        }
      />

      {r.hasDetail ? <ScoreFormula r={r} /> : null}

      {!r.hasDetail ? (
        <div className="rounded-panel border border-line bg-surface">
          <EmptyState
            icon="file"
            title="No answer-level detail for this session"
            description={`Only the summary is available: score ${r.score}, ${formatMinutes(r.durationMin)}. Transcripts and per-answer scores aren’t stored for this session.`}
            helper={r.formulaText}
          />
        </div>
      ) : (
        <div className="grid items-start gap-6 min-[1025px]:grid-cols-[240px_minmax(0,1fr)_280px]">
          <nav aria-labelledby="questions-heading" className="flex min-w-0 flex-col gap-2.5">
            <h2 id="questions-heading" className={EYEBROW}>
              Questions
            </h2>
            <ol ref={listRef} className="m-0 list-none overflow-hidden rounded-card border border-line bg-surface p-0">
              {r.questions.map((q, i) => {
                const on = q.n === qn;
                return (
                  <li key={q.n} className={cn(i > 0 && "border-t border-line")}>
                    <button
                      type="button"
                      data-q={q.n}
                      aria-current={on ? "true" : undefined}
                      tabIndex={on ? 0 : -1}
                      onClick={() => selectQuestion(q.n)}
                      onKeyDown={(e) => onListKey(e, q.n)}
                      className={cn(
                        "focus-inset grid w-full cursor-pointer grid-cols-[20px_minmax(0,1fr)] gap-2.5 py-3.5 pr-3.5 pl-3 text-left",
                        on ? "bg-row-hover shadow-[inset_3px_0_0_var(--primary)]" : "bg-surface hover:bg-row-hover",
                      )}
                    >
                      <span className="pt-0.5 font-mono text-xs text-ink-faint">{q.n}</span>
                      <span className="flex min-w-0 flex-col gap-1.5">
                        <span className={cn("text-[13px] leading-[1.4] text-pretty text-ink", on ? "font-semibold" : "font-medium")}>
                          {q.text}
                        </span>
                        <span className="text-xs text-ink-muted">
                          <ScorePair q={q} />
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <section aria-labelledby="q-title" className="flex min-w-0 flex-col gap-[18px]">
            {cur && (
              <>
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] text-ink-faint">
                    Question {cur.n} of {r.questions.length}
                    {cur.category ? ` · ${cur.category}` : ""}
                  </span>
                  <h2 id="q-title" className="m-0 text-[22px] font-semibold leading-[1.3] tracking-[-0.015em] text-balance text-ink">
                    {cur.text}
                  </h2>
                </div>
                {selectedTry ? (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div
                        ref={tabsRef}
                        role="tablist"
                        aria-label="Attempt"
                        onKeyDown={onTabKey}
                        className="flex gap-1 rounded-[10px] border border-line bg-surface-sunken p-[3px]"
                      >
                        <button
                          type="button"
                          role="tab"
                          id="try-tab-1"
                          data-try={1}
                          aria-selected={!showSecond}
                          aria-controls="try-panel"
                          tabIndex={showSecond ? -1 : 0}
                          onClick={() => selectTry(false)}
                          className={tabClass(!showSecond)}
                        >
                          First try
                          <span className="text-sm font-bold">{firstTry?.score ?? cur.firstScore}</span>
                        </button>
                        <button
                          type="button"
                          role="tab"
                          id="try-tab-2"
                          data-try={2}
                          aria-selected={showSecond}
                          aria-controls={secondTry ? "try-panel" : undefined}
                          tabIndex={showSecond ? 0 : -1}
                          disabled={!secondTry}
                          onClick={() => selectTry(true)}
                          className={tabClass(showSecond, !secondTry)}
                        >
                          Second try
                          <span className="text-sm font-bold">
                            {secondTry ? secondTry.score : cur.retrySkipped ? "Skipped" : (
                              <>
                                <span aria-hidden="true">–</span>
                                <span className="sr-only">not recorded</span>
                              </>
                            )}
                          </span>
                        </button>
                      </div>
                      <p className="m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <span aria-hidden="true" className="inline-block h-[3px] w-4 bg-primary" />
                          Matched evidence
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span aria-hidden="true" className="inline-block w-4 border-t-2 border-dashed border-improve" />
                          Issue
                        </span>
                      </p>
                    </div>
                    <div
                      role="tabpanel"
                      id="try-panel"
                      aria-labelledby={showSecond ? "try-tab-2" : "try-tab-1"}
                      tabIndex={0}
                      className="rounded-panel"
                    >
                      <TryCard
                        key={`${cur.n}-${selectedTry.attempt}`}
                        label={showSecond ? "Second try" : "First try"}
                        data={selectedTry}
                      />
                    </div>
                    {!secondTry && (
                      <p className="m-0 text-[13px] text-ink-muted">
                        {cur.retrySkipped ? "The candidate skipped the retry, so it counts as no change: the first answer stands for both tries." : "No recorded retry. The first answer is used for the session score."}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="m-0 rounded-panel border border-dashed border-line bg-surface px-6 py-10 text-center text-sm text-pretty text-ink-faint">
                    No transcript for this question. {scoresOnlyDescription(cur)}
                  </p>
                )}
              </>
            )}
          </section>

          <FlagRail
            sessionId={r.sessionId}
            questionNumber={qn}
            candidateName={r.candidateName}
            flags={flags.data}
            flagsError={Boolean(flags.error)}
            onSubmitted={flags.reload}
            questionModes={questionModes(r.questions)}
          />
        </div>
      )}
      {review.error && (
        <p role="alert" className="mt-4 text-sm text-improve-text">
          The session couldn’t be refreshed.
        </p>
      )}
    </>
  );
}
