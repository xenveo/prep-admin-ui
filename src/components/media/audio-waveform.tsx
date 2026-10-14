"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

function fmt(s: number) {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

const BARS = 56;

/** Mock audio player: no real file, playback is simulated with a timer. */
export function AudioPlayer({
  label,
  durationSeconds,
  className,
}: {
  label: string;
  durationSeconds: number;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  // Deterministic pseudo-random bar heights.
  const heights = useMemo(
    () => Array.from({ length: BARS }, (_, i) => 6 + Math.round(Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)) * 18)),
    [],
  );

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(
      () => {
        setTime((t) => {
          const next = t + 1;
          if (next >= durationSeconds) {
            setPlaying(false);
            return durationSeconds;
          }
          return next;
        });
      },
      1000,
    );
    return () => window.clearInterval(id);
  }, [playing, durationSeconds]);

  const seek = (s: number) => setTime(Math.max(0, Math.min(durationSeconds, s)));

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") seek(time + 5);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") seek(time - 5);
    else if (e.key === "Home") seek(0);
    else if (e.key === "End") seek(durationSeconds);
    else return;
    e.preventDefault();
  };

  const pct = durationSeconds > 0 ? (time / durationSeconds) * 100 : 0;
  const playedBars = Math.round((pct / 100) * BARS);

  return (
    <div className={cn("flex items-center gap-2.5 rounded-md border border-line bg-bg px-2.5 py-2", className)}>
      <button
        type="button"
        aria-label={`${playing ? "Pause" : "Play"} ${label} audio`}
        onClick={() => {
          if (!playing && time >= durationSeconds) setTime(0);
          setPlaying((p) => !p);
        }}
        className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 bg-primary text-on-primary"
      >
        <Icon name={playing ? "pause" : "play"} size={14} />
      </button>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={`Seek ${label} audio`}
        aria-valuemin={0}
        aria-valuemax={durationSeconds}
        aria-valuenow={Math.floor(time)}
        aria-valuetext={`${fmt(time)} of ${fmt(durationSeconds)}`}
        onKeyDown={onKey}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          if (r.width > 0) seek(((e.clientX - r.left) / r.width) * durationSeconds);
        }}
        className="flex h-7 min-w-0 flex-1 cursor-pointer items-center gap-[2px] overflow-hidden rounded-sm"
      >
        <span aria-hidden="true" className="flex h-full w-full items-center gap-[2px]">
          {heights.map((h, i) => (
            <span
              key={i}
              className="w-[3px] flex-none rounded-sm"
              style={{
                height: h,
                background: i < playedBars ? "var(--primary)" : "var(--ink-muted)",
                opacity: i < playedBars ? 1 : 0.45,
              }}
            />
          ))}
        </span>
      </div>
      <span className="shrink-0 text-[12px] text-ink-muted" aria-live="off">
        {fmt(time)} / {fmt(durationSeconds)}
      </span>
    </div>
  );
}
