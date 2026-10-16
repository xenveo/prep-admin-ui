"use client";

import { useRef } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { HighlightLegend } from "@/components/media/transcript-highlights";
import { ScoreRing } from "@/components/charts/score-ring";
import { BandChip } from "@/components/ui/band-chip";
import { Button } from "@/components/ui/button";
import { ChangeValue } from "@/components/ui/change-value";
import { EmptyState } from "@/components/ui/empty-state";
import { StatStrip } from "@/components/ui/stat-strip";
import { cn } from "@/lib/cn";
import { formatDateTime, formatMinutes } from "@/lib/format";
import type { SessionQuestion } from "@/lib/types";
import { useAsync } from "@/lib/use-async";
import { useUrlState } from "@/lib/use-url-state";
import { getSessionReview, listFlags } from "@/services/sessions";
import { FlagRail } from "./flag-rail";
import { TryCard } from "./try-card";

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

export function SessionScreen({ candidateId, sessionId }: { candidateId: string; sessionId: string }) {
  const url = useUrlState();
  const review = useAsync(() => getSessionReview(candidateId, sessionId), [candidateId, sessionId]);
  const flags = useAsync(() => listFlags(sessionId), [sessionId]);
  const listRef = useRef<HTMLOListElement>(null);

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
    return (
      <div aria-busy="true">
        <PageHeader title="Session review" breadcrumb={[{ label: "Candidates", href: "/candidates" }, { label: "Loading" }]} />
        <div className="h-16 animate-pulse rounded-md bg-neutral-soft" />
        <p role="status" className="sr-only">Loading session</p>
      </div>
    );
  }

  const qn = Math.min(Math.max(Number(url.get("q")) || 1, 1), Math.max(r.questions.length, 1));
  const cur = r.questions.find((q) => q.n === qn);
  const selectQuestion = (n: number) => url.set({ q: n === 1 ? null : String(n) });

  const onListKey = (e: React.KeyboardEvent, n: number) => {
    const d = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = n + d;
    if (next < 1 || next > r.questions.length) return;
    selectQuestion(next);
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLButtonElement>(`[data-q="${next}"]`)?.focus());
  };

  const name = `${r.candidateName} · Session ${r.sessionNumber}`;

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "Candidates", href: "/candidates" },
          { label: r.candidateName, href: `/candidates?candidate=${encodeURIComponent(r.candidateId)}` },
          { label: `Session ${r.sessionNumber}` },
        ]}
        leading={<ScoreRing score={r.score} size={64} />}
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
            </p>
          </>
        }
        secondaryActions={
          <Button iconLeft="download" disabledReason="PDF export isn’t available yet.">
            Export PDF
          </Button>
        }
      />

      {r.hasDetail ? (
        <StatStrip
          className="mb-6"
          stats={[
            { label: "First try avg", value: r.firstTryAvg ?? "–" },
            { label: "Second try avg", value: r.secondTryAvg ?? "–" },
            { label: "Learning score", value: r.learningScore ?? "–" },
            { label: "Session score", value: r.score, note: r.formulaText },
          ]}
        />
      ) : null}

      {!r.hasDetail ? (
        <div className="rounded-lg border border-line bg-surface">
          <EmptyState
            icon="file"
            title="No answer-level detail for this session"
            description={`Only the summary is available: score ${r.score}, ${formatMinutes(r.durationMin)}. Transcripts and per-answer scores aren’t stored for this session.`}
            helper={r.formulaText}
          />
        </div>
      ) : (
        <div className="grid items-start gap-6 min-[1025px]:grid-cols-[232px_minmax(0,1fr)_280px]">
          <nav aria-label="Questions" className="min-w-0">
            <div className="mb-2 text-xs font-semibold text-ink-muted">Questions · first → second</div>
            <ol ref={listRef} className="m-0 list-none overflow-hidden rounded-lg border border-line bg-surface p-0">
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
                        "focus-inset flex w-full cursor-pointer items-start gap-2 px-3 py-2.5 text-left",
                        on ? "bg-primary-tint shadow-[inset_3px_0_0_var(--primary)]" : "bg-surface hover:bg-row-hover",
                      )}
                    >
                      <span className="w-4 text-[13px] font-semibold text-ink-muted">{q.n}</span>
                      <span className="flex min-w-0 flex-col">
                        <span className={cn("text-[13px] leading-5 text-ink", on ? "font-semibold" : "font-medium")}>{q.text}</span>
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

          <section aria-labelledby="q-title" className="flex min-w-0 flex-col gap-4">
            {cur && (
              <>
                <div>
                  <span className="text-xs text-ink-muted">
                    Question {cur.n} of {r.questions.length}
                    {cur.category ? ` · ${cur.category}` : ""} · <ScorePair q={cur} />
                  </span>
                  <h2 id="q-title" className="m-0 text-lg font-semibold leading-7 text-ink">
                    {cur.text}
                  </h2>
                </div>
                {cur.tries && cur.tries.length > 0 ? (
                  <>
                    <HighlightLegend />
                    <div className="grid items-start gap-4 min-[1360px]:grid-cols-2">
                      {cur.tries.map((attempt) => <TryCard key={attempt.attempt} label={attempt.attempt === 1 ? "First try" : "Second try"} data={attempt} />)}
                      {cur.tries.length === 1 && (
                        <p className="text-sm text-ink-muted">
                          {cur.retrySkipped ? "The candidate skipped the retry." : "No recorded retry."} The first answer is used for the session score.
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-line bg-surface">
                    <EmptyState
                      icon="file"
                      title="No transcript for this question"
                      description={scoresOnlyDescription(cur)}
                    />
                  </div>
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
