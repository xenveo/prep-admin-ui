/** Workspace settings, admins and audit log (A10). */
import { formatDateTime, formatShortDate, daysSince } from "@/lib/format";
import {
  TRANSCRIPT_RETENTION_LABEL,
  type Admin,
  type AdminAccess,
  type AuditEvent,
  type AuditFilters,
  type WorkspaceSettings,
} from "@/lib/types";
import { isValidEmail } from "@/lib/csv";
import { respond } from "@/services/latency";
import { addAudit, currentAdmin, getStore, nextId, stamp } from "@/services/store";

export function getWorkspaceSettings(): Promise<WorkspaceSettings> {
  return respond(() => getStore().settings);
}

const SETTING_AUDIT: { key: keyof WorkspaceSettings; action: string; show: (v: never) => string }[] = [
  { key: "voice", action: "Changed interviewer voice", show: (v: string) => v },
  { key: "feedbackLength", action: "Changed feedback length", show: (v: string) => v },
  { key: "audioRetentionDays", action: "Changed audio retention", show: (v: number) => `${v} days` },
  { key: "transcriptRetention", action: "Changed transcript retention", show: (v: keyof typeof TRANSCRIPT_RETENTION_LABEL) => TRANSCRIPT_RETENTION_LABEL[v] },
  { key: "candidatesCanDeleteData", action: "Changed candidate data deletion", show: (v: boolean) => (v ? "On" : "Off") },
  { key: "senderName", action: "Changed sender name", show: (v: string) => v },
  { key: "replyTo", action: "Changed reply-to address", show: (v: string) => v },
] as never;

/** Merge a patch into the settings and log one audit event per changed field ("90 days → 30 days"). */
export function saveWorkspaceSettings(patch: Partial<WorkspaceSettings>): Promise<WorkspaceSettings> {
  return respond(() => {
    const s = getStore();
    if (patch.replyTo !== undefined && patch.replyTo.trim() !== "" && !/^\[.*\]$/.test(patch.replyTo) && !isValidEmail(patch.replyTo)) {
      throw new Error("Enter a valid reply-to address");
    }
    for (const def of SETTING_AUDIT) {
      const next = patch[def.key];
      if (next === undefined || next === s.settings[def.key]) continue;
      const show = def.show as (v: unknown) => string;
      addAudit(def.action, `${show(s.settings[def.key])} → ${show(next)}`);
    }
    s.settings = { ...s.settings, ...patch, language: "en" };
    return s.settings;
  });
}

/** "Export all data": records the export time. The file itself is not generated in the mock. */
export function exportAllData(): Promise<{ lastExportAt: string }> {
  return respond(() => {
    const s = getStore();
    s.settings.lastExportAt = stamp();
    addAudit("Exported all data", "Workspace");
    return { lastExportAt: s.settings.lastExportAt };
  });
}

export function getCurrentAdmin(): Promise<Admin> {
  return respond(() => currentAdmin());
}

export function listAdmins(): Promise<Admin[]> {
  return respond(() => getStore().admins);
}

export function inviteAdmin(input: { email: string; access: AdminAccess }): Promise<Admin> {
  return respond(() => {
    const s = getStore();
    const email = input.email.trim();
    if (!isValidEmail(email)) throw new Error("Enter a valid email");
    if (s.admins.some((a) => a.email.toLowerCase() === email.toLowerCase())) throw new Error("Already an admin or invited");
    const admin: Admin = { id: nextId("adm"), name: null, email, access: input.access, status: "invite_pending", lastActiveAt: null, invitedAt: stamp() };
    s.admins.push(admin);
    addAudit("Invited an admin", email, admin.id);
    return admin;
  });
}

export function resendAdminInvite(id: string): Promise<void> {
  return respond(() => {
    const a = getStore().admins.find((x) => x.id === id);
    if (!a || a.status !== "invite_pending") throw new Error("Only a pending invite can be resent");
    a.invitedAt = stamp();
    addAudit("Resent an admin invite", a.email, a.id);
  });
}

function superAdminCount(): number {
  return getStore().admins.filter((a) => a.access === "super_admin" && a.status === "active").length;
}

export function changeAdminAccess(id: string, access: AdminAccess): Promise<Admin> {
  return respond(() => {
    const a = getStore().admins.find((x) => x.id === id);
    if (!a) throw new Error(`Admin not found: ${id}`);
    if (a.access === "super_admin" && access === "admin" && superAdminCount() <= 1) {
      throw new Error("There must be at least one Super admin");
    }
    const label = (v: AdminAccess) => (v === "super_admin" ? "Super admin" : "Admin");
    addAudit("Changed admin access", `${a.name ?? a.email}: ${label(a.access)} → ${label(access)}`, a.id);
    a.access = access;
    return a;
  });
}

export function removeAdmin(id: string): Promise<void> {
  return respond(() => {
    const s = getStore();
    const a = s.admins.find((x) => x.id === id);
    if (!a) throw new Error(`Admin not found: ${id}`);
    if (a.id === s.currentAdminId) throw new Error("You can't remove yourself");
    if (a.access === "super_admin" && a.status === "active" && superAdminCount() <= 1) {
      throw new Error("There must be at least one Super admin");
    }
    s.admins = s.admins.filter((x) => x.id !== id);
    addAudit("Removed an admin", a.name ?? a.email, a.id);
  });
}

/** Audit events, newest first. `to` is inclusive of the whole day. */
export function listAuditEvents(filters: AuditFilters = {}): Promise<AuditEvent[]> {
  return respond(() =>
    getStore()
      .audit.filter((e) => {
        if (filters.actorId && e.actorId !== filters.actorId) return false;
        if (filters.action && e.action !== filters.action) return false;
        if (filters.from && e.at.slice(0, 10) < filters.from) return false;
        if (filters.to && e.at.slice(0, 10) > filters.to) return false;
        return true;
      })
      .sort((a, b) => b.at.localeCompare(a.at)),
  );
}

/** Distinct actions, for the audit "Action" filter. */
export function listAuditActions(): Promise<string[]> {
  return respond(() => Array.from(new Set(getStore().audit.map((e) => e.action))).sort());
}

/** Label for an audit time: "15 Oct, 11:32" for timed events, "12 Oct" otherwise. */
export function auditWhenLabel(e: AuditEvent): string {
  return /T\d\d:\d\d/.test(e.at) ? formatDateTime(e.at).replace(/ \d{4},/, ",") : formatShortDate(e.at);
}

/** Days since an event (0 = today). */
export function auditAgeDays(e: AuditEvent): number {
  return daysSince(e.at) ?? 0;
}
