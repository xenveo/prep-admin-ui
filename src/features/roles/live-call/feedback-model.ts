import type { DeliveryMetric, PreviewAttempt, PreviewFeedback } from "@/services/preview";

/** The three rows of the call's feedback card, scored 1–5 dots. */
export type RowKey = "content" | "pacing" | "confidence";

export type PaceSpark = {
  series: number[];
  target: { min: number; max: number };
  scale: { min: number; max: number };
  durationSec: number;
};

export type FeedbackRow = {
  key: RowKey;
  label: string;
  dots: number;
  text: string;
  spark?: PaceSpark;
  chips?: string[];
};

const dotsOf = (score: number) => Math.min(5, Math.max(1, Math.round(score / 20)));
const metric = (fb: PreviewFeedback, key: DeliveryMetric["key"]) => fb.delivery.find((m) => m.key === key);
const sentence = (...parts: (string | undefined)[]) => parts.map((p) => p?.trim()).filter(Boolean).join(" ");

function paceDots(m: DeliveryMetric): number {
  const v = m.value;
  if (v >= 130 && v <= 150) return 5;
  if (v >= m.target.min && v <= m.target.max) return 4;
  const off = v < m.target.min ? m.target.min - v : v - m.target.max;
  return off <= 20 ? 3 : off <= 40 ? 2 : 1;
}

/** Content, Pacing and Confidence rows for one scored try. Pacing is left out when the try has no pace metric. */
export function feedbackRows(attempt: PreviewAttempt): FeedbackRow[] {
  const fb = attempt.feedback;
  const s = fb.subScores;
  const contentDots = dotsOf((s.content + s.structure + s.relevance) / 3);
  const rows: FeedbackRow[] = [{
    key: "content",
    label: "Content",
    dots: contentDots,
    text: (contentDots < 4 ? fb.improve[0] ?? fb.worked[0] : fb.worked[0] ?? fb.improve[0]) ?? "",
  }];

  const pace = metric(fb, "pace");
  if (pace) {
    const series = fb.paceSeries ?? [];
    const durationSec = attempt.durationSec ?? 0;
    rows.push({
      key: "pacing",
      label: "Pacing",
      dots: paceDots(pace),
      text: pace.note ? `${pace.valueText}. ${pace.note}` : pace.valueText,
      ...(series.length >= 2 && durationSec > 0 ? { spark: { series, target: pace.target, scale: pace.scale, durationSec } } : {}),
    });
  }

  const fillers = metric(fb, "fillers");
  const pauses = metric(fb, "pauses");
  const chips = (fb.fillers ?? []).map((f) => `${f.text} ×${f.count}`);
  rows.push({
    key: "confidence",
    label: "Confidence",
    dots: dotsOf(s.delivery),
    text: sentence(fillers?.note, pauses && !pauses.inTarget ? pauses.note : undefined),
    ...(chips.length ? { chips } : {}),
  });
  return rows;
}

/** One practical tip: the suggested opener, else the next thing to improve. */
export function feedbackTip(fb: PreviewFeedback): string | null {
  if (fb.opener?.trim()) return `Open with: “${fb.opener.trim()}”`;
  return fb.improve[1] ?? fb.focus[0] ?? null;
}

/** Row labels that scored more dots on the second try than on the first. */
export function improvedRows(first: PreviewAttempt, second: PreviewAttempt): string[] {
  const before = new Map(feedbackRows(first).map((r) => [r.key, r.dots]));
  return feedbackRows(second).filter((r) => r.dots > (before.get(r.key) ?? 5)).map((r) => r.label);
}

/** "●●●○○" */
export const dotString = (n: number) => "●".repeat(n) + "○".repeat(5 - n);

/** m:ss */
export function clock(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = String(sec % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
