"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { downloadTextFile } from "@/lib/csv";
import { useAsync } from "@/lib/use-async";
import { useUrlState } from "@/lib/use-url-state";
import { exportReportCsv, getReport } from "@/services/reports";
import { listRoles } from "@/services/roles";
import { ReportBody } from "./report-body";

type RangeId = "7d" | "30d" | "90d" | "all" | "custom";
const RANGES: { value: RangeId; label: string }[] = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom" },
];
const RANGE_DAYS: Partial<Record<RangeId, number>> = { "7d": 7, "30d": 30, "90d": 90 };

/** Local calendar date `days` ago as YYYY-MM-DD. */
function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseRange(value: string | null, hasDates: boolean): RangeId {
  const known = RANGES.find((r) => r.value === value)?.value;
  return known ?? (hasDates ? "custom" : "all");
}

const FIELD = "[&_select]:h-9 [&_select]:pl-2.5";
const DATE = "h-9! w-auto! px-2.5! text-[13px]!";

export function ReportsScreen() {
  const url = useUrlState();
  const roles = useAsync(listRoles, []);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  const list = roles.data ?? [];
  const requested = url.get("role");
  const roleId =
    (requested && list.find((r) => r.id === requested)?.id) ??
    list[0]?.id ??
    "";
  const customFrom = url.get("from") ?? undefined;
  const customTo = url.get("to") ?? undefined;
  const range = parseRange(url.get("range"), Boolean(customFrom || customTo));
  const presetDays = RANGE_DAYS[range];
  const from = range === "custom" ? customFrom : presetDays ? isoDaysAgo(presetDays) : undefined;
  const to = range === "custom" ? customTo : undefined;
  const dateBasis = url.get("dateBasis") === "invited" ? "invited" : "completed";
  const invalidRange = Boolean(from && to && from > to);

  const report = useAsync(
    () => (roleId && !invalidRange ? getReport({ roleId, from, to, dateBasis }) : Promise.resolve(undefined)),
    [roleId, from, to, dateBasis, invalidRange],
  );

  async function onExport() {
    setExporting(true);
    setExportError(false);
    try {
      const file = await exportReportCsv({ roleId, from, to, dateBasis });
      downloadTextFile(file.filename, file.csv);
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  function onRange(next: RangeId) {
    // Presets drop any custom dates; Custom keeps whatever dates are already in the URL.
    if (next === "custom") url.set({ range: "custom" });
    else url.set({ range: next === "all" ? null : next, from: null, to: null });
  }

  const header = (
    <PageHeader
      className="mb-0!"
      title="Reports"
      description="How prepared candidates are, and where they get stuck."
      secondaryActions={
        <Button
          iconLeft="download"
          className="border-neutral-line! hover:border-ink-faint!"
          onClick={onExport}
          disabledReason={!roleId ? "Pick a role to export." : invalidRange ? "The start date must precede the end date." : exporting ? "Preparing the file." : undefined}
        >
          Export CSV
        </Button>
      }
    />
  );

  if (roles.error && !roles.data) {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="rounded-panel border border-line bg-surface">
          <EmptyState
            icon="alert"
            title="Reports didn’t load"
            description="Something went wrong while loading roles. Your data is safe."
            action={<Button variant="primary" onClick={roles.reload}>Try again</Button>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}
      {exportError && (
        <p role="alert" className="m-0 rounded-[10px] border border-error bg-surface px-3.5 py-2.5 text-sm font-medium text-error">
          The CSV wasn’t exported. Try again.
        </p>
      )}
      <div role="group" aria-label="Report filters" className="flex flex-wrap items-center gap-2.5 rounded-card border border-line bg-surface p-2.5">
        <Select
          aria-label="Role"
          className={`${FIELD} w-auto max-w-full [&_select]:font-semibold`}
          value={roleId}
          disabled={list.length === 0}
          onChange={(e) => url.set({ role: e.target.value })}
        >
          {list.length === 0 && <option value="">Loading roles…</option>}
          {list.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </Select>
        <span aria-hidden="true" className="h-[22px] w-px bg-input-line" />
        <SegmentedControl label="Date range" options={RANGES} value={range} onChange={onRange} />
        {range === "custom" && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Input
              type="date"
              aria-label="From"
              className={DATE}
              invalid={invalidRange}
              value={customFrom ?? ""}
              max={customTo}
              onChange={(e) => url.set({ range: "custom", from: e.target.value || null })}
            />
            <span className="text-[13px] leading-5 text-ink-faint">to</span>
            <Input
              type="date"
              aria-label="To"
              className={DATE}
              invalid={invalidRange}
              value={customTo ?? ""}
              min={customFrom}
              onChange={(e) => url.set({ range: "custom", to: e.target.value || null })}
            />
          </div>
        )}
        <span aria-hidden="true" className="flex-1" />
        <label className="flex items-center gap-2 text-[13px] leading-5 text-ink-faint">
          Dates by
          <Select
            className={`${FIELD} w-auto [&_select]:text-[13px]`}
            value={dateBasis}
            onChange={(e) => url.set({ dateBasis: e.target.value === "invited" ? "invited" : null })}
          >
            <option value="completed">Session completion</option>
            <option value="invited">Invite date</option>
          </Select>
        </label>
      </div>
      {invalidRange ? (
        <p role="alert" className="m-0 text-sm text-improve-text">The start date must precede the end date.</p>
      ) : !roleId && !roles.loading ? (
        <div className="rounded-panel border border-line bg-surface">
          <EmptyState icon="chart" title="No roles yet" description="Create a role to view its reports." />
        </div>
      ) : (
        <ReportBody report={report.data} loading={report.loading} error={report.error} onRetry={report.reload} />
      )}
    </div>
  );
}
