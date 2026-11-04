"use client";

import { cn } from "@/lib/cn";
import { Icon } from "./icons";
import type { UseMicCheck } from "./use-mic-check";

const BARS = 24;
const MAX_H = 40;
const MIN_H = 4;

function Meter({ level, label }: { level: number; label: string }) {
  const live = level > 0.02;
  return (
    <div role="img" aria-label={`Microphone level: ${label}`} className="flex h-10 items-center gap-1">
      {Array.from({ length: BARS }, (_, i) => {
        // A fixed profile makes the middle bars taller, like a waveform.
        const shape = 0.3 + 0.7 * Math.sin(((i + 1) / (BARS + 1)) * Math.PI);
        const h = live ? Math.max(MIN_H, Math.round(level * shape * MAX_H)) : MIN_H;
        return (
          <span
            key={i}
            style={{ height: h }}
            className={cn("flex-1 rounded-[3px] transition-[height] duration-75 motion-reduce:transition-none", h > MIN_H ? "bg-primary" : "bg-line")}
          />
        );
      })}
    </div>
  );
}

function levelLabel(level: number) {
  return level > 0.25 ? "good" : level > 0.02 ? "low" : "no sound";
}

/** One-line microphone status for the lobby's mic card. */
function micStatusText(mic: UseMicCheck, heard: boolean) {
  switch (mic.status) {
    case "blocked":
      return { text: "Blocked. Allow microphone access.", tone: "warn" as const };
    case "unsupported":
      return { text: "No microphone found. Connect a microphone.", tone: "warn" as const };
    case "requesting":
      return { text: "Waiting for permission…", tone: "muted" as const };
    case "quiet":
      return { text: "We can't hear you", tone: "warn" as const };
    case "working":
      return heard
        ? { text: "We can hear you. Say something to test.", tone: "good" as const }
        : { text: "Listening… say a few words", tone: "muted" as const };
    case "idle":
      return heard ? { text: "Working", tone: "good" as const } : { text: "Say a few words", tone: "muted" as const };
  }
}

/** Dark well with the live level meter and status line; explains and offers a retry when the mic is blocked or missing. */
export function MicCheck({ mic, heard }: { mic: UseMicCheck; heard: boolean }) {
  const { status, level, request } = mic;
  const s = micStatusText(mic, heard);
  const failed = status === "blocked" || status === "unsupported";

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-[#0D1010] p-[18px]">
      {failed ? (
        <p className="m-0 text-[14px] leading-[22px] text-neutral-text">
          {status === "blocked"
            ? "PrepPilot can't use your microphone right now. Allow access in your browser, then retry the check."
            : "We couldn't find a microphone on this device. Connect a microphone or use a device that has one."}
        </p>
      ) : (
        <Meter level={level} label={levelLabel(level)} />
      )}
      <p
        role="status"
        className={cn(
          "m-0 flex items-center gap-2 text-[15px] font-semibold",
          s.tone === "good" ? "text-primary" : s.tone === "warn" ? "text-improve" : "text-ink-muted",
        )}
      >
        {s.tone === "good" && <Icon name="check" strokeWidth={2.8} className="size-4" />}
        {s.text}
      </p>
      {(failed || status === "idle") && (
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-[14px] font-semibold">
          <button type="button" onClick={request} className="cursor-pointer text-primary underline underline-offset-4">
            {failed ? "Retry microphone check" : "Start mic check"}
          </button>
          {status === "blocked" && (
            <a
              href="https://support.google.com/chrome/answer/2693767"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary underline underline-offset-4"
            >
              How to allow microphone access
              <Icon name="external" className="size-4" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
