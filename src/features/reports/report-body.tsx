"use client";

import Link from "next/link";
import { ChartFrame } from "@/components/charts/chart-frame";
import { HorizontalBars } from "@/components/charts/horizontal-bars";
import { StackedBandBar } from "@/components/charts/stacked-band-bar";
import { Button, ButtonLink } from "@/components/ui/button";
import { ChangeValue } from "@/components/ui/change-value";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { ScoreCell } from "@/components/ui/score-cell";
import { StatStrip } from "@/components/ui/stat-strip";
import { BANDS, BAND_LABEL } from "@/lib/bands";
import { formatSigned } from "@/lib/format";
import { DIMENSION_IDS, DIMENSION_LABEL, type Report } from "@/lib/types";

const TH = "h-10 border-b border-line px-3 text-xs font-semibold text-ink-muted";
const TD = "h-11 border-b border-line px-3 text-[13px] text-ink";
const Dash = () => <span className="text-ink-muted">–</span>;

function Section({ id, title, sub, children }: { id: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="min-w-0 rounded-lg border border-line bg-surface p-4">
      <div className="mb-3">
        <h2 id={id} className="m-0 text-base font-semibold text-ink">
          {title}
        </h2>
        {sub && <p className="m-0 text-xs text-ink-muted">{sub}</p>}
      </div>
      {children}
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
      <EmptyState
        icon="alert"
        title="This report didn’t load"
        description="Something went wrong while loading the report. Your data is safe."
        action={<Button variant="primary" onClick={onRetry}>Try again</Button>}
      />
    );
  }
  if (!report) {
    return (
      <div aria-busy="true" className="flex flex-col gap-6">
        <div className="h-16 animate-pulse rounded-md bg-neutral-soft" />
        <div className="h-48 animate-pulse rounded-md bg-neutral-soft" />
        <div className="h-48 animate-pulse rounded-md bg-neutral-soft" />
        <p role="status" className="sr-only">Loading report</p>
      </div>
    );
  }
  if (!report.hasData) {
    return (
      <div className="rounded-lg border border-line bg-surface">
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
  const withSessions = report.bandsLatest;
  const totalLatest = BANDS.reduce((n, b) => n + withSessions[b.id], 0);

  const bandRows = BANDS.map((b) => [
    BAND_LABEL[b.id],
    report.bandsBaseline[b.id],
    report.bandsLatest[b.id],
    formatSigned(report.bandsLatest[b.id] - report.bandsBaseline[b.id]),
  ]);

  return (
    <div className={`flex flex-col gap-6 ${loading ? "opacity-70" : ""}`} aria-busy={loading || undefined}>
      {error && <p role="alert" className="text-sm text-improve-text">The report could not be refreshed. <Button variant="text" onClick={onRetry}>Try again</Button></p>}
      <StatStrip
        stats={[
          { label: "Invited", value: s.invited },
          { label: "Active", value: s.active },
          { label: "Completed a session", value: s.completedSession },
          { label: "Average baseline", value: s.avgBaseline ?? "–" },
          { label: "Average latest", value: s.avgLatest ?? "–" },
          {
            label: "Change",
            value: s.change === null ? "–" : <ChangeValue value={s.change} />,
            tone: s.change !== null && s.change > 0 ? "positive" : "default",
          },
        ]}
      />

      <Section id="bands-h" title="Preparedness bands" sub={`${totalLatest} candidates with at least one session. Baseline is their first session; latest is their most recent.`}>
        <ChartFrame
          table={{ caption: "Candidates per band, baseline and latest", columns: ["Band", "Baseline", "Latest", "Change"], rows: bandRows }}
        >
          <div className="flex flex-col gap-4">
            <div className="grid items-center gap-2 min-[700px]:grid-cols-[72px_minmax(0,1fr)]">
              <span className="text-[13px] font-semibold text-ink">Latest</span>
              <StackedBandBar label="Latest" counts={report.bandsLatest} />
            </div>
            <div className="grid items-center gap-2 min-[700px]:grid-cols-[72px_minmax(0,1fr)]">
              <span className="text-[13px] font-semibold text-ink">Baseline</span>
              <StackedBandBar label="Baseline" counts={report.bandsBaseline} />
            </div>
          </div>
        </ChartFrame>
      </Section>

      <div className="grid items-start gap-6 min-[1200px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section id="hq-h" title="Hardest questions" sub="Lowest average first-try score">
          {report.hardestQuestions.length === 0 ? (
            <p className="m-0 text-sm text-ink-muted">No questions have been asked in this range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left">
                <thead>
                  <tr>
                    <th scope="col" className={TH}>Question</th>
                    <th scope="col" className={`${TH} text-right`}>Times asked</th>
                    <th scope="col" className={`${TH} text-right`}>Avg first</th>
                    <th scope="col" className={`${TH} text-right`}>Avg second</th>
                    <th scope="col" className={`${TH} text-right`}>Learning</th>
                    <th scope="col" className={TH}><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {report.hardestQuestions.map((h) => (
                    <tr key={h.question}>
                      <td className={`${TD} max-w-[280px] py-2`}>{h.question}</td>
                      <td className={`${TD} text-right`}>{h.timesAsked}</td>
                      <td className={`${TD} text-right`}>{h.avgFirst}</td>
                      <td className={`${TD} text-right`}>{h.avgSecond}</td>
                      <td className={`${TD} text-right`}>{h.avgLearning ?? <Dash />}</td>
                      <td className={`${TD} whitespace-nowrap`}>
                        <Link href={cardsHref} className="font-semibold text-primary-text underline-offset-2 hover:underline">
                          Improve flash card
                          <span className="sr-only"> for {h.question}</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section id="dim-h" title="Answer dimensions" sub="Average latest score, 0–100">
          {report.dimensionAverages ? (
            <div className="flex flex-col gap-4">
              <HorizontalBars
                items={DIMENSION_IDS.map((d) => ({ id: d, label: DIMENSION_LABEL[d], value: report.dimensionAverages![d] }))}
                weakestId={report.weakest?.id}
                ariaLabel={`Average latest score by dimension: ${DIMENSION_IDS.map((d) => `${DIMENSION_LABEL[d]} ${report.dimensionAverages![d]}`).join(", ")}.${report.weakest ? ` ${report.weakest.label} is lowest.` : ""}`}
                caption="Average latest score by dimension"
              />
              {report.weakestNote && (
                <div className="flex items-start gap-2 rounded-md bg-improve-soft px-3 py-2 text-[13px] leading-5 text-ink">
                  <Icon name="alert" size={16} className="mt-0.5 shrink-0 text-improve-text" />
                  <span>
                    {report.weakestNote}{" "}
                    <Link href={cardsHref} className="font-semibold text-primary-text underline-offset-2 hover:underline">
                      Add a flash card
                    </Link>
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="m-0 text-sm text-ink-muted">Not enough answers yet to average the dimensions.</p>
          )}
        </Section>
      </div>

      <Section id="att-h" title="Candidates needing attention" sub="Latest score under 50, or no activity for 14 days">
        {report.needsAttention.length === 0 ? (
          <p className="m-0 text-sm text-ink-muted">Nobody needs attention right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr>
                  <th scope="col" className={TH}>Name</th>
                  <th scope="col" className={TH}>Why</th>
                  <th scope="col" className={`${TH} text-right`}>Sessions</th>
                  <th scope="col" className={TH}>Latest score</th>
                  <th scope="col" className={TH}>Last active</th>
                  <th scope="col" className={TH}><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {report.needsAttention.map((a) => (
                  <tr key={a.candidateId ?? a.email}>
                    <td className={`${TD} py-2`}>
                      <span className="flex flex-col">
                        <span className="font-semibold">{a.name}</span>
                        <span className="text-xs text-ink-muted">{a.email}</span>
                      </span>
                    </td>
                    <td className={TD}>{a.why}</td>
                    <td className={`${TD} text-right`}>{a.sessions}</td>
                    <td className={TD}>
                      <ScoreCell score={a.latestScore} />
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>{a.lastActiveLabel}</td>
                    <td className={TD}>
                      {a.candidateId ? (
                        <ButtonLink
                          variant="text"
                          size="sm"
                          href={`/candidates?candidate=${encodeURIComponent(a.candidateId)}`}
                          aria-label={`Open ${a.name} in the side panel`}
                        >
                          Open
                        </ButtonLink>
                      ) : (
                        <Button variant="text" size="sm" aria-label={`Open ${a.name}`} disabledReason="This person isn’t in your candidate list yet.">
                          Open
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
