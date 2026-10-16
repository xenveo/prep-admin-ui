"use client";

import { useState } from "react";
import { ChartFrame } from "@/components/charts/chart-frame";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StatStrip } from "@/components/ui/stat-strip";
import { formatDate, formatDateRange, formatShortDate, pluralize } from "@/lib/format";
import { useAsync } from "@/lib/use-async";
import { listRoles } from "@/services/roles";
import { getAiUsage, type AiUsage, type AiUsageKind } from "@/services/settings";
import { settingsErrorMessage } from "./error-copy";
import { ErrorBanner, LoadingCard } from "./load-state";
import { SettingsCard } from "./setting-row";

/** "$0.0123" under a dollar, "$12.34" from a dollar up. */
function formatUsd(value: number): string {
  if (value < 1) return `$${value.toFixed(4)}`;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const KIND_LABEL: Record<AiUsageKind, string> = { llm: "LLM", stt: "Speech-to-text", tts: "Text-to-speech" };

/** Local calendar date as YYYY-MM-DD. */
function localDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function last30Days(): { from: string; to: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
  return { from: localDate(start), to: localDate(today) };
}

export function AiUsagePanel() {
  const [range, setRange] = useState(last30Days);
  const [roleId, setRoleId] = useState("");
  const roles = useAsync(listRoles, []);
  const { from, to } = range;
  const rangeError = !from || !to ? "Pick a start and end date." : from > to ? "The start date must precede the end date." : null;
  const usage = useAsync(
    () => (rangeError ? Promise.resolve(undefined) : getAiUsage({ from, to, roleId: roleId || undefined })),
    [from, to, roleId, rangeError],
  );

  return (
    <SettingsCard title="AI usage and cost" className="gap-4">
      <p className="m-0 text-xs text-ink-muted">What AI calls cost, and how sessions compare with the per-session target.</p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Role" className="w-[260px] max-w-full">
          {({ id }) => (
            <Select id={id} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">All roles</option>
              {(roles.data ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="From">{({ id }) => <Input id={id} type="date" value={from} max={to || undefined} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />}</Field>
        <Field label="To">{({ id }) => <Input id={id} type="date" value={to} min={from || undefined} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />}</Field>
      </div>
      {roles.error && !roles.data && <p className="m-0 text-xs text-ink-muted">Roles didn’t load, so only all roles are shown.</p>}
      {rangeError ? (
        <p role="alert" className="m-0 text-sm text-improve-text">{rangeError}</p>
      ) : (
        <>
          {usage.error && <ErrorBanner message={settingsErrorMessage(usage.error, "Couldn’t load AI usage.")} onRetry={usage.reload} />}
          {usage.data ? <UsageBody usage={usage.data} loading={usage.loading} /> : usage.loading && <LoadingCard />}
        </>
      )}
    </SettingsCard>
  );
}

function UsageBody({ usage, loading }: { usage: AiUsage; loading: boolean }) {
  const { totals, perSession, budgetUsd } = usage;
  if (totals.calls === 0) {
    return <EmptyState icon="chart" title="No AI usage in this range" description="Costs appear here once sessions use the AI." className={loading ? "opacity-70" : undefined} />;
  }
  const target = `Target $${budgetUsd.toFixed(2)}`;
  const avg = perSession.avgCostUsd;
  const callNotes = [
    totals.unpricedCalls > 0 && `${totals.unpricedCalls} unpriced`,
    totals.failedCalls > 0 && `${totals.failedCalls} failed`,
  ].filter(Boolean).join(" · ");

  return (
    <div className={`flex flex-col gap-4 ${loading ? "opacity-70" : ""}`} aria-busy={loading || undefined}>
      <StatStrip
        stats={[
          { label: "Total cost", value: formatUsd(totals.costUsd), note: formatDateRange(usage.range.from, usage.range.to) },
          {
            label: "Cost per completed session",
            value: avg === null ? "–" : formatUsd(avg),
            tone: avg === null ? "default" : avg > budgetUsd ? "attention" : "positive",
            note: [
              avg === null ? "No completed sessions" : `${perSession.p90CostUsd === null ? "" : `p90 ${formatUsd(perSession.p90CostUsd)} · `}${target}`,
              perSession.unpricedSessions > 0 && `${pluralize(perSession.unpricedSessions, "session")} without cost data excluded`,
            ].filter(Boolean).join(". "),
          },
          {
            label: "Sessions over budget",
            value: `${perSession.overBudget} of ${perSession.completedSessions}`,
            tone: perSession.overBudget > 0 ? "attention" : "default",
            note: `Above $${budgetUsd.toFixed(2)} each`,
          },
          { label: "AI calls", value: totals.calls.toLocaleString("en-US"), note: callNotes || undefined },
        ]}
      />
      <DailyCostChart daily={usage.daily} />
      <div className="grid items-start gap-4 min-[900px]:grid-cols-2">
        <BreakdownTable
          caption="By service"
          nameHeader="Service"
          rows={totals.byKind.map((k) => ({ key: k.kind, name: KIND_LABEL[k.kind] ?? k.kind, calls: k.calls, costUsd: k.costUsd }))}
        />
        <BreakdownTable
          caption="By model"
          nameHeader="Model"
          rows={totals.byModel.map((m) => ({ key: m.model ?? "", name: m.model ?? "Unknown", calls: m.calls, costUsd: m.costUsd }))}
        />
      </div>
    </div>
  );
}

function DailyCostChart({ daily }: { daily: AiUsage["daily"] }) {
  const max = daily.reduce((m, d) => Math.max(m, d.costUsd), 0);
  const peak = daily.find((d) => d.costUsd === max);
  const first = daily[0];
  const last = daily[daily.length - 1];
  const summary = first && last
    ? `Daily AI cost, ${formatDateRange(first.date, last.date)}.${peak && max > 0 ? ` Highest ${formatUsd(max)} on ${formatDate(peak.date)}.` : " No cost on any day."}`
    : "Daily AI cost. No days in range.";

  return (
    <ChartFrame
      title="Daily cost"
      caption="Cost of AI calls per day"
      table={{
        caption: "AI calls and cost per day",
        columns: ["Date", "Calls", "Cost"],
        rows: daily.map((d) => [formatDate(d.date), d.calls, formatUsd(d.costUsd)]),
      }}
    >
      <div className="flex flex-col gap-1">
        <div role="img" aria-label={summary} className="flex h-40 items-end gap-px border-b border-line">
          {daily.map((d) => {
            const pct = max > 0 ? (d.costUsd / max) * 100 : 0;
            return (
              <div key={d.date} title={`${formatDate(d.date)}: ${formatUsd(d.costUsd)}`} className="flex h-full min-w-0 flex-1 items-end hover:bg-row-hover">
                <span
                  aria-hidden="true"
                  className="block w-full rounded-t-sm bg-primary"
                  style={{ height: d.costUsd > 0 ? `max(2px, ${pct}%)` : 0 }}
                />
              </div>
            );
          })}
        </div>
        {first && last && (
          <div aria-hidden="true" className="flex justify-between text-[12px] leading-4 text-ink-muted">
            <span>{formatShortDate(first.date)}</span>
            <span>Peak {formatUsd(max)}</span>
            <span>{formatShortDate(last.date)}</span>
          </div>
        )}
      </div>
    </ChartFrame>
  );
}

type BreakdownRow = { key: string; name: string; calls: number; costUsd: number };

function BreakdownTable({ caption, nameHeader, rows }: { caption: string; nameHeader: string; rows: BreakdownRow[] }) {
  return (
    <table className="w-full border-collapse text-[13px]">
      <caption className="pb-1 text-left text-xs font-semibold text-ink-muted">{caption}</caption>
      <thead>
        <tr>
          <th scope="col" className="h-8 text-left font-normal text-ink-muted">{nameHeader}</th>
          <th scope="col" className="h-8 text-right font-normal text-ink-muted">Calls</th>
          <th scope="col" className="h-8 text-right font-normal text-ink-muted">Cost</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr className="border-t border-line">
            <td colSpan={3} className="h-8 text-ink-muted">No calls</td>
          </tr>
        ) : (
          rows.map((r) => (
            <tr key={r.key} className="border-t border-line">
              <th scope="row" className="h-8 max-w-[220px] truncate pr-3 text-left font-normal text-ink" title={r.name}>{r.name}</th>
              <td className="text-right text-ink">{r.calls.toLocaleString("en-US")}</td>
              <td className="text-right text-ink">{formatUsd(r.costUsd)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
