/** CSV parsing and writing, plus the A2 invite-row validation rules. No React, no DOM. */
import type { InviteCsvParse, InviteResult, InviteRow, InviteRowInput } from "@/lib/types";

export type ParsedCsv = {
  /** Lower-cased, trimmed header names. */
  headers: string[];
  /** One object per data row keyed by header. Fully blank lines are skipped. */
  rows: Record<string, string>[];
  /** Original 1-based data-row index of each entry in `rows` (blank lines are not counted). */
  rowNumbers: number[];
};

/** Split CSV text into records. Handles quotes, "" escapes, CRLF/LF and a BOM. */
function splitRecords(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let quoted = false;

  const endField = () => {
    record.push(quoted ? field : field.trim());
    field = "";
    quoted = false;
  };
  const endRecord = () => {
    endField();
    records.push(record);
    record = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field.trim() === "") {
      field = "";
      inQuotes = true;
      quoted = true;
    } else if (ch === ",") {
      endField();
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      endRecord();
    } else {
      field += ch;
    }
  }
  if (field !== "" || record.length > 0 || quoted) endRecord();
  return records;
}

/** Parse CSV with a header row. Values are trimmed unless quoted. */
export function parseCsv(text: string): ParsedCsv {
  const records = splitRecords(text).filter((r) => r.some((cell) => cell.trim() !== ""));
  if (records.length === 0) return { headers: [], rows: [], rowNumbers: [] };
  const headers = records[0].map((h) => h.trim().toLowerCase());
  const rows: Record<string, string>[] = [];
  const rowNumbers: number[] = [];
  records.slice(1).forEach((cells, index) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cells[i] ?? "").trim();
    });
    rows.push(row);
    rowNumbers.push(index + 1);
  });
  return { headers, rows, rowNumbers };
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email.trim());
}

/** Split "A; B ;C" into trimmed, non-empty role names. */
export function splitRoles(value: string): string[] {
  return value
    .split(";")
    .map((r) => r.trim())
    .filter(Boolean);
}

export type InviteValidationContext = {
  approvedRoleNames: string[];
  /** Draft roles: exist but aren't approved yet (gets "Role not approved yet"). */
  draftRoleNames?: string[];
  /** Emails already in the workspace (any status). */
  existingEmails: Iterable<string>;
};

/**
 * Validate invite rows. First problem wins, in this order: invalid email, already invited,
 * duplicate in file, unknown role, role not approved. Role and email matching is case-insensitive.
 * `rowNumbers` overrides the default 1..n numbering (used when blank lines were skipped).
 */
export function validateInviteInput(
  input: InviteRowInput[],
  ctx: InviteValidationContext,
  rowNumbers?: number[],
): InviteRow[] {
  const approved = new Set(ctx.approvedRoleNames.map((r) => r.trim().toLowerCase()));
  const drafts = new Set((ctx.draftRoleNames ?? []).map((r) => r.trim().toLowerCase()));
  const existing = new Set(Array.from(ctx.existingEmails, (e) => e.trim().toLowerCase()));
  const seen = new Set<string>();

  return input.map((row, index): InviteRow => {
    const email = row.email.trim();
    const key = email.toLowerCase();
    const base = { rowNumber: rowNumbers?.[index] ?? index + 1, email, name: row.name.trim(), roles: row.roles };
    const done = (result: InviteResult, extra: Partial<InviteRow> = {}): InviteRow => ({ ...base, result, ...extra });

    if (!isValidEmail(email)) return done("invalid_email", { problemCell: "email" });
    if (existing.has(key)) {
      seen.add(key);
      return done("already_invited", { problemCell: "email" });
    }
    if (seen.has(key)) return done("duplicate_in_file", { problemCell: "email" });
    seen.add(key);

    if (row.roles.length === 0) return done("unknown_role", { problemCell: "roles", badRole: "" });
    const unknown = row.roles.find((r) => !approved.has(r.toLowerCase()) && !drafts.has(r.toLowerCase()));
    if (unknown !== undefined) return done("unknown_role", { problemCell: "roles", badRole: unknown });
    const draft = row.roles.find((r) => !approved.has(r.toLowerCase()));
    if (draft !== undefined) return done("role_not_approved", { problemCell: "roles", badRole: draft });
    return done("ready");
  });
}

export function summariseInviteRows(rows: InviteRow[]): { total: number; ready: number; needFixing: number } {
  const ready = rows.filter((r) => r.result === "ready").length;
  return { total: rows.length, ready, needFixing: rows.length - ready };
}

/**
 * Parse an invite CSV (columns email, name, roles; roles separated by semicolons) and validate it.
 * `draftRoleNames` is optional; without it a draft role is reported as unknown_role.
 */
export function parseInviteCsv(
  text: string,
  approvedRoleNames: string[],
  existingEmails: Iterable<string>,
  draftRoleNames: string[] = [],
): InviteCsvParse {
  const parsed = parseCsv(text);
  const missingColumns = ["email", "name", "roles"].filter((c) => !parsed.headers.includes(c));
  const input: InviteRowInput[] = parsed.rows.map((r) => ({
    email: r.email ?? "",
    name: r.name ?? "",
    roles: splitRoles(r.roles ?? ""),
  }));
  const rows = validateInviteInput(input, { approvedRoleNames, draftRoleNames, existingEmails }, parsed.rowNumbers);
  return { rows, summary: summariseInviteRows(rows), missingColumns };
}

/** Sort problem rows first (stable), keeping row order within each group. */
export function problemRowsFirst(rows: InviteRow[]): InviteRow[] {
  return [...rows].sort((a, b) => Number(a.result === "ready") - Number(b.result === "ready") || a.rowNumber - b.rowNumber);
}

/** Header the "Download template" link uses. */
export const INVITE_CSV_TEMPLATE = "email,name,roles\nneha.kapoor@example.com,Neha Kapoor,Customer Support Associate\n";

function escapeCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  // Neutralise spreadsheet formulas in text cells.
  const safe = typeof value === "string" && /^[=+\-@]/.test(s) && !/^[-+]?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Serialise rows (first row = header) to CSV text with CRLF line breaks. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(escapeCell).join(",")).join("\r\n") + "\r\n";
}

/** Browser-only helper: download text as a file. No-op on the server. */
export function downloadTextFile(filename: string, text: string, mime = "text/csv;charset=utf-8"): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
