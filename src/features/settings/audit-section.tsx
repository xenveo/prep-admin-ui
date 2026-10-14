"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { useAsync } from "@/lib/use-async";
import { TODAY, type AuditEvent } from "@/lib/types";
import { auditWhenLabel, listAdmins, listAuditActions, listAuditEvents } from "@/services/settings";
import { ErrorBanner } from "./load-state";

type Range = "7" | "30" | "90" | "all" | "custom";

function shiftDay(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
}

const COLUMNS: Column<AuditEvent>[] = [
  { id: "who", header: "Who", render: (e) => e.actor },
  { id: "action", header: "Action", render: (e) => e.action },
  { id: "item", header: "Item", render: (e) => <span className="text-ink-muted">{e.itemLabel}</span> },
  { id: "when", header: "When", render: (e) => <span className="text-ink-muted">{auditWhenLabel(e)}</span> },
];

export function AuditSection() {
  const [who, setWho] = useState("");
  const [action, setAction] = useState("");
  const [range, setRange] = useState<Range>("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const admins = useAsync(listAdmins, []);
  const actions = useAsync(listAuditActions, []);
  const day = TODAY.slice(0, 10);
  const filters = {
    actorId: who || undefined,
    action: action || undefined,
    from: range === "custom" ? from || undefined : range === "all" ? undefined : shiftDay(day, Number(range)),
    to: range === "custom" ? to || undefined : undefined,
  };
  const events = useAsync(() => listAuditEvents(filters), [who, action, range, from, to]);
  const anyFilter = who || action || range !== "30";

  return (
    <>
      {events.error && <ErrorBanner message="Couldn't load the audit log. Try again." onRetry={events.reload} />}
      <section aria-label="Audit log" className="rounded-md border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <Select aria-label="Who" className="w-[170px]" value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">Who: Anyone</option>
            {(admins.data ?? [])
              .filter((a) => a.name)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </Select>
          <Select aria-label="Action" className="w-[210px]" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">Action: Any</option>
            {(actions.data ?? []).map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
          <Select aria-label="Date range" className="w-[160px]" value={range} onChange={(e) => setRange(e.target.value as Range)}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">Any time</option>
            <option value="custom">Custom range</option>
          </Select>
          {range === "custom" && (
            <>
              <Input type="date" aria-label="From date" className="w-[150px]" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
              <span aria-hidden="true" className="text-ink-muted">
                to
              </span>
              <Input type="date" aria-label="To date" className="w-[150px]" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </>
          )}
        </div>
        <DataTable
          ariaLabel="Audit log"
          columns={COLUMNS}
          rows={events.data ?? []}
          rowId={(e) => e.id}
          loading={events.loading && !events.data}
          emptyState={
            <EmptyState
              icon="search"
              title={anyFilter ? "No changes match these filters" : "Nothing logged yet"}
              description={anyFilter ? "Try a wider date range or clear a filter." : "Changes made in this console will show up here."}
            />
          }
        />
      </section>
    </>
  );
}
