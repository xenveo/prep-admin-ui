"use client";

import { Avatar } from "@/components/ui/avatar";
import { Card, fmtPct } from "./parts";
import { ScoreChange, ScoreComparison } from "./performance-comparison";
import type {
  ExecutiveOverview,
  ExecutiveRole,
  ExecutiveMetadata,
} from "@/lib/api/executive-contracts";
import { cutoffLabel, monthLabel } from "./view-model";

type Results = ExecutiveOverview["recruiterResults"];
type Summary = Results["team"];

export function RecruiterResultsTab({
  data,
  roles,
  meta,
}: {
  data: Results;
  roles: ExecutiveRole[];
  meta: ExecutiveMetadata;
}) {
  const cohort = data.cohortMonth ? monthLabel(data.cohortMonth) : "—";
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="m-0 text-xl font-semibold tracking-[-0.02em] text-ink">
            Are recruiters getting people in?
          </h2>
          <p className="mt-1.5 mb-0 text-sm text-ink-muted">
            Invitations, acceptance, and what happens after candidates start
            practising.
          </p>
        </div>
        <span className="text-xs text-ink-faint">
          Invited in {cohort} · data before {cutoffLabel(meta.cutoff)} UTC
        </span>
      </div>
      <Card
        id="recruiter-results-h"
        title="Recruiter results"
        sub="Acceptance means signing in within 7 days of the first invitation."
        info="Results belong to the original inviter, not necessarily the current owner. Acceptance includes only invitations with a complete seven-day observation window. Scores compare candidate–role pairs with two or more completed sessions before cutoff; a person can contribute to more than one role."
      >
        {data.team.invited === 0 && (
          <p role="status" className="m-0 text-sm text-ink-muted">
            No first invitations were issued to candidates in this cohort.
            Recruiters with no invitations remain visible below.
          </p>
        )}
        <div className="-mx-[22px] -mb-[22px] overflow-x-auto">
          <table className="w-full min-w-[740px] border-collapse text-left text-sm leading-5">
            <caption className="sr-only">
              Recruiter invitation, acceptance and paired score improvement
              results
            </caption>
            <thead>
              <tr className="bg-surface-sunken text-xs text-ink-muted">
                <th scope="col" className="px-[22px] py-3 font-semibold">
                  Recruiter
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Invites
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Acceptance
                </th>
                <th
                  scope="col"
                  className="min-w-[230px] px-[22px] py-3 font-semibold"
                >
                  Score improvement
                </th>
              </tr>
            </thead>
            <tbody>
              {data.recruiters.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-line align-middle hover:bg-row-hover"
                >
                  <th scope="row" className="px-[22px] py-5 font-normal">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.name} size={32} />
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-ink">{r.name}</span>
                        <span className="text-xs text-ink-faint">
                          {r.roles.length
                            ? r.roles
                                .map(
                                  (id) => roles.find((x) => x.id === id)?.short,
                                )
                                .join(" · ")
                            : "No cohort roles"}
                        </span>
                      </div>
                    </div>
                  </th>
                  <td className="px-5 py-5">
                    <span className="text-lg font-semibold tabular-nums text-ink">
                      {r.invited}
                    </span>
                    <p className="m-0 text-xs text-ink-faint">
                      unique candidates
                    </p>
                  </td>
                  <td className="px-5 py-5">
                    <AcceptanceCell row={r} />
                  </td>
                  <td className="px-[22px] py-4">
                    <ImprovementCell row={r} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-line bg-surface-sunken">
                <th
                  scope="row"
                  className="px-[22px] py-5 font-semibold text-ink"
                >
                  All recruiters
                </th>
                <td className="px-5 py-5 text-lg font-semibold tabular-nums">
                  {data.team.invited}
                </td>
                <td className="px-5 py-5">
                  <AcceptanceCell row={data.team} />
                </td>
                <td className="px-[22px] py-4">
                  <ImprovementCell row={data.team} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      <p className="m-0 max-w-4xl text-xs leading-5 text-ink-faint">
        Invites count people once, excluding resends. Acceptance uses the same
        invitation cohort. Score changes compare the same candidates’ first and
        latest sessions; team averages are weighted by paired comparisons. A
        person assigned multiple roles can contribute multiple comparisons.
        Cohort outcomes give context, not exclusive credit for improvement.{" "}
        {data.team.unassignedCandidates > 0 &&
          `${data.team.unassignedCandidates} invited people have no role in this report.`}
      </p>
    </div>
  );
}

function AcceptanceCell({ row }: { row: Summary }) {
  return (
    <div className="flex flex-col gap-1">
      <strong className="text-base font-semibold tabular-nums text-ink">
        {fmtPct(row.acceptance)}
      </strong>
      <span className="text-xs text-ink-faint">
        {row.acceptance.den
          ? `${row.acceptance.num} / ${row.acceptance.den} accepted`
          : row.invited
            ? "No completed observation windows"
            : "No invitations"}
      </span>
      {row.awaitingAcceptanceWindow > 0 && (
        <span className="text-xs text-ink-faint">
          {row.awaitingAcceptanceWindow} awaiting 7-day window
        </span>
      )}
    </div>
  );
}
function ImprovementCell({ row }: { row: Summary }) {
  return (
    <div className="max-w-[245px]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <ScoreChange value={row.gain} />
        <span className="text-xs text-ink-muted">
          {row.first == null
            ? "No paired scores"
            : `${row.first.toFixed(1)} → ${row.latest!.toFixed(1)}`}
        </span>
      </div>
      {row.paired > 0 && (
        <ScoreComparison
          first={row.first}
          latest={row.latest}
          label="Average candidate scores"
          compact
        />
      )}
      <span className="text-xs text-ink-faint">
        {row.paired} candidate–role pairs with 2+ sessions
        {row.paired > 0 && row.paired < 20 ? " · small sample" : ""}
      </span>
    </div>
  );
}
