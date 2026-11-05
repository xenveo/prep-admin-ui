"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CallControls, TRANSCRIPT_TOGGLE_ID } from "./call-controls";
import { CallHeader, type Segment } from "./call-header";
import { MomentBlock, NoisePill, ReconnectPill, StageAlert } from "./call-parts";
import { getCallPrefs, INTERVIEWER_NAME } from "./call-prefs";
import { Captions, type Hint } from "./captions";
import { Orb, type OrbMode } from "./orb";
import { SelfTile } from "./self-tile";
import { TranscriptDrawer, type TranscriptEntry } from "./transcript-drawer";

/** After you have said something and gone quiet this long, offer "Done?". */
const DONE_HINT_AFTER_MS = 3000;

export type CallScreenProps = {
  connection: "live" | "reconnecting" | "connecting";
  /** Connected: controls work and the mic is metered. */
  connected: boolean;
  callStartedAt: number | null;
  segments: Segment[];
  questionNumber: number;
  questionText: string;
  secondTry: boolean;
  followUp: string | null;
  orbMode: OrbMode;
  stateLabel: string;
  remoteLevel: () => number;
  micLevel: () => number;
  ai: { text: string; interrupted: boolean } | null;
  you: { text: string; updatedAt: number } | null;
  /** When your first words of the current try arrived. */
  tryStartedAt: number | null;
  candidateSpeaking: boolean;
  /** The interviewer is listening for an answer (no card, not scoring, paused or speaking). */
  awaitingAnswer: boolean;
  answerDonePending: boolean;
  onAnswerDone: () => void;
  muted: boolean;
  mutedSpeech: boolean;
  noisy: boolean;
  paused: boolean;
  pausePending: boolean;
  repeatPending: boolean;
  card: ReactNode;
  reconnecting: boolean;
  problem: string | null;
  onReconnect: () => void;
  audioBlocked: boolean;
  onResumeAudio: () => void;
  notice: string | null;
  transcript: TranscriptEntry[];
  /** A dialog is open, so keyboard shortcuts are off. */
  shortcutsPaused: boolean;
  onToggleMute: () => void;
  onTogglePause: () => void;
  onRepeat: () => void;
  onLeave: () => void;
};

function isInteractive(el: EventTarget | null) {
  return el instanceof HTMLElement && !!el.closest("button, a, input, textarea, select, [contenteditable]");
}

/** Wall-clock time, ticking. 0 until the first tick. */
function useNow(ms: number) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, ms);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [ms]);
  return now;
}

/** The full-screen, Meet-style live interview: header, interviewer orb and captions, self tile, controls. */
export function CallScreen(p: CallScreenProps) {
  const [captionSize] = useState(() => getCallPrefs().captionSize);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const now = useNow(500);
  const hasCard = !!p.card;
  const { shortcutsPaused, connected, onToggleMute } = p;

  // M toggles mute, unless a dialog is open or focus is on a control or field.
  useEffect(() => {
    if (shortcutsPaused || !connected) return;
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== "m" || e.repeat || e.metaKey || e.ctrlKey || e.altKey || isInteractive(e.target)) return;
      e.preventDefault();
      onToggleMute();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcutsPaused, connected, onToggleMute]);

  const sec = (from: number | null) => (from === null || !now ? null : Math.max(0, (now - from) / 1000));
  const quiet = !!p.you && !p.candidateSpeaking && !!now && now - p.you.updatedAt >= DONE_HINT_AFTER_MS;
  const hint: Hint | null = !p.awaitingAnswer || hasCard ? null
    : p.tryStartedAt === null ? { kind: "try" }
      : quiet ? { kind: "done", pending: p.answerDonePending, onDone: p.onAnswerDone }
        : null;

  return (
    <>
      <CallHeader connection={p.connection} elapsedSec={sec(p.callStartedAt)} questionNumber={p.questionNumber} segments={p.segments} />

      <div className="relative min-h-0 flex-1">
        {p.reconnecting && <ReconnectPill />}

        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center gap-3.5 overflow-x-hidden overscroll-contain",
            drawerOpen && "md:right-[400px]",
            hasCard
              ? "justify-start px-3 pt-2 max-md:overflow-y-auto md:justify-center md:gap-4 md:overflow-y-hidden md:px-6 md:pt-2 md:pb-4"
              // Top-anchored, not centred: captions and hints change height constantly, and centring
              // would move the orb and question every time.
              : "justify-start overflow-y-auto px-4 pt-[max(1rem,6vh)] pb-28 md:gap-7 md:px-6 md:pt-[max(1.5rem,10vh)] md:pb-10",
          )}
        >
          <div className="flex shrink-0 flex-col items-center gap-2">
            <Orb
              mode={p.orbMode}
              label={`${INTERVIEWER_NAME}, AI interviewer: ${p.stateLabel}`}
              level={p.remoteLevel}
              className={hasCard ? "size-[84px] md:size-[120px]" : "size-[150px] md:size-[220px]"}
            />
            <span className={cn("font-semibold", hasCard ? "text-[14px]" : "text-[18px]")}>{INTERVIEWER_NAME}</span>
            <span role="status" className={cn("text-[13px]", p.orbMode === "speaking" ? "text-primary" : "text-ink-muted")}>{p.stateLabel}</span>
          </div>

          {p.paused && <MomentBlock />}
          {p.problem && <StageAlert message={p.problem} action="Reconnect" icon="repeat" onAction={p.onReconnect} />}
          {p.audioBlocked && connected && <StageAlert message={`Your browser paused ${INTERVIEWER_NAME}'s voice.`} action="Play audio" icon="speaker" onAction={p.onResumeAudio} />}

          <Captions
            size={captionSize}
            drawerOpen={drawerOpen}
            showQuestion={!hasCard}
            questionNumber={p.questionNumber}
            questionText={p.questionText}
            secondTry={p.secondTry}
            followUp={p.followUp}
            timerSec={hasCard ? null : sec(p.tryStartedAt)}
            ai={p.ai}
            you={p.you ? { text: p.you.text, live: p.candidateSpeaking } : null}
            mutedSpeech={p.mutedSpeech}
            hint={hint}
            notice={p.notice}
          />

          {p.card}
        </div>

        <SelfTile
          level={p.micLevel}
          speaking={p.candidateSpeaking}
          muted={p.muted}
          active={connected && !p.paused}
          className={cn(
            "absolute top-2.5 right-3 h-[68px] w-[92px] md:top-auto md:right-6 md:bottom-6 md:h-[124px] md:w-[200px]",
            drawerOpen && "md:right-[424px]",
          )}
        />

        {p.noisy && <NoisePill className={cn("absolute top-[86px] right-3 md:top-auto md:right-6 md:bottom-[166px]", drawerOpen && "md:right-[424px]")} />}

        {drawerOpen && <TranscriptDrawer entries={p.transcript} startedAt={p.callStartedAt} onClose={() => { setDrawerOpen(false); document.getElementById(TRANSCRIPT_TOGGLE_ID)?.focus(); }} />}
      </div>

      <CallControls
        connected={connected}
        muted={p.muted}
        paused={p.paused}
        pausePending={p.pausePending}
        repeatPending={p.repeatPending}
        canRepeat={!p.paused}
        transcriptOpen={drawerOpen}
        onToggleMute={onToggleMute}
        onTogglePause={p.onTogglePause}
        onRepeat={p.onRepeat}
        onToggleTranscript={() => setDrawerOpen((o) => !o)}
        onLeave={p.onLeave}
      />
    </>
  );
}
