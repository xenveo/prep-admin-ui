"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { PREVIEW_CONSENT } from "@/services/preview";
import { getCallPrefs, INTERVIEWER_NAME, setCallPrefs, type CaptionSize } from "./call-prefs";
import { Icon } from "./icons";
import { MicCheck } from "./mic-check";
import { useMicCheck } from "./use-mic-check";

/** Level above which we count you as heard. */
const HEARD_LEVEL = 0.15;
/** Rough length of one question: asking, answering, feedback and a possible second try. */
const MINUTES_PER_QUESTION = 3;

const EXPECT = [
  `${INTERVIEWER_NAME} asks questions out loud. They also appear as captions.`,
  "Answer naturally. You can interrupt her any time.",
  "You’ll get feedback after each answer, and can try again.",
];

const SELECT =
  "min-h-12 w-full cursor-pointer rounded-xl border border-input-line bg-[#161A19] px-3.5 text-[15px] font-medium text-ink [color-scheme:dark] disabled:cursor-default disabled:text-ink-muted";
const FIELD = "flex flex-col gap-1.5 text-[13px] leading-5 font-semibold text-ink-muted";

const noopSubscribe = () => () => {};
/** True when the browser can route audio to a chosen output device. */
function useCanPickSpeaker() {
  return useSyncExternalStore(
    noopSubscribe,
    () => typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype,
    () => false,
  );
}

let chimeUrl: string | null = null;
/** A short, soft two-note chime as a 16-bit mono WAV, built once in the browser. */
function chime(): string {
  if (chimeUrl) return chimeUrl;
  const rate = 22050;
  const n = Math.floor(rate * 1.1);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, n * 2, true);
  const notes: [freq: number, start: number][] = [[659.25, 0], [987.77, 0.16]]; // E5 then B5
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    let s = 0;
    for (const [f, start] of notes) {
      const dt = t - start;
      if (dt < 0) continue;
      const env = Math.min(1, dt / 0.008) * Math.exp(-dt * 4.5);
      s += env * (Math.sin(2 * Math.PI * f * dt) + 0.25 * Math.sin(4 * Math.PI * f * dt));
    }
    v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s * 0.3)) * 32767, true);
  }
  chimeUrl = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  return chimeUrl;
}

const SIZES: { value: CaptionSize; label: string; name: string; cls: string }[] = [
  { value: "s", label: "S", name: "Small", cls: "text-[13px]" },
  { value: "m", label: "M", name: "Medium", cls: "text-[15px]" },
  { value: "l", label: "L", name: "Large", cls: "text-[17px]" },
];

/** S / M / L radio group with roving focus: arrow keys move and select, Tab leaves the group. */
function CaptionSizePicker({ value, onChange }: { value: CaptionSize; onChange: (v: CaptionSize) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function onKeyDown(e: React.KeyboardEvent, i: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    const to = e.key === "Home" ? 0 : e.key === "End" ? SIZES.length - 1 : step ? (i + step + SIZES.length) % SIZES.length : -1;
    if (to < 0) return;
    e.preventDefault();
    onChange(SIZES[to].value);
    refs.current[to]?.focus();
  }
  return (
    <div className="flex items-center gap-2">
      <span id="caption-size-label" className="text-[13px] leading-5 text-ink-muted">Caption size</span>
      <div role="radiogroup" aria-labelledby="caption-size-label" className="inline-flex rounded-full bg-[#0D1010] p-[3px]">
        {SIZES.map((s, i) => {
          const on = s.value === value;
          return (
            <button
              key={s.value}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={s.name}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(s.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "flex min-h-8 min-w-9 cursor-pointer items-center justify-center rounded-full",
                s.cls,
                on ? "bg-line font-bold text-ink" : "text-ink-muted hover:text-ink",
              )}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Static "speaking" orb for the interviewer card. */
function InterviewerOrb() {
  return (
    <svg width="56" height="56" viewBox="0 0 300 300" aria-hidden="true" className="shrink-0">
      <circle cx="150" cy="150" r="130" fill="#5EEAD4" fillOpacity="0.12" />
      <circle cx="150" cy="150" r="96" fill="#5EEAD4" />
      <rect x="118" y="132" width="12" height="36" rx="6" fill="#042F2E" />
      <rect x="144" y="116" width="12" height="68" rx="6" fill="#042F2E" />
      <rect x="170" y="132" width="12" height="36" rx="6" fill="#042F2E" />
    </svg>
  );
}

function Notice({ tone, children }: { tone: "error" | "neutral"; children: string }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "m-0 rounded-xl border px-4 py-3 text-[14px] leading-[22px]",
        tone === "error" ? "border-[#7F1D1D] bg-[#2A1414] text-[#FCA5A5]" : "border-line bg-neutral-soft text-neutral-text",
      )}
    >
      {children}
    </p>
  );
}

function deviceLabel(d: MediaDeviceInfo, i: number, kind: string) {
  return d.label || `${kind} ${i + 1}`;
}

/**
 * The test interview's lobby (same as the candidate lobby): mic check with device and caption settings,
 * the interview card, consent, and Join. Fills the call overlay.
 */
export function Lobby({ roleName, previewHref, questions, resuming, archived, joining, error, onJoin }: {
  roleName: string;
  previewHref: string;
  /** Questions in this test; null hides the line. */
  questions: number | null;
  /** An unfinished test session is open. */
  resuming: boolean;
  archived: boolean;
  joining: boolean;
  error: string | null;
  onJoin: () => void;
}) {
  const [prefs] = useState(getCallPrefs);
  const [micId, setMicId] = useState(prefs.micId);
  const [speakerId, setSpeakerId] = useState(prefs.speakerId);
  const [captionSize, setCaptionSize] = useState(prefs.captionSize);
  const mic = useMicCheck(micId);
  const { request, status: micStatus } = mic;
  const canPickSpeaker = useCanPickSpeaker();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [playing, setPlaying] = useState(false);
  const testAudio = useRef<HTMLAudioElement | null>(null);
  const [heard, setHeard] = useState(false);
  const [consent, setConsent] = useState(false);
  const minutes = questions ? Math.max(5, Math.round((questions * MINUTES_PER_QUESTION) / 5) * 5) : 0;

  // Remember once we have heard you, even after the meter stops.
  if (!heard && mic.level > HEARD_LEVEL) setHeard(true);

  // Start the check on mount, and again on the new input whenever the chosen microphone changes.
  useEffect(() => { request(); }, [request]);

  // Device labels are only exposed once the browser has granted microphone access.
  const granted = micStatus === "working" || micStatus === "quiet";
  useEffect(() => {
    if (!granted || !navigator.mediaDevices?.enumerateDevices) return;
    let alive = true;
    const load = () => {
      navigator.mediaDevices.enumerateDevices().then((list) => { if (alive) setDevices(list); }).catch(() => {});
    };
    load();
    navigator.mediaDevices.addEventListener("devicechange", load);
    return () => {
      alive = false;
      navigator.mediaDevices.removeEventListener("devicechange", load);
    };
  }, [granted]);

  useEffect(() => () => { testAudio.current?.pause(); }, []);

  // The browser's own "default" / "communications" entries duplicate the "System default" option.
  const usable = (d: MediaDeviceInfo) => d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications";
  const inputs = devices.filter((d) => d.kind === "audioinput" && usable(d));
  const outputs = devices.filter((d) => d.kind === "audiooutput" && usable(d));
  const micValue = micId && inputs.some((d) => d.deviceId === micId) ? micId : "";
  const speakerValue = speakerId && outputs.some((d) => d.deviceId === speakerId) ? speakerId : "";

  function chooseMic(id: string) {
    const next = id || null;
    // Stop first so the old input's level can't count as hearing the new one; the effect restarts on `next`.
    mic.stop();
    setMicId(next);
    setHeard(false);
    setCallPrefs({ micId: next });
  }

  function chooseSpeaker(id: string) {
    const next = id || null;
    setSpeakerId(next);
    setCallPrefs({ speakerId: next });
  }

  function chooseCaptionSize(size: CaptionSize) {
    setCaptionSize(size);
    setCallPrefs({ captionSize: size });
  }

  async function playTestSound() {
    testAudio.current?.pause();
    const audio = new Audio(chime());
    testAudio.current = audio;
    audio.onended = () => setPlaying(false);
    setPlaying(true);
    try {
      if (canPickSpeaker && speakerValue) await audio.setSinkId(speakerValue);
      await audio.play();
    } catch {
      setPlaying(false);
    }
  }

  const blocked = !heard || !consent || joining || archived;
  const hint = archived ? "Archived roles can't be tested."
    : !heard ? "Say a few words so we know your mic works."
      : !consent ? "Tick the agreement to join."
        : null;

  function join() {
    if (blocked) return;
    mic.stop();
    testAudio.current?.pause();
    onJoin();
  }

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="flex min-h-full items-start justify-center px-4 pt-5 pb-8 md:items-center md:px-6 md:py-10">
        <div className="flex w-full max-w-[980px] flex-col gap-7">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-[10px] bg-primary text-on-primary">
                <Icon name="logo" strokeWidth={2.2} className="size-[18px]" />
              </span>
              <span className="text-[16px] font-semibold">PrepPilot</span>
            </span>
            <Link href={previewHref} className="text-[14px] font-semibold text-ink-muted no-underline hover:text-ink">Back to content preview</Link>
          </div>

          <h1 className="m-0 text-[24px] leading-tight font-semibold md:text-[30px]">
            {resuming ? "Ready to resume the test interview?" : "Ready to start the test interview?"}
          </h1>

          {(error || archived) && (
            <div className="flex flex-col gap-3">
              {error && <Notice tone="error">{error}</Notice>}
              {archived && <Notice tone="neutral">This role is archived, so test interviews can&apos;t be started. Restore the role to test it.</Notice>}
            </div>
          )}

          <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2">
            <section aria-labelledby="mic-h" className="flex flex-col gap-[18px] rounded-2xl border border-line bg-[#161A19] p-6">
              <h2 id="mic-h" className="m-0 text-[18px] font-semibold">Check your mic</h2>
              <MicCheck mic={mic} heard={heard} />
              <label className={FIELD}>
                Microphone
                <select value={micValue} onChange={(e) => chooseMic(e.target.value)} className={SELECT}>
                  <option value="">System default</option>
                  {inputs.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{deviceLabel(d, i, "Microphone")}</option>)}
                </select>
              </label>
              {canPickSpeaker && (
                <label className={FIELD}>
                  Speaker
                  <select value={speakerValue} onChange={(e) => chooseSpeaker(e.target.value)} className={SELECT}>
                    <option value="">System default</option>
                    {outputs.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{deviceLabel(d, i, "Speaker")}</option>)}
                  </select>
                </label>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => void playTestSound()}
                  className="min-h-8 cursor-pointer text-[14px] font-semibold text-primary underline underline-offset-4"
                >
                  {playing ? "Playing…" : "Play test sound"}
                </button>
                <CaptionSizePicker value={captionSize} onChange={chooseCaptionSize} />
              </div>
            </section>

            <section aria-labelledby="int-h" className="flex flex-col gap-5 rounded-2xl border border-line bg-[#161A19] p-6">
              <div className="flex flex-col gap-1">
                <span className="text-[13px] leading-5 text-ink-muted">Test interview · admin</span>
                <h2 id="int-h" className="m-0 text-[22px] leading-tight font-semibold">{roleName}</h2>
                {questions ? (
                  <span className="text-[14px] text-neutral-text">
                    {questions} {questions === 1 ? "question" : "questions"} · about {minutes} minutes
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-3.5 rounded-xl bg-[#0D1010] p-3.5">
                <InterviewerOrb />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[16px] font-semibold">{INTERVIEWER_NAME} · Interviewer</span>
                  <span className="text-[13px] leading-5 text-ink-muted">Calm, friendly voice · AI</span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <h3 className="m-0 text-[13px] leading-5 font-semibold text-ink-muted">What to expect</h3>
                <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {EXPECT.map((t, i) => (
                    <li key={i} className="flex gap-2.5 text-[15px] leading-[23px] text-neutral-text">
                      <span aria-hidden className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-primary-soft text-[12px] font-bold text-primary-text">{i + 1}</span>
                      {t}
                    </li>
                  ))}
                </ol>
              </div>

              <label
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border bg-[#0D1010] p-3.5",
                  consent ? "border-primary-line" : "border-line",
                )}
              >
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 size-[18px] shrink-0 cursor-pointer accent-primary"
                />
                <span className="text-[14px] leading-[22px] text-pretty text-neutral-text">{PREVIEW_CONSENT}</span>
              </label>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  aria-disabled={blocked || undefined}
                  aria-describedby={hint ? "join-hint" : undefined}
                  onClick={join}
                  className={cn(
                    "min-h-[52px] w-full rounded-xl text-[17px] font-bold",
                    blocked ? "cursor-not-allowed bg-[#2C3331] text-ink-muted" : "cursor-pointer bg-primary text-on-primary hover:bg-primary/90",
                    joining && "cursor-wait",
                  )}
                >
                  {joining ? "Joining…" : resuming ? "Resume test interview" : "Join test interview"}
                </button>
                {hint && <p id="join-hint" className="m-0 text-center text-[13px] leading-5 text-ink-muted">{hint}</p>}
                <p className="m-0 text-center text-[13px] leading-5 text-ink-muted">Captions are on. Your voice is streamed live and never recorded.</p>
                <p className="m-0 text-center text-[13px] leading-5 text-ink-muted">Test sessions are excluded from candidate reports and statistics.</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
