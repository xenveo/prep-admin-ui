"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAsync } from "@/lib/use-async";
import type { ExecutiveOverview } from "@/lib/api/executive-contracts";
import {
  getExecutiveCandidates,
  type ExecutiveQuery,
} from "@/services/executive";
import { Card } from "./parts";
import {
  ComparisonLegend,
  ScoreChange,
  ScoreComparison,
} from "./performance-comparison";
import { ReportError, ReportLoading } from "./report-state";
import { cutoffLabel, monthLabel } from "./view-model";

const PAGE_SIZE = 10;
export function CandidateImprovementTab({
  query,
  options,
}: {
  query: ExecutiveQuery;
  options: ExecutiveOverview["options"];
}) {
  const [recruiter, setRecruiter] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);
  const report = useAsync(
    () =>
      getExecutiveCandidates({
        ...query,
        ...(recruiter !== "all" ? { recruiterId: recruiter } : {}),
        search: debouncedSearch || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    [query.period, query.roleId, recruiter, debouncedSearch, page],
  );
  const loading = report.loading || search.trim() !== debouncedSearch;
  const data = !loading && !report.error ? report.data : undefined;
  const s = data?.summary;
  const recruiters = options.recruiters;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="m-0 text-xl font-semibold tracking-[-0.02em] text-ink">
            Are candidates improving?
          </h2>
          <p className="mt-1.5 mb-0 text-sm text-ink-muted">
            Compare the same candidate–role pairs’ first and latest completed
            sessions.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
          Original inviter
          <Select
            value={recruiter}
            onChange={(e) => {
              setRecruiter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All recruiters</option>
            {recruiters.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <label className="flex max-w-sm flex-col gap-1 text-xs font-semibold text-ink-muted">
        Search the candidate table
        <Input
          maxLength={200}
          placeholder="Candidate name or ID"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </label>
      {loading ? (
        <ReportLoading label="Loading candidate comparisons…" />
      ) : report.error ? (
        <ReportError error={report.error} retry={report.reload} />
      ) : (
        data &&
        s && (
          <>
            <Card
              id="candidate-comparison-h"
              title="First practice → latest practice"
              sub={`Invited in ${monthLabel(data.cohortMonth)} · data before ${cutoffLabel(data.meta.cutoff)} UTC`}
            >
              <div className="grid grid-cols-2 gap-y-5 border-b border-line pb-6 min-[800px]:grid-cols-4">
                <Metric
                  label="First-session average"
                  value={s.first?.toFixed(1) ?? "—"}
                />
                <Metric
                  label="Latest-session average"
                  value={s.latest?.toFixed(1) ?? "—"}
                  primary
                />
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-ink-muted">
                    Average improvement
                  </span>
                  <ScoreChange
                    value={s.gain}
                    className="text-[30px] leading-9 tracking-[-0.03em]"
                  />
                </div>
                <Metric
                  label="Pairs compared"
                  value={String(s.paired)}
                  note="2+ completed sessions per role"
                />
              </div>
              {s.paired > 0 ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="m-0 text-sm font-semibold text-ink">
                      How performance changed by role
                    </h3>
                    <ComparisonLegend />
                  </div>
                  <div className="flex flex-col gap-5">
                    {data.roles.map((r) => (
                      <div
                        key={r.id}
                        className="grid items-center gap-x-5 gap-y-1 min-[700px]:grid-cols-[145px_minmax(0,1fr)_105px]"
                      >
                        <div>
                          <span className="text-sm font-semibold text-ink">
                            {r.short}
                          </span>
                          <p className="m-0 text-xs text-ink-faint">
                            {r.paired} pairs compared
                          </p>
                        </div>
                        <ScoreComparison
                          first={r.first}
                          latest={r.latest}
                          label={r.name}
                        />
                        <div className="min-[700px]:text-right">
                          <ScoreChange value={r.gain} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-7 gap-y-2 border-t border-line pt-4 text-sm">
                    <span>
                      <b className="text-primary-text">{s.improved}</b> improved
                    </span>
                    <span>
                      <b className="text-ink">{s.unchanged}</b> unchanged
                    </span>
                    <span>
                      <b className="text-improve-text">{s.declined}</b> declined
                    </span>
                  </div>
                </>
              ) : (
                <p className="m-0 text-sm text-ink-muted">
                  No candidate–role pair has two completed sessions in this
                  cohort yet.
                </p>
              )}
              <p className="m-0 text-xs leading-5 text-ink-faint">
                Both averages use exactly the same {s.paired} pairs.{" "}
                {s.singleSession} have one session and {s.unassessed} are
                unassessed; neither group counts as zero improvement.{" "}
                {s.unassignedCandidates} invited people have no role in this
                report. Repeated questions may contribute to gains. Searching
                changes only the table, not these averages.
              </p>
            </Card>
            <Card
              id="candidate-detail-h"
              title="Candidate performance"
              sub="Each row is one candidate and role. Unassessed and single-session pairs remain visible."
            >
              <div className="-mx-[22px] overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Candidate performance from first to latest completed session
                  </caption>
                  <thead>
                    <tr className="bg-surface-sunken text-xs text-ink-muted">
                      {[
                        "Candidate / role",
                        "Recruiter",
                        "Sessions",
                        "First",
                        "Latest",
                        "Change",
                      ].map((label) => (
                        <th
                          key={label}
                          scope="col"
                          className="px-[22px] py-3 font-semibold"
                        >
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.candidates.map((c) => (
                      <tr
                        key={c.id}
                        className="border-t border-line hover:bg-row-hover"
                      >
                        <th
                          scope="row"
                          className="px-[22px] py-4 text-left font-normal"
                        >
                          <span className="font-semibold text-ink">
                            {c.name}
                          </span>
                          <span className="mt-1 block text-xs text-ink-faint">
                            {options.roles.find((r) => r.id === c.roleId)
                              ?.short ?? "Unknown role"}{" "}
                            · {c.candidateId.slice(0, 8)}
                          </span>
                        </th>
                        <td className="px-[22px] py-4 text-ink-muted">
                          {recruiters.find((r) => r.id === c.recruiterId)
                            ?.name ?? "Unknown inviter"}
                        </td>
                        <td className="px-[22px] py-4 tabular-nums">
                          {c.sessions}
                        </td>
                        <td className="px-[22px] py-4 tabular-nums">
                          {c.firstScore ?? "—"}
                        </td>
                        <td className="px-[22px] py-4 tabular-nums">
                          {c.latestScore ?? "—"}
                        </td>
                        <td className="px-[22px] py-4">
                          {c.latestScore == null || c.firstScore == null ? (
                            <span className="text-xs text-ink-faint">
                              {c.sessions
                                ? "Awaiting second session"
                                : "Not assessed"}
                            </span>
                          ) : (
                            <ScoreChange value={c.latestScore - c.firstScore} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.candidates.length === 0 && (
                  <p
                    role="status"
                    className="m-0 px-[22px] py-8 text-sm text-ink-muted"
                  >
                    No candidate–role pairs match this selection.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <span className="text-xs text-ink-faint">
                  {data.candidates.length
                    ? `${(data.page - 1) * data.pageSize + 1}–${(data.page - 1) * data.pageSize + data.candidates.length} of ${data.total}`
                    : `0 of ${data.total}`}{" "}
                  candidate–role pairs
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    disabled={data.page * data.pageSize >= data.total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </Card>
            {data.meta.limitations.length > 0 && (
              <details className="text-xs leading-5 text-ink-muted">
                <summary className="cursor-pointer font-semibold">
                  Candidate-report limitations
                </summary>
                <ul className="mt-2 space-y-1 pl-5">
                  {data.meta.limitations.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  note,
  primary = false,
}: {
  label: string;
  value: string;
  note?: string;
  primary?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      <strong
        className={`text-[30px] leading-9 font-semibold tracking-[-0.03em] tabular-nums ${primary ? "text-primary-text" : "text-ink"}`}
      >
        {value}
      </strong>
      {note && <span className="text-xs text-ink-faint">{note}</span>}
    </div>
  );
}
