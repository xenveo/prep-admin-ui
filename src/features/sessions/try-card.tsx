import { AudioPlayer } from "@/components/media/audio-waveform";
import { TranscriptHighlights } from "@/components/media/transcript-highlights";
import { cn } from "@/lib/cn";
import { answerDimensionLabel, DIMENSION_IDS, type AnswerMode, type AppliedState, type Try } from "@/lib/types";

const EYEBROW = "m-0 font-mono text-xs font-normal uppercase tracking-[0.08em] text-ink-faint";

const STATE_LABEL: Record<AppliedState, string> = { done: "Done", partial: "Partly", missed: "Not yet" };
const STATE_PILL: Record<AppliedState, string> = {
  done: "bg-primary-tint text-primary-text",
  partial: "bg-primary-tint text-primary-text",
  missed: "bg-improve-soft text-improve-text",
};

/** The try's answer mode; falls back to voice/typed from delivery or audio when the backend omits `mode`. */
export function tryMode(t: Try): AnswerMode {
  const mode: unknown = t.mode;
  if (mode === "voice" || mode === "typed") return mode;
  return t.delivery || t.audioUrl ? "voice" : "typed";
}

function DimensionMeter({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <li className="flex min-w-0 flex-col gap-2">
      <div aria-hidden="true" className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] text-ink-muted">{label}</span>
        <span className="text-lg font-semibold text-ink">{value}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        className="h-1 overflow-hidden rounded-sm bg-line"
      >
        <div className={cn("h-full rounded-sm", value >= 50 ? "bg-primary" : "bg-improve")} style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

/** One try of an answer: transcript, dimension scores, feedback, applied feedback and voice delivery. */
export function TryCard({ label, data, className }: { label: "First try" | "Second try"; data: Try; className?: string }) {
  const sub = data.subScores;
  const mode = tryMode(data);
  const applied = data.appliedFromFeedback ?? [];
  return (
    <article
      aria-label={`${label}, score ${data.score}`}
      className={cn("flex min-w-0 flex-col overflow-hidden rounded-panel border border-line bg-surface", className)}
    >
      <section className="flex flex-col gap-3 px-6 py-[22px]">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h3 className={EYEBROW}>Transcript</h3>
          <span className="text-xs text-ink-faint">
            {mode === "typed"
              ? "Typed answer · no recording or voice delivery metrics"
              : `Voice answer${data.audioLabel ? ` · ${data.audioLabel}` : ""}`}
          </span>
        </div>
        {mode === "voice" && <AudioPlayer label={label} durationSeconds={data.audioSeconds} src={data.audioUrl} />}
        {/* TranscriptHighlights owns the 15px / 1.75 ink-soft type. */}
        <TranscriptHighlights className="text-pretty" transcript={data.transcript} highlights={data.highlights} />
      </section>

      <section aria-label="Dimension scores" className="border-t border-line px-6 py-5">
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 min-[1280px]:grid-cols-4">
          {DIMENSION_IDS.map((id) => (
            <DimensionMeter key={id} label={answerDimensionLabel(id, mode)} value={sub[id]} />
          ))}
        </ul>
      </section>

      {/* Cells carry their own top/left borders; the -ml-px clips the first column's left border, so the
          divider is vertical side by side and horizontal when the columns stack. */}
      <div className="-ml-px grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]">
        <section className="flex flex-col gap-2 border-t border-l border-line px-6 py-5">
          <h3 className="m-0 text-[13px] font-bold text-primary-text">
            <span aria-hidden="true">✓ </span>What worked
          </h3>
          <p className="m-0 text-sm leading-[1.6] text-ink-soft">{data.worked}</p>
        </section>
        <section className="flex flex-col gap-2 border-t border-l border-line px-6 py-5">
          <h3 className="m-0 text-[13px] font-bold text-improve-text">
            <span aria-hidden="true">! </span>What to improve
          </h3>
          <p className="m-0 text-sm leading-[1.6] text-ink-soft">{data.improve}</p>
        </section>
      </div>

      {applied.length > 0 && (
        <section className="border-t border-line px-6 py-5">
          <h3 className="m-0 pb-2 text-sm font-semibold text-ink">Applied from first-try feedback</h3>
          <ul className="m-0 list-none p-0">
            {applied.map((a) => (
              <li key={a.text} className="grid grid-cols-[72px_minmax(0,1fr)] gap-3.5 border-t border-line py-3">
                <span className={cn("self-start justify-self-start rounded-md px-2 py-[3px] text-xs font-bold", STATE_PILL[a.state])}>
                  {STATE_LABEL[a.state]}
                  <span className="sr-only">:</span>
                </span>
                <div className="flex min-w-0 flex-col gap-[3px]">
                  <span className="text-sm font-semibold text-ink">{a.text}</span>
                  {a.detail && <p className="m-0 text-sm leading-[1.55] text-ink-muted">{a.detail}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {mode === "voice" && (
        <section className="border-t border-line px-6 py-5">
          {data.delivery ? (
            <table className="w-full border-collapse text-[13px]">
              <caption className={cn(EYEBROW, "pb-2 text-left")}>Delivery</caption>
              <tbody>
                <tr className="border-t border-line">
                  <th scope="row" className="h-9 text-left font-normal text-ink-muted">Pace</th>
                  <td className="text-right font-semibold text-ink">
                    {data.delivery.wpm} wpm{data.delivery.paceLabel ? `, ${data.delivery.paceLabel}` : ""}
                  </td>
                </tr>
                <tr className="border-t border-line">
                  <th scope="row" className="h-9 text-left font-normal text-ink-muted">Filler words</th>
                  <td className="text-right font-semibold text-ink">{data.delivery.fillerWords}</td>
                </tr>
                <tr className="border-t border-line">
                  <th scope="row" className="h-9 text-left font-normal text-ink-muted">Longest pause</th>
                  <td
                    className={cn(
                      "text-right",
                      data.delivery.longestPauseSec === null ? "text-ink-muted" : "font-semibold text-ink",
                    )}
                  >
                    {data.delivery.longestPauseSec === null ? "Not measured" : `${data.delivery.longestPauseSec} s`}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="m-0 text-xs text-ink-faint">Delivery metrics are unavailable for this answer.</p>
          )}
        </section>
      )}
    </article>
  );
}
