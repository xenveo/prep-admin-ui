"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { useAsync } from "@/lib/use-async";
import { type AuditEvent } from "@/lib/types";
import { auditWhenLabel, listAdmins, listAuditActions, listAuditPage } from "@/services/settings";
import { ErrorBanner } from "./load-state";

type Range = "7" | "30" | "90" | "all" | "custom";

function shiftDay(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
}

/** Filter controls: 36px tall, 13px text, per the design's toolbar. */
const FILTER = "[&_select]:!h-9 [&_select]:!text-[13px]";
const DATE = "!h-9 !text-[13px]";

const COLUMNS: Column<AuditEvent>[] = [
  { id: "who", header: "Who", width: "minmax(140px,1fr)", render: (e) => <span className="truncate font-semibold text-ink">{e.actor}</span> },
  {
    id: "action",
    header: "Action",
    width: "minmax(0,3fr)",
    render: (e) => (
      <span className="min-w-0 truncate text-ink-soft">
        {e.action}
        {e.itemLabel && <span className="text-ink-faint"> · {e.itemLabel}</span>}
      </span>
    ),
  },
  { id: "when", header: "When", align: "right", width: "120px", render: (e) => <span className="text-[13px] text-ink-faint">{auditWhenLabel(e)}</span> },
];

export function AuditSection() {
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const cursor = cursors[cursors.length - 1];
  const [who, setWho] = useState("");
  const [action, setAction] = useState("");
  const [range, setRange] = useState<Range>("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const admins = useAsync(listAdmins, []);
  const actions = useAsync(listAuditActions, []);
  const day = new Date().toISOString().slice(0, 10);
  const filters = {
    actorId: who || undefined,
    action: action || undefined,
    from: range === "custom" ? from || undefined : range === "all" ? undefined : shiftDay(day, Number(range) - 1),
    to: range === "custom" ? to || undefined : undefined,
  };
  const events = useAsync(() => listAuditPage(filters, cursor), [who, action, range, from, to, cursor]);
  const anyFilter = who || action || range !== "30";
  const paged = cursors.length > 1 || Boolean(events.data?.nextCursor);

  return (
    <>
      {(admins.error || actions.error) && <ErrorBanner message="Couldn’t load audit filters." onRetry={() => { admins.reload(); actions.reload(); }} />}
      {events.error && <ErrorBanner message="Couldn't load the audit log. Try again." onRetry={events.reload} />}
      <section aria-label="Audit log" className="overflow-hidden rounded-panel border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-[18px] py-3.5">
          <Select aria-label="Who" className={`w-[170px] ${FILTER}`} value={who} onChange={(e) => { setWho(e.target.value); setCursors([undefined]); }}>
            <option value="">Anyone</option>
            {(admins.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name ?? a.email}
              </option>
            ))}
          </Select>
          <Select aria-label="Action" className={`w-[190px] ${FILTER}`} value={action} onChange={(e) => { setAction(e.target.value); setCursors([undefined]); }}>
            <option value="">Any action</option>
            {(actions.data ?? []).map((a) => (
              <option key={a}>{a}</option>
            ))}
          </Select>
          <Select aria-label="Date range" className={`w-[150px] ${FILTER}`} value={range} onChange={(e) => { setRange(e.target.value as Range); setCursors([undefined]); }}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">Any time</option>
            <option value="custom">Custom range</option>
          </Select>
          {range === "custom" && (
            <>
              <Input type="date" aria-label="From date" className={`w-[150px] ${DATE}`} value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setCursors([undefined]); }} />
              <span aria-hidden="true" className="text-[13px] text-ink-faint">
                to
              </span>
              <Input type="date" aria-label="To date" className={`w-[150px] ${DATE}`} value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setCursors([undefined]); }} />
            </>
          )}
        </div>
        <DataTable
          ariaLabel="Audit log"
          className="!rounded-none !border-0 !bg-transparent"
          columns={COLUMNS}
          rows={events.error ? [] : events.data?.rows ?? []}
          rowId={(e) => e.id}
          loading={events.loading}
          emptyState={
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[15px] leading-6 font-semibold text-ink">{anyFilter ? "No changes match these filters" : "Nothing logged yet"}</span>
              <span className="text-[13px] leading-5 text-ink-faint">
                {anyFilter ? "Try a wider date range or clear a filter." : "Changes made in this console will show up here."}
              </span>
            </div>
          }
        />
        {paged && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-[18px] py-3">
            <span className="text-[13px] text-ink-faint">Page {cursors.length} · {events.data?.total ?? 0} events</span>
            <div className="flex gap-2">
              <Button size="sm" disabled={events.loading || cursors.length === 1} onClick={() => setCursors((c) => c.slice(0, -1))}>
                Previous
              </Button>
              <Button size="sm" disabled={events.loading || !events.data?.nextCursor} onClick={() => { if (events.data?.nextCursor) setCursors((c) => [...c, events.data!.nextCursor!]); }}>
                Next
              </Button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
