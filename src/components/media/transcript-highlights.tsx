import { cn } from "@/lib/cn";

export type Highlight = { text: string; kind: "match" | "issue"; note: string };

type Part = { text: string; highlight?: Highlight };

function split(transcript: string, highlights: Highlight[]): Part[] {
  // Locate each highlight at the first occurrence not overlapping an earlier one.
  const spans: { start: number; end: number; h: Highlight }[] = [];
  for (const h of highlights) {
    if (!h.text) continue;
    let from = 0;
    let found = -1;
    while (from <= transcript.length) {
      const idx = transcript.indexOf(h.text, from);
      if (idx === -1) break;
      const end = idx + h.text.length;
      if (!spans.some((s) => idx < s.end && end > s.start)) {
        found = idx;
        break;
      }
      from = idx + 1;
    }
    if (found !== -1) spans.push({ start: found, end: found + h.text.length, h });
  }
  spans.sort((a, b) => a.start - b.start);
  const parts: Part[] = [];
  let pos = 0;
  for (const s of spans) {
    if (s.start > pos) parts.push({ text: transcript.slice(pos, s.start) });
    parts.push({ text: transcript.slice(s.start, s.end), highlight: s.h });
    pos = s.end;
  }
  if (pos < transcript.length) parts.push({ text: transcript.slice(pos) });
  return parts;
}

// text-decoration (not border-bottom) so a highlight that wraps underlines every line.
const MARK_BASE = "rounded-[3px] box-decoration-clone text-ink underline decoration-2 underline-offset-4";
const MARK_MATCH = "bg-primary-tint decoration-solid decoration-primary";
const MARK_ISSUE = "bg-transparent decoration-dashed decoration-improve";

export function TranscriptHighlights({
  transcript,
  highlights,
  className,
}: {
  transcript: string;
  highlights: Highlight[];
  className?: string;
}) {
  const parts = split(transcript, highlights);
  return (
    <p className={cn("m-0 text-[15px] leading-[1.75] text-pretty text-ink-soft", className)}>
      {parts.map((p, i) =>
        p.highlight ? (
          <mark
            key={i}
            title={p.highlight.note}
            className={cn(MARK_BASE, p.highlight.kind === "match" ? MARK_MATCH : MARK_ISSUE)}
          >
            <span className="sr-only">{p.highlight.kind === "match" ? "matched: " : "issue: "}{p.highlight.note}. </span>
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  );
}

export function HighlightLegend({ className }: { className?: string }) {
  return (
    <p className={cn("m-0 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs leading-4 text-ink-muted", className)}>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-block h-[3px] w-4 bg-primary" />
        Matched evidence
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden="true" className="inline-block w-4 border-t-2 border-dashed border-improve" />
        Issue
      </span>
    </p>
  );
}
