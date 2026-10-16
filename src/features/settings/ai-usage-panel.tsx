"use client";

import { useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { formatDate, formatDateRange, formatShortDate, pluralize } from "@/lib/format";
import { useAsync } from "@/lib/use-async";
import { listRoles } from "@/services/roles";
import { getAiUsage, type AiUsage, type AiUsageKind } from "@/services/settings";
import { settingsErrorMessage } from "./error-copy";
import { ErrorBanner, LoadingCard } from "./load-state";
import { useSettingsContext } from "./settings-context";
import { SuperAdminNotice } from "./super-admin-notice";

/** "$0.0123" under a dollar, "$12.34" from a dollar up. */
function formatUsd(value: number): string {
  if (value < 1) return `$${value.toFixed(4)}`;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const KIND_LABEL: Record<AiUsageKind, string> = { llm: "LLM", stt: "Speech-to-text", tts: "Text-to-speech" };

type RangeDays = "7" | "30" | "90";
const RANGE_OPTIONS: { value: RangeDays; label: string }[] = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

/** Local calendar date as YYYY-MM-DD. */
function localDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The last `days` days, today included. */
function rangeFor(days: RangeDays): { days: RangeDays; from: string; to: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (Number(days) - 1));
  return { days, from: localDate(start), to: localDate(today) };
}

/** Usage is a Super admin report; the API answers others with a 404. */
export function AiUsagePanel() {
  const { admin } = useSettingsContext();
  if (admin && admin.access !== "super_admin") return <SuperAdminNotice what="see AI usage and cost" />;
  return <UsageReport />;
}

function UsageReport() {
  const [range, setRange] = useState(() => rangeFor("30"));
  const [roleId, setRoleId] = useState("");
  const roles = useAsync(listRoles, []);
  const { from, to } = range;
  const usage = useAsync(() => getAiUsage({ from, to, roleId: roleId || undefined }), [from, to, roleId]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5 rounded-card border border-line bg-surface p-2.5">
        <Select aria-label="Role" className="w-[260px] max-w-full" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
          <option value="">All roles</option>
          {(roles.data ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </Select>
        <SegmentedControl<RangeDays> label="Date range" options={RANGE_OPTIONS} value={range.days} onChange={(d) => setRange(rangeFor(d))} />
        <span className="flex-1" />
        <span className="text-[13px] leading-[18px] text-ink-faint">{formatDateRange(from, to)}</span>
      </div>
      {roles.error && !roles.data && <p className="m-0 text-xs text-ink-faint">Roles didn’t load, so only all roles are shown.</p>}
      {usage.error && <ErrorBanner message={settingsErrorMessage(usage.error, "Couldn’t load AI usage.")} onRetry={usage.reload} />}
      {usage.data ? <UsageBody usage={usage.data} loading={usage.loading} /> : usage.loading && <LoadingCard />}
    </>
  );
}

function UsageBody({ usage, loading }: { usage: AiUsage; loading: boolean }) {
  const { totals, perSession, budgetUsd } = usage;
  if (totals.calls === 0) {
    return (
      <section className={cn("rounded-panel border border-line bg-surface py-6", loading && "opacity-70")}>
        <EmptyState icon="chart" title="No AI usage in this range" description="Costs appear here once sessions use the AI." />
      </section>
    );
  }
  const budget = `$${budgetUsd.toFixed(2)}`;
  const avg = perSession.avgCostUsd;
  const kpis: { label: string; value: string; note: string; tone: "default" | "positive" | "attention" }[] = [
    {
      label: "Total cost",
      value: formatUsd(totals.costUsd),
      note: [pluralize(totals.calls, "AI call"), totals.failedCalls > 0 && `${totals.failedCalls} failed`].filter(Boolean).join(" · "),
      tone: "default",
    },
    {
      label: "Per completed session",
      value: avg === null ? "–" : formatUsd(avg),
      note: [
        avg === null ? "No completed sessions" : `${perSession.p90CostUsd === null ? "" : `p90 ${formatUsd(perSession.p90CostUsd)} · `}target ${budget}`,
        perSession.unpricedSessions > 0 && `${pluralize(perSession.unpricedSessions, "session")} without cost data excluded`,
      ].filter(Boolean).join(". "),
      tone: avg === null ? "default" : avg > budgetUsd ? "attention" : "positive",
    },
    {
      label: "Sessions over budget",
      value: `${perSession.overBudget} of ${perSession.completedSessions}`,
      note: `Above ${budget} each`,
      tone: perSession.overBudget > 0 ? "attention" : "default",
    },
    {
      label: "Unpriced calls",
      value: totals.unpricedCalls.toLocaleString("en-US"),
      note: "Model price missing",
      tone: totals.unpricedCalls > 0 ? "attention" : "default",
    },
  ];

  return (
    <div className={cn("flex flex-col gap-4", loading && "opacity-70")} aria-busy={loading || undefined}>
      <section aria-label="Usage summary" className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2.5">
        {kpis.map((k) => (
          <div key={k.label} className="flex flex-col gap-2 rounded-card border border-line bg-surface px-[18px] py-4">
            <span className="text-[13px] leading-[18px] text-ink-muted">{k.label}</span>
            <span
              className={cn(
                "text-2xl leading-8 font-semibold tracking-[-0.02em]",
                k.tone === "positive" ? "text-primary-text" : k.tone === "attention" ? "text-improve-text" : "text-ink",
              )}
            >
              {k.value}
            </span>
            <span className="text-xs leading-4 text-ink-faint">{k.note}</span>
          </div>
        ))}
      </section>
      <DailyCostChart daily={usage.daily} />
      <section className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] items-start gap-4">
        <Breakdown
          title="By service"
          rows={totals.byKind.map((k) => ({ key: k.kind, name: KIND_LABEL[k.kind] ?? k.kind, calls: k.calls, costUsd: k.costUsd }))}
        />
        <Breakdown
          title="By model"
          mono
          rows={totals.byModel.map((m) => ({
            key: m.model ?? "",
            name: m.model ?? "Unknown",
            calls: m.calls,
            costUsd: m.costUsd,
            // A named model with calls but no cost has no price set (only when the API reports unpriced calls).
            warn: m.model === null ? "Unidentified" : m.calls > 0 && m.costUsd === 0 && totals.unpricedCalls > 0 ? "No price set" : undefined,
          }))}
        />
      </section>
    </div>
  );
}

function DailyCostChart({ daily }: { daily: AiUsage["daily"] }) {
  const max = daily.reduce((m, d) => Math.max(m, d.costUsd), 0);
  const peak = max > 0 ? daily.find((d) => d.costUsd === max) : undefined;
  const first = daily[0];
  const mid = daily[Math.floor((daily.length - 1) / 2)];
  const last = daily[daily.length - 1];

  return (
    <section aria-labelledby="daily-cost-t" className="flex flex-col gap-3.5 rounded-panel border border-line bg-surface px-[22px] py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-col gap-[3px]">
          <h2 id="daily-cost-t" className="m-0 text-base leading-6 font-semibold text-ink">Daily cost</h2>
          <p className="m-0 text-[13px] leading-[18px] text-ink-faint">Cost of AI calls per day.</p>
        </div>
        <span className="text-[13px] leading-[18px] text-ink-muted">
          {peak ? (
            <>
              Peak <strong className="font-semibold text-ink">{formatUsd(max)}</strong> · {formatShortDate(peak.date)}
            </>
          ) : (
            "No cost on any day"
          )}
        </span>
      </div>
      <div aria-hidden="true" className="flex h-[150px] items-end gap-[3px] border-b border-line">
        {daily.map((d) => {
          const pct = max > 0 ? (d.costUsd / max) * 100 : 0;
          return (
            <span
              key={d.date}
              title={`${formatShortDate(d.date)} · ${formatUsd(d.costUsd)}`}
              className={cn("block min-h-0.5 min-w-0 flex-1 rounded-t-[2px]", d.costUsd > 0 ? "bg-primary" : "bg-neutral-soft")}
              style={{ height: `${pct}%` }}
            />
          );
        })}
      </div>
      {first && last && (
        <div aria-hidden="true" className="flex justify-between text-xs leading-4 text-ink-faint">
          <span>{formatShortDate(first.date)}</span>
          {daily.length > 2 && <span>{formatShortDate(mid.date)}</span>}
          <span>{formatShortDate(last.date)}</span>
        </div>
      )}
      <table className="sr-only">
        <caption>AI calls and cost per day</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Calls</th>
            <th scope="col">Cost</th>
          </tr>
        </thead>
        <tbody>
          {daily.map((d) => (
            <tr key={d.date}>
              <th scope="row">{formatDate(d.date)}</th>
              <td>{d.calls}</td>
              <td>{formatUsd(d.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

type BreakdownRow = { key: string; name: string; calls: number; costUsd: number; warn?: string };

const BREAKDOWN_GRID = "grid grid-cols-[minmax(0,1fr)_50px_70px] gap-3";

function Breakdown({ title, rows, mono = false }: { title: string; rows: BreakdownRow[]; mono?: boolean }) {
  const top = rows.reduce((m, r) => Math.max(m, r.costUsd), 0);
  return (
    <div role="table" aria-label={title} className="rounded-panel border border-line bg-surface px-5 py-2">
      <div role="row" className={cn(BREAKDOWN_GRID, "py-3 text-xs leading-4 font-semibold text-ink-faint")}>
        <span role="columnheader">{title}</span>
        <span role="columnheader" className="text-right">Calls</span>
        <span role="columnheader" className="text-right">Cost</span>
      </div>
      {rows.length === 0 ? (
        <div role="row" className="border-t border-line py-3 text-sm text-ink-muted">
          <span role="cell">No calls</span>
        </div>
      ) : (
        rows.map((r) => (
          <div key={r.key} role="row" className="flex flex-col gap-1.5 border-t border-line py-3">
            <div className={cn(BREAKDOWN_GRID, "items-baseline")}>
              <span role="rowheader" className={cn("flex min-w-0 items-center gap-2 text-ink", mono ? "font-mono text-[13px]" : "text-sm")}>
                <span className="truncate" title={r.name}>{r.name}</span>
                {r.warn && (
                  <span className="shrink-0 rounded-chip bg-improve-soft px-[7px] py-px font-sans text-[11px] leading-[14px] font-semibold text-improve-text">
                    {r.warn}
                  </span>
                )}
              </span>
              <span role="cell" className="text-right font-mono text-[13px] text-ink-muted">{r.calls.toLocaleString("en-US")}</span>
              <span role="cell" className="text-right font-mono text-[13px] text-ink">{formatUsd(r.costUsd)}</span>
            </div>
            <span aria-hidden="true" className="flex h-[3px] rounded-[2px] bg-neutral-soft">
              <span className="rounded-[2px] bg-primary-line" style={{ width: top > 0 ? `${(r.costUsd / top) * 100}%` : "0%" }} />
            </span>
          </div>
        ))
      )}
    </div>
  );
}
