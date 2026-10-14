/**
 * Date, number and name formatting. Output is deterministic: timestamps are read as
 * wall-clock values exactly as written (any UTC offset is ignored) and "today" is fixed
 * to 2026-10-15 so server and client render the same strings.
 */
import { TODAY } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MINUS = "−";

type Wall = { y: number; m: number; d: number; hh: number; mm: number; hasTime: boolean };

function parseWall(iso: string): Wall | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(iso);
  if (!match) return null;
  return {
    y: Number(match[1]),
    m: Number(match[2]),
    d: Number(match[3]),
    hh: match[4] ? Number(match[4]) : 0,
    mm: match[5] ? Number(match[5]) : 0,
    hasTime: match[4] !== undefined,
  };
}

function dayNumber(w: Wall): number {
  return Math.floor(Date.UTC(w.y, w.m - 1, w.d) / 86_400_000);
}

const pad = (n: number) => String(n).padStart(2, "0");
const time = (w: Wall) => `${pad(w.hh)}:${pad(w.mm)}`;

/** Whole days between `iso` and `now` (positive = in the past). null if unparseable. */
export function daysSince(iso: string, now: string = TODAY): number | null {
  const a = parseWall(iso);
  const b = parseWall(now);
  if (!a || !b) return null;
  return dayNumber(b) - dayNumber(a);
}

/** "15 Oct 2026" */
export function formatDate(iso: string): string {
  const w = parseWall(iso);
  if (!w) return iso;
  return `${w.d} ${MONTHS[w.m - 1]} ${w.y}`;
}

/** "15 Oct" */
export function formatShortDate(iso: string): string {
  const w = parseWall(iso);
  if (!w) return iso;
  return `${w.d} ${MONTHS[w.m - 1]}`;
}

/** "15 Oct 2026, 10:42" (date only when the value has no time) */
export function formatDateTime(iso: string): string {
  const w = parseWall(iso);
  if (!w) return iso;
  return w.hasTime ? `${formatDate(iso)}, ${time(w)}` : formatDate(iso);
}

/** "15 Oct, 10:42" (used by activity lists) */
export function formatShortDateTime(iso: string): string {
  const w = parseWall(iso);
  if (!w) return iso;
  return w.hasTime ? `${formatShortDate(iso)}, ${time(w)}` : formatShortDate(iso);
}

/** "15 Sep – 15 Oct 2026" */
export function formatDateRange(from: string, to: string): string {
  const a = parseWall(from);
  const b = parseWall(to);
  if (!a || !b) return `${from} – ${to}`;
  const left = a.y === b.y ? formatShortDate(from) : formatDate(from);
  return `${left} – ${formatDate(to)}`;
}

/** "Today 10:42", "Yesterday", "2 days ago"; older than two weeks falls back to "29 Sep". */
export function relativeTime(iso: string, now: string = TODAY): string {
  if (iso === "now") return "Now";
  const w = parseWall(iso);
  const diff = daysSince(iso, now);
  if (!w || diff === null) return iso;
  if (diff === 0) return w.hasTime ? `Today ${time(w)}` : "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 14) return `${diff} days ago`;
  const nowWall = parseWall(now);
  return nowWall && nowWall.y === w.y ? formatShortDate(iso) : formatDate(iso);
}

/** Lower-case phrase for sentences: "today", "yesterday", "2 days ago". */
export function relativeDay(iso: string, now: string = TODAY): string {
  const diff = daysSince(iso, now);
  if (diff === null) return iso;
  if (diff <= 0) return "today";
  if (diff === 1) return "yesterday";
  if (diff < 14) return `${diff} days ago`;
  return `on ${formatShortDate(iso)}`;
}

/** "Invite sent 2 days ago" */
export function inviteSentLabel(invitedAt: string, now: string = TODAY): string {
  return `Invite sent ${relativeDay(invitedAt, now)}`;
}

/** "Invited 2 days ago" */
export function invitedLabel(invitedAt: string, now: string = TODAY): string {
  return `Invited ${relativeDay(invitedAt, now)}`;
}

/** Seconds to "1:38" (or "1:02:03" past an hour). */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Parse "1:38" into seconds. NaN when invalid. */
export function parseDuration(label: string): number {
  const parts = label.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return Number.NaN;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/** 24 -> "24 min" */
export function formatMinutes(minutes: number): string {
  return `${minutes} min`;
}

/** 24 -> "+24", -5 -> "−5" (U+2212), 0 -> "0" */
export function formatSigned(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `${MINUS}${Math.abs(n)}`;
  return "0";
}

export function pluralize(count: number, singular: string, plural: string = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "Priya Sharma" -> "PS"; single name -> first two letters; empty -> "?" */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").replace(/[[\]]/g, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
