"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { downloadTextFile } from "@/lib/csv";
import { useAsync } from "@/lib/use-async";
import { useUrlState } from "@/lib/use-url-state";
import { exportReportCsv, getReport } from "@/services/reports";
import { listRoles } from "@/services/roles";
import { ReportBody } from "./report-body";

const DEFAULT_ROLE_TITLE = "Customer Support Associate";

export function ReportsScreen() {
  const url = useUrlState();
  const roles = useAsync(listRoles, []);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);

  const list = roles.data ?? [];
  const requested = url.get("role");
  const roleId =
    (requested && list.find((r) => r.id === requested)?.id) ??
    list.find((r) => r.title === DEFAULT_ROLE_TITLE)?.id ??
    list[0]?.id ??
    "";
  const from = url.get("from") ?? undefined;
  const to = url.get("to") ?? undefined;

  const report = useAsync(
    () => (roleId ? getReport({ roleId, from, to }) : Promise.resolve(undefined)),
    [roleId, from, to],
  );

  async function onExport() {
    setExporting(true);
    setExportError(false);
    try {
      const file = await exportReportCsv({ roleId, from, to });
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
        <Button iconLeft="download" onClick={onExport} disabledReason={!roleId ? "Pick a role to export." : exporting ? "Preparing the file." : undefined}>
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
        <span className="inline-flex h-9 items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm text-ink">
          <Icon name="calendar" size={16} className="text-ink-muted" />
          {report.data?.range.label ?? "Last 30 days"}
        </span>
      </div>
      <ReportBody report={report.data} loading={report.loading} error={report.error} onRetry={report.reload} />
    </>
  );
}
