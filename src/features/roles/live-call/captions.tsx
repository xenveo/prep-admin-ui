import { cn } from "@/lib/cn";
import { INTERVIEWER_NAME, type CaptionSize } from "./call-prefs";
import { clock } from "./feedback-model";
import { Icon } from "./icons";

/** Caption sizes per preference: base (below md) then md+. Literal strings so Tailwind sees them. */
const SIZES: Record<CaptionSize, { q: string; qDrawer: string; ai: string; you: string }> = {
  s: {
    q: "text-[18px] leading-[26px] md:text-[24px] md:leading-[32px]",
    qDrawer: "text-[18px] leading-[26px] md:text-[21px] md:leading-[29px]",
    ai: "text-[15px] leading-[22px] md:text-[17px] md:leading-[26px]",
    you: "text-[13px] md:text-[15px]",
  },
  m: {
    q: "text-[20px] leading-[28px] md:text-[28px] md:leading-[36px]",
    qDrawer: "text-[20px] leading-[28px] md:text-[24px] md:leading-[32px]",
    ai: "text-[16px] leading-[24px] md:text-[19px] md:leading-[29px]",
    you: "text-[14px] md:text-[16px]",
  },
  l: {
    q: "text-[23px] leading-[31px] md:text-[32px] md:leading-[41px]",
    qDrawer: "text-[23px] leading-[31px] md:text-[28px] md:leading-[36px]",
    ai: "text-[18px] leading-[27px] md:text-[22px] md:leading-[33px]",
    you: "text-[16px] md:text-[18px]",
  },
};

/** The end of a long line, cut at a word, so captions stay a few lines tall. */
function tail(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(t.length - max);
  const space = cut.indexOf(" ");
  return `…${space > 0 && space < 24 ? cut.slice(space + 1) : cut}`;
}

export type Hint = { kind: "try" } | { kind: "done"; pending: boolean; onDone: () => void };

/** Pinned question, the interviewer's and your latest lines, and a hint. */
export function Captions(p: {
  size: CaptionSize;
  drawerOpen: boolean;
  /** Hidden while a feedback card is up. */
  showQuestion: boolean;
  questionNumber: number;
  questionText: string;
  secondTry: boolean;
  followUp: string | null;
  timerSec: number | null;
  ai: { text: string; interrupted: boolean } | null;
  you: { text: string; live: boolean } | null;
  mutedSpeech: boolean;
  hint: Hint | null;
  notice: string | null;
}) {
  const s = SIZES[p.size];
  return (
    <section aria-label="Captions" aria-live="polite" className="flex w-full shrink-0 flex-col items-center gap-3.5 text-center md:max-w-[880px]">
      {p.showQuestion && (
        <div className="flex flex-col items-center gap-2">
          <span className="inline-flex min-h-[22px] flex-wrap items-center justify-center gap-2.5 text-[13px] text-ink-muted">
            Question {p.questionNumber}
            {p.secondTry && (
              <span className="inline-flex min-h-[22px] items-center rounded-full bg-primary-soft px-2 text-[12px] font-semibold text-primary-text">Second try</span>
            )}
            {p.timerSec !== null && (
              <span className="inline-flex items-center gap-[5px] text-neutral-text tabular-nums" aria-label={`Answer time ${clock(p.timerSec)}`}>
                <Icon name="timer" strokeWidth={2.2} className="size-[13px] text-ink-muted" />
                {clock(p.timerSec)}
              </span>
            )}
          </span>
          <p className={cn("m-0 font-semibold text-balance text-[#F4F5F2]", p.drawerOpen ? s.qDrawer : s.q)}>{p.questionText}</p>
          {p.secondTry && p.followUp && (
            <p className="m-0 flex max-w-[720px] flex-col gap-0.5 text-pretty">
              <span className="text-[12px] font-bold text-primary">Follow-up</span>
              <span className={cn("font-semibold text-ink", s.you)}>{p.followUp}</span>
            </p>
          )}
        </div>
      )}

      {p.ai && (
        <p className={cn("m-0 max-w-[760px] rounded-[10px] bg-black/45 px-3.5 py-2 text-pretty", s.ai, p.ai.interrupted && "opacity-55")}>
          <span className="mr-2 text-[13px] font-bold text-primary">{INTERVIEWER_NAME}</span>
          <span className={cn("text-ink", p.ai.interrupted && "line-through decoration-ink-muted")}>{tail(p.ai.text, 240)}</span>
        </p>
      )}

      {p.mutedSpeech && (
        <p role="status" className={cn("m-0 inline-flex max-w-[760px] items-center gap-2 rounded-[10px] bg-black/45 px-3.5 py-2", s.ai)}>
          <Icon name="micOff" className="size-4 shrink-0 text-improve-text" />
          <span className="text-ink">You&apos;re muted. Unmute to answer.</span>
        </p>
      )}

      {p.you && (
        <p className={cn("m-0 max-w-[720px] leading-[1.55] text-pretty text-[#A8AFAB]", s.you)}>
          <span className="mr-2 text-[12px] font-bold text-neutral-text">You</span>
          {tail(p.you.text, 180)}
          {p.you.live && <span aria-hidden className="ml-[3px] inline-block h-4 w-0.5 bg-primary align-[-2px] motion-safe:animate-pulse" />}
        </p>
      )}

      {p.notice && <p role="status" className="m-0 max-w-[640px] rounded-xl bg-neutral-soft px-4 py-2.5 text-[14px] leading-[21px] text-neutral-text">{p.notice}</p>}

      {p.hint?.kind === "try" && <p className="m-0 text-[13px] font-medium text-[#8B9390]">Try: “Can you repeat that?” · “Give me a moment”</p>}
      {p.hint?.kind === "done" && (
        <p className="m-0 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] font-semibold text-primary-text">
          Done? Just say so, or keep going.
          <button
            type="button"
            disabled={p.hint.pending}
            onClick={p.hint.onDone}
            className="relative cursor-pointer rounded-md text-ink-muted underline underline-offset-[3px] after:absolute after:-inset-x-2 after:-inset-y-4 hover:text-ink disabled:cursor-wait"
          >
            {p.hint.pending ? "Sending…" : "I'm done answering"}
          </button>
        </p>
      )}
    </section>
  );
}
