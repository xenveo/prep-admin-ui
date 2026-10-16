import type { UrlState, UrlStateUpdates } from "@/lib/use-url-state";
import { parseBand, type Band } from "@/lib/bands";
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
  /** Canonical band ids only; see readBands. */
  bands: Band[];
  statuses: string[];
  active: string[];
  saved: string | null;
};

/** Canonical band ids; unknown values (e.g. `?band=bogus`) are dropped, aliases are normalised. */
function readBands(values: readonly string[]): Band[] {
  const bands: Band[] = [];
  for (const v of values) {
    const band = parseBand(v);
    if (band !== null && !bands.includes(band)) bands.push(band);
  }
  return bands;
}

export function readFilters(url: UrlState): UrlFilters {
  const active = url.get("active");
  return {
    search: url.get("q") ?? "",
    roles: url.getAll("role"),
    bands: readBands(url.getAll("band")),
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
  if (f.bands.length) q.bands = f.bands;
  const statuses = f.statuses.filter((s): s is CandidateStatus => STATUSES.includes(s as CandidateStatus));
  if (statuses.length) q.statuses = statuses;
  if (f.active.length) q.lastActiveWithinDays = Number(f.active[0]);
  const saved = f.saved ? savedFilters?.find((s) => s.id === f.saved) : undefined;
  if (saved?.query.noChangeInSessions !== undefined) q.noChangeInSessions = saved.query.noChangeInSessions;
  return q;
}

export const CLEAR_FILTER_UPDATES: UrlStateUpdates = {
  q: null,
  role: null,
  band: null,
  status: null,
  active: null,
  saved: null,
};

/** True when a saved filter has criteria the filter bar (and so the URL) can't express. */
function needsSavedParam(query: CandidateQuery): boolean {
  return query.noChangeInSessions !== undefined;
}

/** The `saved` URL param for a filter: only kept when the URL alone can't reproduce it. */
export function savedParam(filter: SavedFilter): string | null {
  return !filter.isDefault && needsSavedParam(filter.query) ? filter.id : null;
}

/** URL updates that apply a saved filter's definition (replacing the current filters). */
export function savedFilterUpdates(filter: SavedFilter): UrlStateUpdates {
  if (filter.isDefault) return CLEAR_FILTER_UPDATES;
  const { query } = filter;
  return {
    q: query.search?.trim() || null,
    role: query.roleIds ?? null,
    band: query.bands ?? null,
    status: query.statuses ?? null,
    active: query.lastActiveWithinDays !== undefined ? String(query.lastActiveWithinDays) : null,
    saved: savedParam(filter),
  };
}

type FilterKey = { search: string; roles: string[]; bands: string[]; statuses: string[]; active: number | null };

function sortedUnique(values: readonly string[] | undefined): string[] {
  return [...new Set(values ?? [])].sort();
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function sameKey(a: FilterKey, b: FilterKey): boolean {
  return (
    a.search === b.search &&
    a.active === b.active &&
    sameList(a.roles, b.roles) &&
    sameList(a.bands, b.bands) &&
    sameList(a.statuses, b.statuses)
  );
}

/** The filter-bar criteria in comparable form: trimmed search, order-insensitive lists. Sort is ignored. */
function urlFilterKey(f: UrlFilters): FilterKey {
  return {
    search: f.search.trim(),
    roles: sortedUnique(f.roles),
    bands: sortedUnique(f.bands),
    statuses: sortedUnique(f.statuses.filter((s) => STATUSES.includes(s as CandidateStatus))),
    // A non-numeric value becomes NaN, which never matches a saved filter.
    active: f.active.length ? Number(f.active[0]) : null,
  };
}

function queryFilterKey(q: CandidateQuery): FilterKey {
  return {
    search: q.search?.trim() ?? "",
    roles: sortedUnique(q.roleIds),
    bands: sortedUnique(readBands(q.bands ?? [])),
    statuses: sortedUnique(q.statuses),
    active: q.lastActiveWithinDays ?? null,
  };
}

/** The first non-default, URL-expressible saved filter with exactly these filter-bar criteria. */
function findByKey(savedFilters: SavedFilter[] | undefined, key: FilterKey): SavedFilter | undefined {
  return savedFilters?.find((s) => !s.isDefault && !needsSavedParam(s.query) && sameKey(queryFilterKey(s.query), key));
}

/**
 * The saved filter the current URL represents, or null. `?saved=<id>` wins when that filter exists;
 * otherwise the default filter when nothing is set, else the first URL-expressible filter whose
 * criteria equal the filter bar's.
 */
export function activeSavedFilter(f: UrlFilters, savedFilters: SavedFilter[] | undefined): SavedFilter | null {
  if (!savedFilters) return null;
  const named = f.saved ? savedFilters.find((s) => s.id === f.saved) : undefined;
  if (named) return named;
  if (!hasFilters({ ...f, saved: null })) return savedFilters.find((s) => s.isDefault) ?? null;
  return findByKey(savedFilters, urlFilterKey(f)) ?? null;
}

/** The first saved filter whose criteria are exactly `query`'s filter-bar criteria (sort ignored). */
export function findSavedFilterByQuery(
  savedFilters: SavedFilter[] | undefined,
  query: CandidateQuery,
): SavedFilter | undefined {
  return findByKey(savedFilters, queryFilterKey(query));
}
