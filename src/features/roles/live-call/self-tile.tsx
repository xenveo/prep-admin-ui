"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icons";
import { useReducedMotion } from "./use-reduced-motion";

const BARS = 14;
/** Below md only the newest bars fit. */
const COMPACT_BARS = 9;
const STEP_MS = 90;

/**
 * Your own tile: a rolling waveform of your mic (newest on the right). An interval writes
 * bar heights to the DOM, so the waveform never re-renders the call.
 */
export function SelfTile({ level, speaking, muted, active, className }: {
  level: () => number;
  speaking: boolean;
  muted: boolean;
  /** Connected; the waveform rests otherwise. */
  active: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const bars = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (muted || !active) return;
    const history: number[] = Array(BARS).fill(0);
    const els = bars.current;
    const paint = () => els.forEach((el, i) => {
      if (!el) return;
      el.style.height = `${4 + history[i] * 30}px`;
      el.style.backgroundColor = history[i] > 0 ? "#5EEAD4" : "#4B5563";
    });
    const timer = window.setInterval(() => {
      const l = level();
      // Reduced motion: every bar shows the current level instead of scrolling.
      if (reduced) history.fill(l);
      else { history.shift(); history.push(l); }
      paint();
    }, STEP_MS);
    return () => { clearInterval(timer); history.fill(0); paint(); };
  }, [level, muted, active, reduced]);

  const state = muted ? "Muted" : speaking ? "Speaking" : "";
  return (
    <div
      aria-label={muted ? "You, muted" : speaking ? "You, speaking" : "You"}
      className={cn(
        "z-[2] flex flex-col justify-between rounded-[14px] bg-[#1E2322] px-2.5 py-2 md:px-3.5 md:py-3",
        speaking && !muted ? "border-2 border-primary" : "border border-line",
        className,
      )}
    >
      <span aria-hidden className="flex flex-1 items-center justify-center gap-[3px]">
        {muted ? (
          <Icon name="micOff" className="size-[26px] text-ink" />
        ) : (
          Array.from({ length: BARS }, (_, i) => (
            <span
              key={i}
              ref={(el) => { bars.current[i] = el; }}
              className={cn("h-1 w-[3px] rounded-[3px] bg-[#4B5563] md:w-[5px]", i < BARS - COMPACT_BARS && "max-md:hidden")}
            />
          ))
        )}
      </span>
      <span className="flex items-center justify-between text-[12px] font-semibold">
        <span>You</span>
        <span className={muted ? "text-improve-text" : "text-primary"}>{state}</span>
      </span>
    </div>
  );
}
