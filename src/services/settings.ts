/** Workspace settings, admins and audit log (A10); G4 operational controls. */
import { formatDateTime, formatShortDate, daysSince } from "@/lib/format";
import type { Admin, AdminAccess, AuditEvent, AuditFilters, WorkspaceSettings } from "@/lib/types";
import { download, queryString, request, resolveApiUrl } from "@/lib/api/client";

export type CursorPage<T> = { rows: T[]; total: number; nextCursor: string | null };
export type WorkspaceExport = {
  status: "queued" | "running" | "done" | "failed" | "expired";
  files: { name: string; url: string }[];
};
export type PrivacyRequest = {
  id: string; userId: string; name: string | null; email: string;
  kind: string; status: string; createdAt: string; completedAt: string | null; completedBy: string | null;
};
export type PromptRole = "interviewer" | "evaluator" | "evaluator_detail" | "summariser" | "drafter";
/** null means the model's default thinking level. */
export type ThinkingLevel = "low" | "medium" | "high";
export type PromptRoleConfig = {
  role: PromptRole;
  active: { version: number; model: string; temperature: number; thinkingLevel: ThinkingLevel | null; template: string };
  versions: { version: number; model: string; temperature: number; thinkingLevel: ThinkingLevel | null; active: boolean; createdBy: string | null; createdAt: string }[];
};
export type AiConfig = { roles: PromptRoleConfig[] };
export type AiUsageKind = "llm" | "stt" | "tts";
export type AiUsage = {
  range: { from: string; to: string };
  budgetUsd: number;
  totals: {
    calls: number; costUsd: number; unpricedCalls: number; failedCalls: number;
    byKind: { kind: AiUsageKind; calls: number; costUsd: number }[];
    byModel: { model: string | null; calls: number; costUsd: number }[];
  };
  /** Covers sessions with at least one priced call; sessions with only unpriced calls are counted in unpricedSessions. */
  perSession: { completedSessions: number; avgCostUsd: number | null; p90CostUsd: number | null; overBudget: number; unpricedSessions: number };
  daily: { date: string; calls: number; costUsd: number }[];
};
export type AiUsageQuery = { from: string; to: string; roleId?: string };

export const getWorkspaceSettings = (): Promise<WorkspaceSettings> => request("/admin/settings");
export function saveWorkspaceSettings(patch: Partial<WorkspaceSettings>): Promise<WorkspaceSettings> {
  const editable = ["voice", "feedbackLength", "audioRetentionDays", "transcriptRetention", "candidatesCanDeleteData", "senderName", "replyTo", "inviteLinkExpiryDays", "sessionCompleteEmail"] as const;
  const body = Object.fromEntries(editable.filter((key) => patch[key] !== undefined).map((key) => [key, patch[key]]));
  return request("/admin/settings", { method: "PATCH", body: JSON.stringify(body) });
}
export const exportAllData = (): Promise<{ exportId: string; lastExportAt: string }> => request("/admin/exports", { method: "POST" });
export const getWorkspaceExport = (id: string, signal?: AbortSignal): Promise<WorkspaceExport> => request(`/admin/exports/${encodeURIComponent(id)}`, { signal });
export async function downloadExportFile(file: { name: string; url: string }): Promise<void> {
  const source = new URL(resolveApiUrl(file.url));
  const apiOrigin = new URL(resolveApiUrl("/admin/exports")).origin;
  let blob: Blob;
  if (source.origin === apiOrigin) {
    // Local/API-hosted exports retain the application's credentialed transport and errors.
    blob = await download(source.href);
  } else {
    // S3/MinIO URLs are already signed. Cookies are unnecessary and break common bucket CORS rules.
    let response: Response;
    try {
      response = await fetch(source.href, { credentials: "omit", referrerPolicy: "no-referrer" });
    } catch {
      // A storage bucket may allow navigation while disallowing browser fetch (no CORS policy).
      // Cross-origin download filenames are advisory; the browser may display the CSV instead.
      const link = document.createElement("a");
      link.href = source.href;
      link.download = file.name;
      link.referrerPolicy = "no-referrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }
    if (!response.ok) throw new Error(`Couldn’t download ${file.name} (HTTP ${response.status}). Refresh the export and try again.`);
    blob = await response.blob();
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const voiceSampleUrl = (voice: string): string => resolveApiUrl(`/admin/settings/voices/${encodeURIComponent(voice)}/sample`);
export const getCurrentAdmin = (): Promise<Admin> => request("/admin/me");
export const listAdmins = (): Promise<Admin[]> => request("/admin/admins");
export const inviteAdmin = (input: { email: string; access: AdminAccess }): Promise<Admin> => request("/admin/admins", { method: "POST", body: JSON.stringify({ ...input, email: input.email.trim() }) });
export const resendAdminInvite = (id: string): Promise<void> => request(`/admin/admins/${encodeURIComponent(id)}/resend`, { method: "POST" });
export const changeAdminAccess = (id: string, access: AdminAccess): Promise<Admin> => request(`/admin/admins/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ access }) });
export const removeAdmin = (id: string): Promise<void> => request(`/admin/admins/${encodeURIComponent(id)}`, { method: "DELETE" });
export const listAuditPage = (filters: AuditFilters = {}, cursor?: string): Promise<CursorPage<AuditEvent>> => request(`/admin/audit${queryString({ ...filters, cursor, limit: 50 })}`);
/** Compatibility operation: follows every cursor so callers never silently lose later rows. */
export async function listAuditEvents(filters: AuditFilters = {}): Promise<AuditEvent[]> {
  const rows: AuditEvent[] = [];
  let cursor: string | undefined;
  do {
    const page = await listAuditPage(filters, cursor);
    rows.push(...page.rows);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return rows;
}
export const listAuditActions = (): Promise<string[]> => request("/admin/audit/actions");
export const listPrivacyRequests = (cursor?: string): Promise<CursorPage<PrivacyRequest>> => request(`/admin/privacy/requests${queryString({ cursor, limit: 50 })}`);
export const completePrivacyRequest = (id: string): Promise<PrivacyRequest> => request(`/admin/privacy/requests/${encodeURIComponent(id)}/complete`, { method: "POST" });
export const getAiConfig = (): Promise<AiConfig> => request("/admin/ai-config");
/** Super admins only; others get the generic 404. */
export const getAiUsage = (q: AiUsageQuery): Promise<AiUsage> => request(`/admin/ai-usage${queryString(q)}`);
/** Omitting thinkingLevel keeps the active version's level. */
export const saveAiConfig = (input: { role: PromptRole; model: string; temperature: number; thinkingLevel?: ThinkingLevel; template?: string }): Promise<PromptRoleConfig> => request("/admin/ai-config", { method: "PUT", body: JSON.stringify(input) });
export const auditWhenLabel = (e: AuditEvent): string => /T\d\d:\d\d/.test(e.at) ? formatDateTime(e.at).replace(/ \d{4},/, ",") : formatShortDate(e.at);
export const auditAgeDays = (e: AuditEvent): number => daysSince(e.at) ?? 0;
