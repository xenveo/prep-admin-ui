/** Display helpers only. Executive reporting calculations belong to the backend. */
import type { ExecutiveRatio } from "@/lib/api/executive-contracts";
export type Ratio = ExecutiveRatio;
export const SMALL_SAMPLE = 20;
export function currentUtcMonth() {
  return new Date().toISOString().slice(0, 7);
}
export function monthLabel(month: string, style: "long" | "short" = "long") {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return month;
  return new Date(`${month}-01T00:00:00Z`).toLocaleString("en-GB", {
    month: style,
    year: style === "long" ? "numeric" : undefined,
    timeZone: "UTC",
  });
}
export function cutoffLabel(cutoff: string) {
  // The API cutoff is exclusive. Subtracting a millisecond labels a full month by its final day.
  return new Date(new Date(cutoff).getTime() - 1).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}
