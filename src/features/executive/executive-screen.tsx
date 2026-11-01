"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { useUrlState } from "@/lib/use-url-state";
import { useAsync } from "@/lib/use-async";
import { getExecutiveOverview } from "@/services/executive";
import { RecruiterResultsTab } from "./adoption-tab";
import { CandidateImprovementTab } from "./improvement-tab";
import { InsightsTab } from "./outcomes-tab";
import { ReportError, ReportLoading } from "./report-state";
import { cutoffLabel, currentUtcMonth, monthLabel } from "./view-model";

type TabId = "recruiters" | "improvement" | "insights";
const TABS: { id: TabId; label: string }[] = [
  { id: "recruiters", label: "Recruiter results" },
  { id: "improvement", label: "Candidate improvement" },
  { id: "insights", label: "More insights" },
];
const LEGACY_TABS: Record<string, TabId> = {
  adoption: "recruiters",
  outcomes: "improvement",
  quality: "insights",
};

export function ExecutiveScreen() {
  const url = useUrlState();
  const [defaultMonth] = useState(currentUtcMonth);
  const requestedTab = url.get("tab") ?? "recruiters";
  const tab =
    TABS.find((t) => t.id === requestedTab)?.id ??
    LEGACY_TABS[requestedTab] ??
    "recruiters";
  const period = url.get("period") ?? defaultMonth;
  const role = url.get("role") ?? "all";
  const query = { period, ...(role !== "all" ? { roleId: role } : {}) };
  const report = useAsync(() => getExecutiveOverview(query), [period, role]);
  const options = report.data?.options;
  const periods = [
    ...new Set([period, ...(options?.periods ?? [defaultMonth])]),
  ]
    .sort()
    .reverse();
  const roles = options?.roles ?? [];
  const data = !report.loading && !report.error ? report.data : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0 [&>div:last-child]:flex-col [&>div:last-child]:items-stretch min-[700px]:[&>div:last-child]:flex-row min-[700px]:[&>div:last-child]:items-end"
        title="Executive overview"
        description="See who brings candidates in and how their scores change."
        statusChip={
          <span className="rounded-full bg-primary-tint px-2.5 py-[3px] text-xs font-semibold text-primary-text">
            Live report
          </span>
        }
        secondaryActions={
          <div className="flex flex-wrap items-end gap-2.5">
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
              Reporting period
              <Select
                className="w-[170px]"
                value={period}
                onChange={(e) =>
                  url.set({
                    period:
                      e.target.value === defaultMonth ? null : e.target.value,
                  })
                }
              >
                {periods.map((m) => (
                  <option key={m} value={m}>
                    {monthLabel(m)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink-muted">
              Job role
              <Select
                className="w-[170px]"
                value={role}
                onChange={(e) =>
                  url.set({
                    role: e.target.value === "all" ? null : e.target.value,
                  })
                }
              >
                <option value="all">All job roles</option>
                {role !== "all" && !roles.some((r) => r.id === role) && (
                  <option value={role}>Requested role</option>
                )}
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.short}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        }
      />
      <Tabs
        label="Executive report"
        items={TABS}
        activeId={tab}
        panelId="executive-panel"
        onChange={(id) => url.set({ tab: id === "recruiters" ? null : id })}
        className="overflow-x-auto"
      />
      <div id="executive-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {report.loading ? (
          <ReportLoading />
        ) : report.error ? (
          <ReportError error={report.error} retry={report.reload} />
        ) : (
          data && (
            <>
              {tab === "recruiters" && (
                <RecruiterResultsTab
                  data={data.recruiterResults}
                  roles={data.options.roles}
                  meta={data.meta}
                />
              )}
              {tab === "improvement" && (
                <CandidateImprovementTab
                  key={`${period}-${role}`}
                  query={query}
                  options={data.options}
                />
              )}
              {tab === "insights" && (
                <InsightsTab key={`${period}-${role}`} query={query} />
              )}
            </>
          )
        )}
      </div>
      {data && (
        <>
          {data.meta.limitations.length > 0 && (
            <details className="text-xs leading-5 text-ink-muted">
              <summary className="cursor-pointer font-semibold">
                Reporting definitions and limitations
              </summary>
              <ul className="mt-2 space-y-1 pl-5">
                {data.meta.limitations.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </details>
          )}
          <footer className="flex flex-wrap justify-between gap-2 border-t border-line pt-4 text-xs leading-5 text-ink-faint">
            <span>
              Data before {cutoffLabel(data.meta.cutoff)} UTC. Scores compare
              candidate–role pairs; invitations count people.
            </span>
            <span>Preparation readiness is not a hiring prediction.</span>
          </footer>
        </>
      )}
    </div>
  );
}
