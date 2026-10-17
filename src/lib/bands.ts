/** Readiness bands (docs/domain-model.md). */
export type Band = "ready" | "nearly" | "developing" | "not_ready";

export const BANDS: readonly { id: Band; label: string; min: number; max: number }[] = [
  { id: "ready", label: "Interview ready", min: 85, max: 100 },
  { id: "nearly", label: "Nearly ready", min: 70, max: 84 },
  { id: "developing", label: "Developing", min: 50, max: 69 },
  { id: "not_ready", label: "Not ready yet", min: 0, max: 49 },
];

export const BAND_LABEL: Record<Band, string> = {
  ready: "Interview ready",
  nearly: "Nearly ready",
  developing: "Developing",
  not_ready: "Not ready yet",
};

/** CSS custom property names (no `var()`), e.g. `--band-not-ready`. */
export const BAND_VAR: Record<Band, { color: string; tint: string; on: string }> = {
  ready: { color: "--band-ready", tint: "--band-ready-tint", on: "--band-ready-on" },
  nearly: { color: "--band-nearly", tint: "--band-nearly-tint", on: "--band-nearly-on" },
  developing: { color: "--band-developing", tint: "--band-developing-tint", on: "--band-developing-on" },
  not_ready: { color: "--band-not-ready", tint: "--band-not-ready-tint", on: "--band-not-ready-on" },
};

export function bandForScore(score: number): Band {
  if (score >= 85) return "ready";
  if (score >= 70) return "nearly";
  if (score >= 50) return "developing";
  return "not_ready";
}

/** Sample data uses "not_ready" in some places and may use other ids; normalise here. */
export function toBand(id: string): Band {
  const band = parseBand(id);
  if (band === null) throw new Error(`Unknown band id: ${id}`);
  return band;
}

/** Like toBand, but returns null for unknown ids (for untrusted input such as URL params). */
export function parseBand(id: string): Band | null {
  if (id === "ready" || id === "nearly" || id === "developing" || id === "not_ready") return id;
  if (id === "not-ready" || id === "notready") return "not_ready";
  return null;
}

/** Change since baseline, or null when there are fewer than 2 sessions. */
export function scoreChange(latest: number | null, baseline: number | null, sessions: number): number | null {
  if (sessions < 2 || latest == null || baseline == null) return null;
  return latest - baseline;
}
