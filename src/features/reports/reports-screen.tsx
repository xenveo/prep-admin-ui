"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { downloadTextFile } from "@/lib/csv";
import { useAsync } from "@/lib/use-async";
import { useUrlState } from "@/lib/use-url-state";
import { exportReportCsv, getReport } from "@/services/reports";
import { listRoles } from "@/services/roles";
import { ReportBody } from "./report-body";

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
  const from = url.get("from") ?? undefined;
  const to = url.get("to") ?? undefined;
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

  const header = (
    <PageHeader
      title="Reports"
      description="How prepared candidates are, and where they get stuck."
      secondaryActions={
        <Button iconLeft="download" onClick={onExport} disabledReason={!roleId ? "Pick a role to export." : invalidRange ? "The start date must precede the end date." : exporting ? "Preparing the file." : undefined}>
          Export CSV
        </Button>
      }
    />
  );

  if (roles.error && !roles.data) {
    return (
      <>
        {header}
        <EmptyState
          icon="alert"
          title="Reports didn’t load"
          description="Something went wrong while loading roles. Your data is safe."
          action={<Button variant="primary" onClick={roles.reload}>Try again</Button>}
        />
      </>
    );
  }

  return (
    <>
      {header}
      {exportError && (
        <p role="alert" className="mb-4 text-sm text-improve-text">
          The CSV wasn’t exported. Try again.
        </p>
      )}
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <Field label="Role" className="w-[260px] max-w-full">
          {({ id }) => (
            <Select
              id={id}
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
          )}
        </Field>
        <Field label="From">{({id}) => <Input id={id} type="date" value={from ?? ""} onChange={(e)=>url.set({from:e.target.value || null})} />}</Field>
        <Field label="To">{({id}) => <Input id={id} type="date" value={to ?? ""} onChange={(e)=>url.set({to:e.target.value || null})} />}</Field>
        <Field label="Date basis">{({id}) => <Select id={id} value={dateBasis} onChange={(e)=>url.set({dateBasis:e.target.value})}><option value="completed">Session completion</option><option value="invited">Candidate invitation</option></Select>}</Field>
      </div>
      {invalidRange ? <p role="alert" className="text-sm text-improve-text">The start date must precede the end date.</p> : !roleId && !roles.loading ? <EmptyState icon="chart" title="No roles yet" description="Create a role to view its reports." /> : <ReportBody report={report.data} loading={report.loading} error={report.error} onRetry={report.reload} />}
    </>
  );
}
