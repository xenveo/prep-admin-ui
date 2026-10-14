/** Reports (A9). The weakest dimension is computed from the averages, never hard-coded. */
import { BAND_LABEL, toBand, type Band } from "@/lib/bands";
import { toCsv } from "@/lib/csv";
import { daysSince, formatDateRange, relativeTime } from "@/lib/format";
import {
  DIMENSION_IDS,
  DIMENSION_LABEL,
  TODAY,
  type BandCounts,
  type CsvExport,
  type DimensionId,
  type NeedsAttention,
  type Report,
  type ReportQuery,
} from "@/lib/types";
import { fixtures } from "@/services/fixtures";
import { respond } from "@/services/latency";
import { findRole, getStore, roleView } from "@/services/store";

const BAND_ORDER: Band[] = ["ready", "nearly", "developing", "not_ready"];
const emptyBands = (): BandCounts => ({ ready: 0, nearly: 0, developing: 0, not_ready: 0 });

const SUGGESTION: Record<DimensionId, string> = {
  structure: "Consider a flash card on STAR.",
  content: "Consider a flash card on what a strong answer includes.",
  delivery: "Consider a flash card on pace and filler words.",
  relevance: "Consider a flash card on answering the question that was asked.",
};

/** Lowest-average dimension (ties go to the first in Content, Structure, Delivery, Relevance order). */
export function weakestDimension(avgs: Record<DimensionId, number>): { id: DimensionId; label: string; value: number } {
  const id = DIMENSION_IDS.reduce((worst, d) => (avgs[d] < avgs[worst] ? d : worst), DIMENSION_IDS[0]);
  return { id, label: DIMENSION_LABEL[id], value: avgs[id] };
}

function rangeFor(q: ReportQuery) {
  const from = q.from ?? fixtures.report_role_csa.range.from;
  const to = q.to ?? fixtures.report_role_csa.range.to;
  const days = daysSince(from, to);
  const label = days === 30 && to === TODAY ? "Last 30 days" : "Custom range";
  return { from, to, label: `${label} · ${formatDateRange(from, to)}` };
}

function attentionFromStore(roleId: string): NeedsAttention[] {
  const s = getStore();
  const out: NeedsAttention[] = [];
  for (const c of s.candidates) {
    if (c.status === "revoked" || c.status === "invite_pending" || !c.assignments.some((a) => a.roleId === roleId)) continue;
    const mine = s.sessions.filter((x) => x.candidateId === c.id && x.roleId === roleId).sort((a, b) => b.number - a.number);
    const latest = mine[0];
    const idle = c.lastActiveAt ? daysSince(c.lastActiveAt) : null;
    const low = latest !== undefined && latest.score < 50;
    const inactive = idle !== null && idle >= 14;
    if (!low && !inactive) continue;
    const why = low
      ? mine.length >= 2 && mine[0].score <= mine[mine.length - 1].score
        ? `${BAND_LABEL[latest.band]}, no change over ${mine.length} sessions`
        : BAND_LABEL[latest.band]
      : `No activity for ${idle} days`;
    out.push({
      candidateId: c.id,
      name: c.name,
      email: c.email,
      why,
      sessions: mine.length,
      latestScore: latest?.score ?? null,
      lastActiveLabel: c.lastActiveAt ? relativeTime(c.lastActiveAt) : "Not yet",
      lastActiveAt: c.lastActiveAt ?? undefined,
    });
  }
  return out;
}

/**
 * Report for one role. Customer Support Associate uses the fixture report. Junior Data Analyst gets a
 * small illustrative report so the role picker isn't empty. Draft and archived roles have no data.
 * The date range is echoed back but does not change the numbers (mock data).
 */
export function getReport(query: ReportQuery): Promise<Report> {
  return respond(() => {
    const role = findRole(query.roleId);
    const view = roleView(role);
    const range = rangeFor(query);
    const base = { roleId: role.id, roleTitle: role.title, range };

    let stats: Report["stats"];
    let latest = emptyBands();
    let baseline = emptyBands();
    let hardest: Report["hardestQuestions"] = [];
    let dims: Record<DimensionId, number> | null = null;
    let illustrative: string[] = [];
    let attention: NeedsAttention[] = [];
    let hasData = true;

    if (role.id === "role_csa") {
      const fx = fixtures.report_role_csa;
      stats = { ...fx.stats, change: fx.stats.avgLatest - fx.stats.avgBaseline };
      latest = { ...fx.bandsLatest };
      baseline = { ...fx.bandsBaseline };
      hardest = fx.hardestQuestions.map((h) => ({
        questionId: getStore().questions.find((q) => q.text === h.question)?.id,
        ...h,
      }));
      dims = { ...fx.dimensionAverages };
      illustrative = ["Baseline band split", "Dimension averages", "Hardest questions: times asked and learning", "Needs attention"];
      attention = [
        ...fx.needsAttention.items.map((n) => ({
          name: n.name,
          email: n.email,
          why: n.why,
          sessions: n.sessions,
          latestScore: n.latestScore,
          lastActiveLabel: /^\d{4}-/.test(n.lastActive) ? relativeTime(n.lastActive) : n.lastActive,
        })),
        ...attentionFromStore(role.id),
      ];
    } else if (role.id === "role_jda") {
      // Illustrative: only "21 assigned" and "avg latest 63" are in the fixtures; the rest fills the layout.
      latest = { ready: 1, nearly: 4, developing: 6, not_ready: 3 };
      baseline = { ready: 0, nearly: 1, developing: 6, not_ready: 7 };
      stats = { invited: view.candidatesAssigned, active: 17, completedSession: 14, avgBaseline: 49, avgLatest: 63, change: 14 };
      dims = { content: 70, structure: 61, delivery: 62, relevance: 72 };
      illustrative = ["Everything except invited and average latest"];
      attention = attentionFromStore(role.id);
    } else {
      hasData = false;
      stats = { invited: view.candidatesAssigned, active: 0, completedSession: 0, avgBaseline: null, avgLatest: null, change: null };
    }

    const weakest = dims ? weakestDimension(dims) : null;
    return {
      ...base,
      hasData,
      stats,
      bandsLatest: latest,
      bandsBaseline: baseline,
      hardestQuestions: hardest.sort((a, b) => a.avgFirst - b.avgFirst),
      dimensionAverages: dims,
      weakest,
      weakestNote: weakest ? `${weakest.label} is the weakest area. ${SUGGESTION[weakest.id]}` : null,
      needsAttention: attention,
      illustrative,
    };
  });
}

/** CSV of the current role and range: summary, bands, dimensions and hardest questions. */
export function exportReportCsv(query: ReportQuery): Promise<CsvExport> {
  return getReport(query).then((r) => {
    const num = (n: number | null) => (n === null ? "" : n);
    const csv = toCsv([
      ["Report", r.roleTitle],
      ["Range", r.range.label],
      [],
      ["Metric", "Value"],
      ["Invited", r.stats.invited],
      ["Active", r.stats.active],
      ["Completed a session", r.stats.completedSession],
      ["Average baseline", num(r.stats.avgBaseline)],
      ["Average latest", num(r.stats.avgLatest)],
      ["Change", num(r.stats.change)],
      [],
      ["Band", "Baseline", "Latest", "Change"],
      ...BAND_ORDER.map((b) => [BAND_LABEL[toBand(b)], r.bandsBaseline[b], r.bandsLatest[b], r.bandsLatest[b] - r.bandsBaseline[b]]),
      [],
      ["Dimension", "Average"],
      ...(r.dimensionAverages ? DIMENSION_IDS.map((d) => [DIMENSION_LABEL[d], r.dimensionAverages![d]]) : []),
      [],
      ["Hardest question", "Times asked", "Avg first try", "Avg second try", "Learning"],
      ...r.hardestQuestions.map((h) => [h.question, h.timesAsked, h.avgFirst, h.avgSecond, num(h.avgLearning)]),
    ]);
    const slug = r.roleTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return { filename: `report-${slug}-${r.range.to}.csv`, csv };
  });
}
