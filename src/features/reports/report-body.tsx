"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { HorizontalBars } from "@/components/charts/horizontal-bars";
import { BandLegend, StackedBandBar } from "@/components/charts/stacked-band-bar";
import { Avatar } from "@/components/ui/avatar";
import { Button, ButtonLink } from "@/components/ui/button";
import { ChangeValue } from "@/components/ui/change-value";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { ScoreCell } from "@/components/ui/score-cell";
import { BANDS, BAND_LABEL } from "@/lib/bands";
import { cn } from "@/lib/cn";
import { DIMENSION_IDS, DIMENSION_LABEL, type NeedsAttention, type Report } from "@/lib/types";

const CARD = "min-w-0 rounded-panel border border-line bg-surface";
const CARD_TITLE = "m-0 text-[17px] leading-6 font-semibold text-ink";
const CARD_SUB = "m-0 text-[13px] leading-5 text-ink-faint";
const ATTENTION_COLS =
  "grid grid-cols-[minmax(240px,2fr)_minmax(160px,1.2fr)_80px_170px_110px_16px] items-center gap-4 px-[22px]";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

function CardHead({ id, title, sub, aside }: { id: string; title: string; sub?: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 id={id} className={CARD_TITLE}>
          {title}
        </h2>
        {sub ? <p className={CARD_SUB}>{sub}</p> : null}
      </div>
      {aside}
    </div>
  );
}

type Stat = { label: string; value: ReactNode; note: string; share?: number; faint?: boolean };

function StatCard({ id, title, stats }: { id: string; title: string; stats: Stat[] }) {
  return (
    <section aria-labelledby={id} className={cn(CARD, "flex flex-col gap-3.5 px-[22px] py-5")}>
      <h2 id={id} className="m-0 font-mono text-xs leading-4 font-normal tracking-[0.08em] text-ink-faint uppercase">
        {title}
      </h2>
      <dl className="m-0 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="flex min-w-0 flex-col gap-2">
            <dt className="text-[13px] leading-5 text-ink-muted">{s.label}</dt>
            <dd className={cn("m-0 text-[28px] leading-none font-semibold tracking-[-0.02em]", s.faint ? "text-ink-faint" : "text-ink")}>
              {s.value}
            </dd>
            {s.share !== undefined && (
              <dd aria-hidden="true" className="m-0 flex h-1 overflow-hidden rounded-sm bg-line">
                <span className="block h-full rounded-sm bg-primary" style={{ width: `${Math.max(0, Math.min(100, s.share))}%` }} />
              </dd>
            )}
            <dd className="m-0 text-xs leading-4 text-ink-faint">{s.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function BandsCard({ report }: { report: Report }) {
  const [asTable, setAsTable] = useState(false);
  const regionId = useId();
  const withSession = BANDS.reduce((n, b) => n + report.bandsLatest[b.id], 0);
  const rows = [
    { label: "Baseline", counts: report.bandsBaseline },
    { label: "Latest", counts: report.bandsLatest },
  ];

  return (
    <section aria-labelledby="bands-h" className={cn(CARD, "flex flex-col gap-5 p-[22px]")}>
      <CardHead
        id="bands-h"
        title="Preparedness bands"
        sub={`${plural(withSession, "candidate")} with at least one session. Baseline is their first session; latest is their most recent.`}
        aside={
          <button
            type="button"
            aria-controls={regionId}
            onClick={() => setAsTable((v) => !v)}
            className="shrink-0 cursor-pointer rounded-sm border-0 bg-transparent p-0 text-[13px] leading-5 font-semibold text-ink-muted hover:text-ink"
          >
            {asTable ? "Show as chart" : "Show as table"}
          </button>
        }
      />
      <div id={regionId}>
        {asTable ? (
          <table className="w-full border-collapse text-left text-sm leading-5 text-ink">
            <caption className="sr-only">Candidates per band, baseline and latest</caption>
            <thead>
              <tr className="text-xs font-semibold text-ink-faint">
                <th scope="col" className="min-w-[140px] py-2 font-semibold">Band</th>
                <th scope="col" className="w-[90px] py-2 text-right font-semibold">Baseline</th>
                <th scope="col" className="w-[90px] py-2 text-right font-semibold">Latest</th>
              </tr>
            </thead>
            <tbody>
              {BANDS.map((b) => (
                <tr key={b.id} className="border-t border-line">
                  <th scope="row" className="py-2.5 font-normal">{BAND_LABEL[b.id]}</th>
                  <td className="py-2.5 text-right font-mono">{report.bandsBaseline[b.id]}</td>
                  <td className="py-2.5 text-right font-mono">{report.bandsLatest[b.id]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col gap-3.5">
            {rows.map((r) => (
              <div key={r.label} className="grid grid-cols-[80px_minmax(0,1fr)] items-center gap-4">
                <span aria-hidden="true" className="text-sm leading-5 font-semibold text-ink">
                  {r.label}
                </span>
                <StackedBandBar label={r.label} counts={r.counts} legend={false} />
              </div>
            ))}
            <BandLegend className="pl-24" />
          </div>
        )}
      </div>
    </section>
  );
}

function DimensionsCard({ report, cardsHref }: { report: Report; cardsHref: string }) {
  const avgs = report.dimensionAverages;
  return (
    <section aria-labelledby="dim-h" className={cn(CARD, "flex flex-[1_1_400px] flex-col gap-[18px] p-[22px]")}>
      <CardHead id="dim-h" title="Answer dimensions" sub="Average latest score, 0–100" />
      {avgs ? (
        <HorizontalBars
          framed={false}
          items={DIMENSION_IDS.map((d) => ({ id: d, label: DIMENSION_LABEL[d], value: avgs[d] }))}
          weakestId={report.weakest?.id}
          ariaLabel={`Average latest score by dimension: ${DIMENSION_IDS.map((d) => `${DIMENSION_LABEL[d]} ${avgs[d]}`).join(", ")}.${report.weakest ? ` ${report.weakest.label} is lowest.` : ""}`}
          caption="Average latest score by dimension"
        />
      ) : (
        <p className="m-0 text-sm leading-[1.55] text-neutral-text">Not enough answers yet to average the dimensions.</p>
      )}
      {avgs && report.weakestNote && (
        <div className="mt-auto flex flex-wrap items-center gap-3 rounded-[10px] border border-[color-mix(in_oklab,var(--improve)_22%,var(--surface))] bg-[color-mix(in_oklab,var(--improve-soft)_70%,var(--surface))] px-4 py-3.5">
          <p className="m-0 min-w-[200px] flex-1 text-sm leading-normal text-improve-text">{report.weakestNote}</p>
          <Link
            href={cardsHref}
            className="flex-none rounded-lg border border-[color-mix(in_oklab,var(--improve)_45%,var(--surface))] px-3 py-2 text-[13px] leading-5 font-semibold text-improve-text no-underline hover:bg-improve-soft"
          >
            Add a flash card <span aria-hidden="true">→</span>
          </Link>
        </div>
      )}
    </section>
  );
}

function HardestCard({ report, cardsHref }: { report: Report; cardsHref: string }) {
  const qs = report.hardestQuestions;
  return (
    <section aria-labelledby="hq-h" className={cn(CARD, "flex flex-[1_1_400px] flex-col gap-[18px] p-[22px]")}>
      <CardHead id="hq-h" title="Hardest questions" sub="Lowest average first-try score" />
      {qs.length === 0 ? (
        <div className="flex flex-1 flex-col justify-center py-2">
          <p className="m-0 text-sm leading-[1.55] text-pretty text-neutral-text">
            Not enough answers yet to rank questions. Each question needs at least 3 answers in this date range.
          </p>
        </div>
      ) : (
        <ol className="m-0 flex list-none flex-col p-0">
          {qs.map((h) => (
            <li key={h.questionId ?? h.question} className="flex flex-col gap-2 border-t border-line py-3 first:border-t-0 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-4">
                <span className="min-w-0 text-sm leading-5 text-ink">{h.question}</span>
                <span className="shrink-0 font-mono text-sm leading-5 font-semibold text-ink">
                  <span className="sr-only">Average first try </span>
                  {h.avgFirst}
                </span>
              </div>
              <span aria-hidden="true" className="flex h-1 overflow-hidden rounded-sm bg-line">
                <span className="block h-full rounded-sm bg-improve" style={{ width: `${Math.max(0, Math.min(100, h.avgFirst))}%` }} />
              </span>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-4 text-ink-faint">
                <span>Asked {h.timesAsked}×</span>
                <span>Second try {h.avgSecond}</span>
                <span>Learning {h.avgLearning ?? "—"}</span>
                <Link href={cardsHref} className="ml-auto font-semibold text-primary-text underline-offset-2 hover:underline">
                  Improve flash card<span className="sr-only"> for {h.question}</span>
                </Link>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function AttentionRow({ a }: { a: NeedsAttention }) {
  const cells = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={a.name} size={32} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm leading-5 font-semibold text-ink">{a.name}</span>
          <span className="truncate text-[13px] leading-5 text-ink-faint">{a.email}</span>
        </div>
      </div>
      <span className="text-[13px] leading-5 text-ink-soft">
        <span className="sr-only">Reason: </span>
        {a.why}
      </span>
      <span className="text-right font-mono text-[13px] leading-5 text-ink">
        <span className="sr-only">Sessions: </span>
        {a.sessions}
      </span>
      <ScoreCell score={a.latestScore} />
      <span className="text-right text-[13px] leading-5 whitespace-nowrap text-ink-soft">
        <span className="sr-only">Last active: </span>
        {a.lastActiveLabel}
      </span>
      <span aria-hidden="true" className="justify-self-end text-ink-faint">
        {a.candidateId ? <Icon name="chevron-right" size={16} /> : null}
      </span>
    </>
  );
  const row = cn(ATTENTION_COLS, "min-h-16 border-t border-line py-2 text-ink");
  return (
    <li>
      {a.candidateId ? (
        <Link
          href={`/candidates?candidate=${encodeURIComponent(a.candidateId)}`}
          className={cn(row, "focus-inset no-underline hover:bg-row-hover")}
        >
          {cells}
        </Link>
      ) : (
        <div className={row} title="This person isn’t in your candidate list yet.">
          {cells}
        </div>
      )}
    </li>
  );
}

function AttentionCard({ items }: { items: NeedsAttention[] }) {
  return (
    <section aria-labelledby="att-h" className={cn(CARD, "overflow-hidden")}>
      <div className="flex flex-wrap items-end justify-between gap-3 px-[22px] pt-[22px] pb-3.5">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="att-h" className={CARD_TITLE}>
            Candidates needing attention
          </h2>
          <p className={CARD_SUB}>Latest score under 50, or no activity for 14 days</p>
        </div>
        <span className="text-[13px] leading-5 text-ink-faint">{plural(items.length, "candidate")}</span>
      </div>
      {items.length === 0 ? (
        <p className="m-0 border-t border-line px-[22px] py-5 text-sm leading-5 text-ink-muted">
          Nobody needs attention right now.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div aria-hidden="true" className={cn(ATTENTION_COLS, "h-10 border-t border-line text-xs leading-4 font-semibold text-ink-faint")}>
              <span>Candidate</span>
              <span>Reason</span>
              <span className="text-right">Sessions</span>
              <span>Latest score</span>
              <span className="text-right">Last active</span>
              <span />
            </div>
            <ul aria-labelledby="att-h" className="m-0 list-none p-0">
              {items.map((a) => (
                <AttentionRow key={a.candidateId ?? a.email} a={a} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

export function ReportBody({
  report,
  loading,
  error,
  onRetry,
}: {
  report: Report | undefined;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  if (error && !report) {
    return (
      <div className={CARD}>
        <EmptyState
          icon="alert"
          title="This report didn’t load"
          description="Something went wrong while loading the report. Your data is safe."
          action={<Button variant="primary" onClick={onRetry}>Try again</Button>}
        />
      </div>
    );
  }
  if (!report) {
    return (
      <div aria-busy="true" className="flex flex-col gap-6">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-4">
          <div className="h-[136px] animate-pulse rounded-panel bg-neutral-soft" />
          <div className="h-[136px] animate-pulse rounded-panel bg-neutral-soft" />
        </div>
        <div className="h-[200px] animate-pulse rounded-panel bg-neutral-soft" />
        <div className="h-[260px] animate-pulse rounded-panel bg-neutral-soft" />
        <p role="status" className="sr-only">Loading report</p>
      </div>
    );
  }
  if (!report.hasData) {
    return (
      <div className={CARD}>
        <EmptyState
          icon="chart"
          title="No report data yet"
          description={`${report.roleTitle} has no completed sessions in this range. Reports appear once candidates finish a session.`}
          action={<ButtonLink variant="secondary-teal" href="/roles">View roles</ButtonLink>}
        />
      </div>
    );
  }

  const s = report.stats;
  const cardsHref = `/roles/${encodeURIComponent(report.roleId)}/cards`;

  return (
    <div className={cn("flex flex-col gap-6 transition-opacity", loading && "opacity-70")} aria-busy={loading || undefined}>
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-[10px] border border-error bg-surface px-3.5 py-2.5 text-sm font-medium text-error"
        >
          The report could not be refreshed.
          <Button variant="ghost" size="sm" onClick={onRetry}>Try again</Button>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-4">
        <StatCard
          id="funnel-h"
          title="Candidate funnel"
          stats={[
            { label: "Invited", value: s.invited, share: s.invited > 0 ? 100 : 0, note: "All assigned" },
            { label: "Active", value: s.active, share: pct(s.active, s.invited), note: `${s.active} of ${s.invited} logged in` },
            {
              label: "Completed a session",
              value: s.completedSession,
              share: pct(s.completedSession, s.invited),
              note: `${s.completedSession} of ${s.invited} · ${pct(s.completedSession, s.invited)}%`,
            },
          ]}
        />
        <StatCard
          id="avg-h"
          title="Average score"
          stats={[
            { label: "Baseline", value: s.avgBaseline ?? "—", faint: s.avgBaseline == null, note: "First session" },
            { label: "Latest", value: s.avgLatest ?? "—", faint: s.avgLatest == null, note: "Most recent session" },
            {
              label: "Change",
              value: <ChangeValue value={s.change} />,
              faint: s.change === null,
              note: s.change === null ? "Needs a second session" : "Since baseline",
            },
          ]}
        />
      </div>

      <BandsCard report={report} />

      <div className="flex flex-wrap items-stretch gap-4">
        <DimensionsCard report={report} cardsHref={cardsHref} />
        <HardestCard report={report} cardsHref={cardsHref} />
      </div>

      <AttentionCard items={report.needsAttention} />

      {report.illustrative.length > 0 && (
        <p className="m-0 text-xs leading-4 text-ink-faint">
          Illustrative figures, not real data: {report.illustrative.join(", ")}.
        </p>
      )}
    </div>
  );
}
