"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { PreviewAttempt } from "@/services/preview";
import { INTERVIEWER_NAME } from "./call-prefs";
import { FeedbackRows } from "./feedback-card";
import { clock, dotString, feedbackRows } from "./feedback-model";
import { Icon } from "./icons";

export type TranscriptEntry =
  | { kind: "line"; id: string; at: number; speaker: "interviewer" | "candidate"; text: string; interrupted?: boolean }
  | { kind: "feedback"; id: string; at: number; questionNumber: number; attemptNo: 1 | 2; attempt: PreviewAttempt };

/** Stay pinned to the newest entry unless the reader scrolled up more than this. */
const STICK_PX = 48;

function FeedbackEntry({ e }: { e: Extract<TranscriptEntry, { kind: "feedback" }> }) {
  const [open, setOpen] = useState(false);
  const rows = feedbackRows(e.attempt);
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer justify-between gap-2 rounded-[10px] border border-line bg-[#0D1010] px-3 py-2.5 text-left text-[13px] font-medium text-ink"
      >
        <span>
          <strong className="font-semibold">Feedback · Q{e.questionNumber}, attempt {e.attemptNo}</strong>
          <br />
          <span className="text-ink-muted">{rows.map((r) => `${r.label} ${dotString(r.dots)}`).join(" · ")}</span>
        </span>
        <Icon name="chevron" className={cn("mt-0.5 size-4 shrink-0 text-ink-muted transition-transform motion-reduce:transition-none", open && "rotate-180")} />
      </button>
      {open && <div className="flex flex-col"><FeedbackRows rows={rows} dense /></div>}
    </div>
  );
}

/** Everything said on this page, with scored tries as collapsible feedback. 400px panel; a full sheet below md. */
export function TranscriptDrawer({ entries, startedAt, onClose }: { entries: TranscriptEntry[]; startedAt: number | null; onClose: () => void }) {
  const list = useRef<HTMLOListElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const stick = useRef(true);

  useEffect(() => { close.current?.focus(); }, []);
  useLayoutEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [entries]);

  return (
    <aside
      id="call-transcript"
      aria-label="Transcript"
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}
      className="absolute inset-y-0 right-0 z-[3] flex w-full flex-col border-l border-line bg-[#161A19] md:w-[400px]"
    >
      <div className="flex items-center justify-between border-b border-line px-[18px] py-3.5">
        <h2 className="m-0 text-base font-semibold">Transcript</h2>
        <button
          ref={close}
          type="button"
          aria-label="Close transcript"
          onClick={onClose}
          className="relative flex size-10 cursor-pointer items-center justify-center rounded-full bg-neutral-soft after:absolute after:-inset-1 hover:bg-line"
        >
          <Icon name="close" strokeWidth={2.2} className="size-4 text-ink" />
        </button>
      </div>
      <ol
        ref={list}
        onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX; }}
        className="m-0 flex flex-1 list-none flex-col gap-3.5 overflow-y-auto overscroll-contain px-[18px] py-4"
      >
        {entries.length === 0 && <li className="text-[14px] text-ink-muted">What you and {INTERVIEWER_NAME} say appears here.</li>}
        {entries.map((e) => (
          <li key={e.id} className="flex flex-col gap-1">
            {e.kind === "line" ? (
              <>
                <span className={cn("text-[12px] font-bold", e.speaker === "interviewer" ? "text-primary" : "text-neutral-text")}>
                  {e.speaker === "interviewer" ? INTERVIEWER_NAME : "You"}{" "}
                  {startedAt !== null && <span className="font-medium text-ink-muted tabular-nums">{clock((e.at - startedAt) / 1000)}</span>}
                </span>
                <span className={cn("text-[14px] leading-[21px] text-neutral-text", e.interrupted && "line-through decoration-ink-muted opacity-55")}>
                  {e.text.trim()}
                </span>
              </>
            ) : (
              <FeedbackEntry e={e} />
            )}
          </li>
        ))}
      </ol>
    </aside>
  );
}
