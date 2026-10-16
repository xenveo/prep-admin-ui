import { ApiError } from "@/lib/api/client";

const NO_ACCESS = "You don't have permission to do this. Ask a super admin.";
const RAW_ZOD = /^(Invalid|Expected|Too small|Too big|Required)/;
const PATH_PREFIX = /^([A-Za-z_$][\w$]*(?:\.[\w$]+)*): ([\s\S]*)$/;

/** Last path segment → how settings screens name the field. */
const FIELD_LABEL: Record<string, string> = {
  voice: "voice",
  feedbackLength: "feedback length",
  language: "language",
  audioRetentionDays: "audio retention",
  transcriptRetention: "transcript retention",
  candidatesCanDeleteData: "candidate deletion setting",
  senderName: "sender name",
  replyTo: "reply-to address",
  inviteLinkExpiryDays: "invite link expiry",
  role: "prompt role",
  model: "model",
  temperature: "temperature",
  template: "prompt",
  email: "email address",
  access: "access level",
};

function issueCopy(issue: string): string {
  const match = PATH_PREFIX.exec(issue);
  const field = match?.[1].split(".").pop();
  const text = (match ? match[2] : issue).trim();
  if (!RAW_ZOD.test(text)) return /[.!?]$/.test(text) ? text : `${text}.`;
  const label = field && FIELD_LABEL[field];
  return label ? `Check the ${label}.` : "Check the values and try again.";
}

/** Super-admin-only endpoints answer non-super admins with the generic guard 404, not 403. */
export const isAccessDenied = (error: unknown): boolean => error instanceof ApiError && error.status === 404 && error.message === "Not found";

/** User-facing copy for a settings request failure; never shows raw validation or guard text. */
export function settingsErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  if (isAccessDenied(error)) return NO_ACCESS;
  if (error.status === 400 && error.code === "validation_failed") {
    const issues = error.message.split("; ").filter((i) => i.trim()).map(issueCopy);
    return issues.length ? [...new Set(issues)].join(" ") : fallback;
  }
  return error.message || fallback;
}
