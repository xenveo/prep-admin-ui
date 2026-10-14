/** Candidate services (A1, A2, A3). All async with ~120ms simulated latency. */
import { bandForScore, scoreChange, BAND_LABEL } from "@/lib/bands";
import { isValidEmail, summariseInviteRows, toCsv, validateInviteInput } from "@/lib/csv";
import { inviteSentLabel, relativeTime, daysSince } from "@/lib/format";
import { TODAY } from "@/lib/types";
import type {
  CandidateDetail,
  CandidateList,
  CandidateQuery,
  CandidateRow,
  CsvExport,
  InviteBatchInput,
  InviteBatchResult,
  InviteRow,
  InviteRowInput,
  InviteSummary,
  RoleAssignment,
  SavedFilter,
} from "@/lib/types";
import { fixtures } from "@/services/fixtures";
import { respond } from "@/services/latency";
import {
  addAudit,
  adminName,
  currentAdmin,
  findCandidate,
  findRole,
  getStore,
  logActivity,
  nextId,
  stamp,
  touchRole,
  type StoredCandidate,
} from "@/services/store";

function sessionsOf(candidateId: string) {
  return getStore().sessions.filter((s) => s.candidateId === candidateId);
}

function latestOf(candidateId: string) {
  return sessionsOf(candidateId).sort((a, b) => b.number - a.number || b.date.localeCompare(a.date))[0];
}

function toRow(c: StoredCandidate): CandidateRow {
  const s = getStore();
  const sessions = sessionsOf(c.id);
  const latest = latestOf(c.id);
  const baseline = [...sessions].sort((a, b) => a.number - b.number)[0];
  const pending = c.status === "invite_pending";
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    status: c.status,
    roles: c.assignments.map((a) => {
      const r = s.roles.find((x) => x.id === a.roleId);
      return { id: a.roleId, title: r?.title ?? a.roleId, status: r?.status ?? "draft" };
    }),
    sessions: sessions.length,
    latestScore: latest?.score ?? null,
    band: latest ? latest.band : null,
    change: scoreChange(latest?.score ?? null, baseline?.score ?? null, sessions.length),
    lastActiveAt: c.lastActiveAt,
    lastActiveLabel: c.lastActiveAt ? relativeTime(c.lastActiveAt) : "Not yet",
    lastActiveNote: pending ? inviteSentLabel(c.invitedAt) : undefined,
  };
}

function matches(row: CandidateRow, q: CandidateQuery): boolean {
  if (q.search) {
    const needle = q.search.trim().toLowerCase();
    if (needle && !row.name.toLowerCase().includes(needle) && !row.email.toLowerCase().includes(needle)) return false;
  }
  if (q.roleIds?.length && !row.roles.some((r) => q.roleIds!.includes(r.id))) return false;
  if (q.bands?.length && (row.band === null || !q.bands.includes(row.band))) return false;
  if (q.statuses?.length && !q.statuses.includes(row.status)) return false;
  if (q.lastActiveWithinDays !== undefined) {
    const d = row.lastActiveAt ? daysSince(row.lastActiveAt) : null;
    if (d === null || d > q.lastActiveWithinDays) return false;
  }
  if (q.noChangeInSessions !== undefined) {
    if (row.sessions < q.noChangeInSessions || row.change === null || row.change > 0) return false;
  }
  return true;
}

function sortValue(row: CandidateRow, col: NonNullable<CandidateQuery["sort"]>["columnId"]): string | number | null {
  switch (col) {
    case "name":
      return row.name.toLowerCase();
    case "status":
      return row.status;
    case "sessions":
      return row.sessions;
    case "score":
      return row.latestScore;
    case "change":
      return row.change;
    case "lastActive":
      return row.lastActiveAt ? row.lastActiveAt.replace("T", " ") : null;
  }
}

/** List candidates. Default sort: last active, newest first; missing values sort last in both directions. */
export function listCandidates(query: CandidateQuery = {}): Promise<CandidateList> {
  return respond(() => {
    const all = getStore().candidates.map(toRow);
    const sort = query.sort ?? { columnId: "lastActive" as const, direction: "desc" as const };
    const dir = sort.direction === "asc" ? 1 : -1;
    const rows = all.filter((r) => matches(r, query)).sort((a, b) => {
      const av = sortValue(a, sort.columnId);
      const bv = sortValue(b, sort.columnId);
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
    });
    return { rows, total: rows.length, totalUnfiltered: all.length };
  });
}

/** Full detail for the A3 panel. Rejects when the id is unknown. */
export function getCandidate(id: string): Promise<CandidateDetail> {
  return respond(() => {
    const s = getStore();
    const c = findCandidate(id);
    const sessions = sessionsOf(id).sort((a, b) => b.number - a.number);
    const assignments: RoleAssignment[] = c.assignments.map((a) => {
      const role = s.roles.find((r) => r.id === a.roleId)!;
      const mine = sessions.filter((x) => x.roleId === a.roleId);
      const latest = mine[0];
      const baseline = mine[mine.length - 1];
      return {
        roleId: a.roleId,
        roleTitle: role.title,
        roleStatus: role.status,
        assignedAt: a.assignedAt,
        maxSessions: a.maxSessions,
        sessionsUsed: mine.length,
        baselineScore: baseline?.score ?? null,
        latestScore: latest?.score ?? null,
        latestBand: latest ? latest.band : null,
        changeSinceBaseline: scoreChange(latest?.score ?? null, baseline?.score ?? null, mine.length),
      };
    });
    const chrono = [...sessions].reverse();
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      status: c.status,
      invitedAt: c.invitedAt,
      invitedBy: c.invitedBy,
      invitedByName: adminName(c.invitedBy) ?? "an admin",
      firstLoginAt: c.firstLoginAt,
      lastActiveAt: c.lastActiveAt,
      accessUntil: c.accessUntil,
      assignments,
      sessions,
      activity: [...c.activity].sort((a, b) => b.at.localeCompare(a.at)),
      progress: chrono.map((x, i) => ({ label: `Session ${i + 1}`, date: x.date, score: x.score })),
      changeSinceFirst: scoreChange(chrono[chrono.length - 1]?.score ?? null, chrono[0]?.score ?? null, chrono.length),
      source: c.source,
    };
  });
}

/** Validate manual or parsed rows against the live store (roles, existing emails). */
export function validateInviteRows(rows: InviteRowInput[]): Promise<{ rows: InviteRow[]; summary: InviteSummary }> {
  return respond(() => {
    const s = getStore();
    const result = validateInviteInput(rows, {
      approvedRoleNames: s.roles.filter((r) => r.status === "approved").map((r) => r.title),
      draftRoleNames: s.roles.filter((r) => r.status === "draft").map((r) => r.title),
      existingEmails: s.candidates.map((c) => c.email),
    });
    return { rows: result, summary: summariseInviteRows(result) };
  });
}

/** Approved and draft role names plus emails in use, for client-side parseInviteCsv. */
export function getInviteContext(): Promise<{ approvedRoleNames: string[]; draftRoleNames: string[]; existingEmails: string[] }> {
  return respond(() => {
    const s = getStore();
    return {
      approvedRoleNames: s.roles.filter((r) => r.status === "approved").map((r) => r.title),
      draftRoleNames: s.roles.filter((r) => r.status === "draft").map((r) => r.title),
      existingEmails: s.candidates.map((c) => c.email),
    };
  });
}

/**
 * Create invite-pending candidates. Rows with an invalid or already-used email, or with an
 * unapproved role, are skipped. Role assignment applies to approved roles only.
 */
export function inviteCandidates(batch: InviteBatchInput): Promise<InviteBatchResult> {
  return respond(() => {
    const s = getStore();
    const used = new Set(s.candidates.map((c) => c.email.toLowerCase()));
    const ids: string[] = [];
    let skipped = 0;
    for (const row of batch.rows) {
      const email = row.email.trim();
      const key = email.toLowerCase();
      const roles = row.roleIds.map((id) => s.roles.find((r) => r.id === id));
      const ok = isValidEmail(email) && !used.has(key) && roles.length > 0 && roles.every((r) => r?.status === "approved");
      if (!ok) {
        skipped++;
        continue;
      }
      used.add(key);
      const me = currentAdmin();
      const id = nextId("cand");
      s.candidates.push({
        id,
        name: row.name.trim() || email,
        email,
        status: "invite_pending",
        invitedAt: TODAY,
        invitedBy: me.id,
        lastActiveAt: null,
        accessUntil: batch.accessUntil ?? null,
        assignments: row.roleIds.map((roleId) => ({ roleId, assignedAt: TODAY, maxSessions: batch.maxSessions ?? findRole(roleId).settings.maxSessionsPerCandidate })),
        activity: [{ text: `Invited by ${me.name}`, at: stamp() }],
      });
      ids.push(id);
    }
    const batchId = nextId("inv");
    s.invites.push({ id: batchId, createdBy: currentAdmin().id, createdAt: stamp(), source: batch.source, fileName: batch.fileName, sent: ids.length, skipped });
    const label = ids.length === 1 ? "1 invite" : `${ids.length} invites`;
    addAudit(`Sent ${label}`, batch.fileName ?? (batch.rows[0]?.email ?? "Invite"), batchId);
    return { batchId, sent: ids.length, skipped, candidateIds: ids };
  });
}

/** Resend invites; only invite-pending candidates are affected. */
export function resendInvite(ids: string[]): Promise<{ resent: number; skipped: number }> {
  return respond(() => {
    let resent = 0;
    for (const id of ids) {
      const c = getStore().candidates.find((x) => x.id === id);
      if (!c || c.status !== "invite_pending") continue;
      c.invitedAt = TODAY;
      logActivity(c, "Invite resent");
      resent++;
    }
    if (resent > 0) addAudit(resent === 1 ? "Resent an invite" : `Resent ${resent} invites`, `${resent} candidate${resent === 1 ? "" : "s"}`);
    return { resent, skipped: ids.length - resent };
  });
}

/** Withdraw an invite before first login (invite_pending -> revoked). History is kept. */
export function revokeInvite(id: string): Promise<void> {
  return respond(() => {
    const c = findCandidate(id);
    if (c.status !== "invite_pending") throw new Error("Only a pending invite can be revoked");
    c.status = "revoked";
    logActivity(c, "Invite revoked");
    addAudit("Revoked an invite", c.name, c.id);
  });
}

/** Turn accounts off (active -> deactivated). Others are skipped. */
export function deactivateCandidates(ids: string[]): Promise<{ deactivated: number; skipped: number }> {
  return respond(() => {
    let n = 0;
    for (const id of ids) {
      const c = getStore().candidates.find((x) => x.id === id);
      if (!c || c.status !== "active") continue;
      c.status = "deactivated";
      logActivity(c, "Deactivated");
      n++;
    }
    if (n > 0) addAudit(n === 1 ? "Deactivated a candidate" : `Deactivated ${n} candidates`, `${n} candidate${n === 1 ? "" : "s"}`);
    return { deactivated: n, skipped: ids.length - n };
  });
}

/** Turn a deactivated account back on. */
export function reactivateCandidates(ids: string[]): Promise<{ reactivated: number }> {
  return respond(() => {
    let n = 0;
    for (const id of ids) {
      const c = getStore().candidates.find((x) => x.id === id);
      if (!c || c.status !== "deactivated") continue;
      c.status = "active";
      logActivity(c, "Reactivated");
      n++;
    }
    return { reactivated: n };
  });
}

/** Add roles to candidates. Archived roles can't be assigned; existing assignments are kept. */
export function assignRoles(ids: string[], roleIds: string[]): Promise<{ added: number }> {
  return respond(() => {
    let added = 0;
    for (const id of ids) {
      const c = findCandidate(id);
      for (const roleId of roleIds) {
        const role = findRole(roleId);
        if (role.status === "archived") throw new Error(`${role.title} is archived`);
        if (c.assignments.some((a) => a.roleId === roleId)) continue;
        c.assignments.push({ roleId, assignedAt: TODAY, maxSessions: role.settings.maxSessionsPerCandidate });
        logActivity(c, `Assigned ${role.title}`);
        touchRole(role);
        added++;
      }
    }
    if (added > 0) addAudit("Assigned roles", `${ids.length} candidate${ids.length === 1 ? "" : "s"}`);
    return { added };
  });
}

/** Remove a role assignment. Past sessions stay in the store (and in reports). */
export function removeRole(candidateId: string, roleId: string): Promise<void> {
  return respond(() => {
    const c = findCandidate(candidateId);
    const role = findRole(roleId);
    c.assignments = c.assignments.filter((a) => a.roleId !== roleId);
    logActivity(c, `Removed ${role.title}`);
    addAudit("Removed a role", `${c.name} · ${role.title}`, c.id);
  });
}

/** CSV of the given candidates (or all when `ids` is empty). */
export function exportCandidatesCsv(ids: string[]): Promise<CsvExport> {
  return respond(() => {
    const rows = getStore().candidates.filter((c) => ids.length === 0 || ids.includes(c.id)).map(toRow);
    const csv = toCsv([
      ["Name", "Email", "Status", "Roles", "Sessions", "Latest score", "Band", "Change since baseline", "Last active"],
      ...rows.map((r) => [
        r.name,
        r.email,
        r.status.replace("_", " "),
        r.roles.map((x) => x.title).join("; "),
        r.sessions,
        r.latestScore,
        r.latestScore === null ? "" : BAND_LABEL[bandForScore(r.latestScore)],
        r.change,
        r.lastActiveAt ? r.lastActiveAt.slice(0, 16).replace("T", " ") : "",
      ]),
    ]);
    return { filename: "candidates.csv", csv };
  });
}

export function listSavedFilters(): Promise<SavedFilter[]> {
  return respond(() => getStore().savedFilters);
}

/** Add a saved filter ("+ Save current filters"). */
export function saveFilter(label: string, query: CandidateQuery): Promise<SavedFilter> {
  return respond(() => {
    const f: SavedFilter = { id: nextId("filter"), label: label.trim() || "Saved filter", query };
    getStore().savedFilters.push(f);
    return f;
  });
}

const FIRST = ["Aarav", "Isha", "Kabir", "Diya", "Rohan", "Tara", "Arjun", "Naina", "Samar", "Zoya", "Dev", "Anika", "Yash", "Pooja", "Nikhil", "Riya", "Varun", "Kiara", "Manav", "Sneha", "Ishaan", "Ritu", "Harsh", "Lavanya", "Tanvi", "Karthik", "Alisha", "Pranav", "Mitali", "Gaurav", "Simran", "Aditi", "Rajat", "Bhavna", "Tushar", "Esha", "Mohit"];
const LAST = ["Menon", "Bose", "Patel", "Reddy", "Kulkarni", "Shah", "Pillai", "Desai", "Bhatt", "Chopra", "Nair", "Sinha", "Mehra", "Kohli", "Rao", "Ghosh", "Jain", "Saxena", "Bajaj", "Iyer"];

/**
 * Illustrative 45-row CSV matching the A2 example: rows 3, 17 and 29 need fixing, the other 42 are ready.
 * Names beyond the five in the fixtures are generated filler.
 */
export function sampleInviteCsv(): { fileName: string; text: string } {
  const fx = fixtures.inviteCsvExample;
  const bad = new Map(fx.issues.map((i) => [i.row, i]));
  const known = new Map(fx.readySample.map((r) => [r.row, r]));
  const lines = ["email,name,roles"];
  let filler = 0;
  for (let row = 1; row <= fx.rows; row++) {
    const r = bad.get(row) ?? known.get(row);
    if (r) {
      lines.push(`${r.email},${r.name},${r.roles.join(";")}`);
      continue;
    }
    const first = FIRST[filler % FIRST.length];
    const last = LAST[(filler * 7) % LAST.length];
    filler++;
    const role = row % 3 === 0 ? "Junior Data Analyst" : "Customer Support Associate";
    lines.push(`${first.toLowerCase()}.${last.toLowerCase()}${row}@example.com,${first} ${last},${role}`);
  }
  return { fileName: fx.fileName, text: lines.join("\n") + "\n" };
}
