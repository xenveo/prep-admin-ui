import { SubScoreBars } from "@/components/charts/sub-score-bars";
import { AudioPlayer } from "@/components/media/audio-waveform";
import { TranscriptHighlights } from "@/components/media/transcript-highlights";
import { BandChip } from "@/components/ui/band-chip";
import { cn } from "@/lib/cn";
import { answerDimensionLabel, DIMENSION_IDS, type AnswerMode, type AppliedState, type Try } from "@/lib/types";

const MARK: Record<AppliedState, string> = { done: "✓", partial: "–", missed: "–" };
const STATE_LABEL: Record<AppliedState, string> = { done: "Done", partial: "Partly", missed: "Not yet" };

/** The try's answer mode; falls back to voice/typed from delivery or audio when the backend omits `mode`. */
export function tryMode(t: Try): AnswerMode {
  const mode: unknown = t.mode;
  if (mode === "voice" || mode === "typed") return mode;
  return t.delivery || t.audioUrl ? "voice" : "typed";
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-xs font-semibold text-ink-muted">{children}</div>;
}

export function TryCard({ label, data }: { label: "First try" | "Second try"; data: Try }) {
  const sub = data.subScores;
  const mode = tryMode(data);
  return (
    <article aria-label={label} className="flex min-w-0 flex-col gap-4 rounded-lg border border-line bg-surface p-4">
      <div className="flex items-center gap-3">
        <h3 className="m-0 text-base font-semibold text-ink">{label}</h3>
        <span className="text-xl font-bold text-ink">{data.score}</span>
        <BandChip band={data.band} />
      </div>
      <AudioPlayer label={label} durationSeconds={data.audioSeconds} src={data.audioUrl} />
      <div>
        <Label>Transcript</Label>
        <TranscriptHighlights transcript={data.transcript} highlights={data.highlights} />
      </div>
      <SubScoreBars
        labelWidth={mode === "typed" ? 112 : undefined}
        scores={DIMENSION_IDS.map((id) => ({ label: answerDimensionLabel(id, mode), value: sub[id] }))}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>What worked</Label>
          <p className="m-0 text-[13px] leading-5 text-ink">{data.worked}</p>
        </div>
        <div>
          <Label>What to improve</Label>
          <p className="m-0 text-[13px] leading-5 text-ink">{data.improve}</p>
        </div>
      </div>
      {data.appliedFromFeedback && data.appliedFromFeedback.length > 0 && (
        <div>
          <Label>Applied from feedback</Label>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] text-ink">
            {data.appliedFromFeedback.map((a) => (
              <li key={a.text} className="flex gap-2">
                <span aria-hidden="true" className={a.state === "done" ? "font-bold text-primary-text" : "font-bold text-improve-text"}>
                  {MARK[a.state]}
                </span>
                <span>
                  {a.text}
                  <span className="text-ink-muted">
                    {a.state === "done" ? "" : `, ${STATE_LABEL[a.state].toLowerCase()}`}
                    {a.detail ? `, ${a.detail}` : ""}
                  </span>
                  <span className="sr-only">{a.state === "done" ? ". Done" : ""}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.delivery ? <table className="w-full border-collapse text-[13px]">
        <caption className="pb-1 text-left text-xs font-semibold text-ink-muted">Delivery</caption>
        <tbody>
          <tr className="border-t border-line">
            <th scope="row" className="h-8 text-left font-normal text-ink-muted">Pace</th>
            <td className="text-right text-ink">
              {data.delivery.wpm} wpm{data.delivery.paceLabel ? `, ${data.delivery.paceLabel}` : ""}
            </td>
          </tr>
          <tr className="border-t border-line">
            <th scope="row" className="h-8 text-left font-normal text-ink-muted">Filler words</th>
            <td className="text-right text-ink">{data.delivery.fillerWords}</td>
          </tr>
          <tr className="border-t border-line">
            <th scope="row" className="h-8 text-left font-normal text-ink-muted">Longest pause</th>
            <td className={cn("text-right", data.delivery.longestPauseSec === null ? "text-ink-muted" : "text-ink")}>{data.delivery.longestPauseSec === null ? "Not measured" : `${data.delivery.longestPauseSec} s`}</td>
          </tr>
        </tbody>
      </table> : <p className="m-0 text-xs text-ink-muted">{mode === "typed" ? "Typed answer: no voice delivery metrics." : "Delivery metrics are unavailable for this answer."}</p>}
    </article>
  );
}
