"use client";

import {
  BandLegend,
  StackedBandBar,
} from "@/components/charts/stacked-band-bar";
import { useAsync } from "@/lib/use-async";
import type { ExecutiveInsights } from "@/lib/api/executive-contracts";
import {
  getExecutiveInsights,
  type ExecutiveQuery,
} from "@/services/executive";
import { Card, Fraction, Meter, fmtNum, fmtPct } from "./parts";
import { QualityTab } from "./quality-tab";
import { ReportError, ReportLoading } from "./report-state";
import { cutoffLabel, monthLabel } from "./view-model";

/** Mounted only for tab three; no supporting-report request is made on the primary tabs. */
export function InsightsTab({ query }: { query: ExecutiveQuery }) {
  const report = useAsync(
    () => getExecutiveInsights(query),
    [query.period, query.roleId],
  );
  if (report.loading)
    return <ReportLoading label="Loading supporting insights…" />;
  if (report.error)
    return <ReportError error={report.error} retry={report.reload} />;
  const data = report.data;
  if (!data) return null;
  return (
    <div className="flex flex-col gap-7">
      <div>
        <h2 className="m-0 text-xl font-semibold tracking-[-0.02em] text-ink">
          The supporting picture
        </h2>
        <p className="mt-1.5 mb-0 text-sm text-ink-muted">
          Readiness, engagement, coaching opportunities, and confidence in the
          scores.
        </p>
      </div>
      <div className="grid gap-5 min-[1100px]:grid-cols-2">
        <FunnelCard data={data} />
        <Card
          id="pipeline-h"
          title="Where candidates stand now"
          sub={`Latest completed-session band before ${cutoffLabel(data.meta.cutoff)} UTC`}
        >
          {data.pipeline.length ? (
            <>
              <div className="flex flex-col gap-4">
                {data.pipeline.map((p) => (
                  <div key={p.role.id} className="flex flex-col gap-2">
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <strong className="font-semibold">{p.role.short}</strong>
                      <span className="text-xs text-ink-faint">
                        {p.newlyReady} newly ready · {p.unassessed} unassessed
                      </span>
                    </div>
                    <StackedBandBar
                      label={p.role.name}
                      counts={p.bands}
                      legend={false}
                    />
                  </div>
                ))}
              </div>
              <BandLegend />
            </>
          ) : (
            <p className="m-0 text-sm text-ink-muted">
              No role assignments or sessions are available for this scope.
            </p>
          )}
        </Card>
        <Card
          id="ttr-h"
          title="How fast candidates get ready"
          sub="From first completed practice to the first stored interview-ready band."
        >
          <div className="flex flex-col gap-1">
            <strong className="text-[38px] leading-none font-semibold tracking-tight">
              {fmtNum(data.timeToReady.medianDays, 1)}{" "}
              <span className="text-sm font-medium text-ink-muted">
                days median
              </span>
            </strong>
            <p className="m-0 text-xs leading-5 text-ink-faint">
              Pairs first reaching readiness during the reporting month.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between gap-3 text-sm">
              <span>Reached readiness within 60 days</span>
              <strong>{fmtPct(data.timeToReady.attainment)}</strong>
            </div>
            <Meter value={data.timeToReady.attainment.value} tone="ready" />
            <Fraction r={data.timeToReady.attainment} unit="eligible pairs" />
          </div>
          <p className="m-0 text-xs leading-5 text-ink-faint">
            The attainment cohort includes pairs whose first completed practice
            was at least 60 days before cutoff. A zero denominator means no
            comparison yet.
          </p>
        </Card>
        <Card
          id="coach-h"
          title="Where coaching can help"
          sub="First-attempt dimension averages, out of 100."
        >
          <div className="flex flex-col gap-4">
            {data.dimensions.map((d) => (
              <div
                key={d.id}
                className="grid grid-cols-[100px_minmax(0,1fr)_36px] items-center gap-3"
              >
                <span className="text-sm text-ink-muted">{d.label}</span>
                <Meter value={d.value == null ? null : d.value / 100} />
                <span className="text-right text-sm font-semibold tabular-nums">
                  {fmtNum(d.value)}
                </span>
              </div>
            ))}
          </div>
          {!data.dimensions.some((d) => d.value != null) && (
            <p className="m-0 text-sm text-ink-muted">
              No scored first attempts are available.
            </p>
          )}
        </Card>
      </div>
      <Card
        id="questions-h"
        title="Questions candidates find hardest"
        sub="Actual first-attempt scores, with retry results where available."
      >
        {data.hardestQuestions.length ? (
          <div className="-mx-[22px] overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left text-sm">
              <caption className="sr-only">
                Hardest questions by first-attempt score
              </caption>
              <thead>
                <tr className="text-xs text-ink-faint">
                  <th scope="col" className="px-[22px] pb-3 font-semibold">
                    Question
                  </th>
                  <th scope="col" className="px-4 pb-3 font-semibold">
                    Responses
                  </th>
                  <th scope="col" className="px-4 pb-3 font-semibold">
                    First attempt
                  </th>
                  <th scope="col" className="px-[22px] pb-3 font-semibold">
                    Retry
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.hardestQuestions.map((q) => (
                  <tr key={q.id} className="border-t border-line">
                    <th scope="row" className="px-[22px] py-4 font-normal">
                      {q.question}
                    </th>
                    <td className="px-4 py-4 tabular-nums">{q.responses}</td>
                    <td className="px-4 py-4 tabular-nums">
                      {fmtNum(q.first, 1)}
                    </td>
                    <td className="px-[22px] py-4 tabular-nums">
                      {fmtNum(q.retry, 1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="m-0 text-sm text-ink-muted">
            No scored question responses are available in this scope.
          </p>
        )}
      </Card>
      <AttentionCard data={data} />
      <QualityTab data={data.quality} />
      {data.unavailable.length > 0 && (
        <section aria-labelledby="missing-h" className="flex flex-col gap-3">
          <h2 id="missing-h" className="m-0 text-[17px] font-semibold">
            Not measurable yet
          </h2>
          <dl className="m-0 grid border-t border-line min-[900px]:grid-cols-2 min-[900px]:gap-x-10">
            {data.unavailable.map((m) => (
              <div key={m.metric} className="border-b border-line py-3">
                <dt className="text-sm font-semibold">{m.metric}</dt>
                <dd className="mt-1 ml-0 text-[13px] leading-5 text-ink-muted">
                  {m.reason}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      {data.meta.limitations.length > 0 && (
        <details className="text-xs leading-5 text-ink-muted">
          <summary className="cursor-pointer font-semibold">
            Supporting-report limitations
          </summary>
          <ul className="mt-2 space-y-1 pl-5">
            {data.meta.limitations.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function FunnelCard({ data }: { data: ExecutiveInsights }) {
  const f = data.funnel;
  return (
    <Card
      id="funnel-h"
      title="Do invitations become practice?"
      sub={`First invitations in ${monthLabel(data.meta.cohortMonth)} · ${f.invited} invited people`}
      info="Each conversion has its own complete observation window. Activation and first practice count people; repeat practice counts candidate–role pairs. These denominators should not be read as one shared cohort."
    >
      <div className="flex flex-col gap-5">
        {[
          {
            label: "Accepted within 7 days",
            r: f.activation,
            unit: "eligible invited people",
          },
          {
            label: "First practice within 7 days",
            r: f.firstPractice,
            unit: "eligible activated people",
          },
          {
            label: "Repeat practice within 14 days",
            r: f.repeatPractice,
            unit: "eligible first-practice pairs",
          },
        ].map((step) => (
          <div key={step.label} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>{step.label}</span>
              <strong>{fmtPct(step.r)}</strong>
            </div>
            <Meter value={step.r.value} />
            <Fraction r={step.r} unit={step.unit} />
          </div>
        ))}
      </div>
    </Card>
  );
}
function AttentionCard({ data }: { data: ExecutiveInsights }) {
  const a = data.attention;
  const labels = {
    low: "Latest score below 50",
    inactive: "Inactive for 14+ days",
    both: "Low score and inactive",
  };
  return (
    <Card
      id="attention-h"
      title="Candidates needing attention"
      sub={`${a.total} candidate–role pairs · ${a.low} low-score only${a.historicalInactivityAvailable ? ` · ${a.inactive} inactive only · ${a.both} both` : ""}`}
    >
      {!a.historicalInactivityAvailable && (
        <p className="m-0 text-sm leading-5 text-improve-text">
          Historical inactivity is not measurable from current activity
          timestamps. This period’s attention list reports available low-score
          evidence, not a measured zero for inactivity.
        </p>
      )}
      {a.cases.length ? (
        <ul className="m-0 list-none divide-y divide-line p-0">
          {a.cases.map((c) => (
            <li
              key={`${c.candidateId}-${c.roleId}`}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <strong className="text-sm font-semibold">{c.name}</strong>
                <p className="m-0 text-xs text-ink-faint">
                  {c.roleName} · Latest score {c.score ?? "—"}
                </p>
              </div>
              <span className="rounded-full bg-improve-soft px-2 py-1 text-xs font-semibold text-improve-text">
                {labels[c.reason]}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-ink-muted">
          No cases match the available attention rules for this period.
        </p>
      )}
      {a.cases.length < a.total && (
        <p className="m-0 text-xs text-ink-faint">
          Showing {a.cases.length} of {a.total} pairs. The total includes every
          matching pair.
        </p>
      )}
    </Card>
  );
}
