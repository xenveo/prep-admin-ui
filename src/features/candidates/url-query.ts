import type { UrlState, UrlStateUpdates } from "@/lib/use-url-state";
import { toBand, type Band } from "@/lib/bands";
import type { CandidateQuery, CandidateSortColumn, CandidateStatus, SavedFilter } from "@/lib/types";

export const DEFAULT_SORT = { columnId: "lastActive" as CandidateSortColumn, direction: "desc" as const };

const SORT_COLUMNS: CandidateSortColumn[] = ["name", "status", "sessions", "score", "change", "lastActive"];
const STATUSES: CandidateStatus[] = ["invite_pending", "active", "deactivated", "revoked"];

export const SORT_LABEL: Record<CandidateSortColumn, string> = {
  name: "name",
  status: "status",
  sessions: "sessions",
  score: "latest score",
  change: "change since baseline",
  lastActive: "last active",
};

export const LAST_ACTIVE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
];

export type UrlFilters = {
  search: string;
  roles: string[];
  bands: string[];
  statuses: string[];
  active: string[];
  saved: string | null;
};

export function readFilters(url: UrlState): UrlFilters {
  const active = url.get("active");
  return {
    search: url.get("q") ?? "",
    roles: url.getAll("role"),
    bands: url.getAll("band"),
    statuses: url.getAll("status"),
    active: active ? [active] : [],
    saved: url.get("saved"),
  };
}

export function readSort(url: UrlState): { columnId: CandidateSortColumn; direction: "asc" | "desc" } {
  const col = url.get("sort") as CandidateSortColumn | null;
  const dir = url.get("dir");
  if (col && SORT_COLUMNS.includes(col)) return { columnId: col, direction: dir === "asc" ? "asc" : "desc" };
  return DEFAULT_SORT;
}

export function hasFilters(f: UrlFilters): boolean {
  return Boolean(f.search.trim() || f.roles.length || f.bands.length || f.statuses.length || f.active.length || f.saved);
}

/** The query sent to the service. A saved filter adds criteria the filter bar can't express. */
export function buildQuery(
  f: UrlFilters,
  sort: ReturnType<typeof readSort>,
  savedFilters: SavedFilter[] | undefined,
): CandidateQuery {
  const q: CandidateQuery = { sort };
  if (f.search.trim()) q.search = f.search.trim();
  if (f.roles.length) q.roleIds = f.roles;
  if (f.bands.length) q.bands = f.bands.map((b) => toBand(b) as Band);
  const statuses = f.statuses.filter((s): s is CandidateStatus => STATUSES.includes(s as CandidateStatus));
  if (statuses.length) q.statuses = statuses;
  if (f.active.length) q.lastActiveWithinDays = Number(f.active[0]);
  const saved = f.saved ? savedFilters?.find((s) => s.id === f.saved) : undefined;
  if (saved?.query.noChangeInSessions !== undefined) q.noChangeInSessions = saved.query.noChangeInSessions;
  return q;
}

/** URL updates that apply a saved filter's definition (replacing the current filters). */
export function savedFilterUpdates(id: string, query: CandidateQuery): UrlStateUpdates {
  return {
    q: query.search ?? null,
    role: query.roleIds ?? null,
    band: query.bands ?? null,
    status: query.statuses ?? null,
    active: query.lastActiveWithinDays !== undefined ? String(query.lastActiveWithinDays) : null,
    saved: id === "all" ? null : id,
  };
}

export const CLEAR_FILTER_UPDATES: UrlStateUpdates = {
  q: null,
  role: null,
  band: null,
  status: null,
  active: null,
  saved: null,
};
