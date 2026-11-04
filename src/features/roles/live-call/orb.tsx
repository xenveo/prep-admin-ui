"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { useReducedMotion } from "./use-reduced-motion";

export type OrbMode = "speaking" | "listening" | "waiting" | "offline";

type Ring = { r: number; fill: string; fo: number; stroke: string; so: number; sw: number; dash?: string };
const MODES: Record<OrbMode, { rings: Ring[]; core: string; bars: number[]; bar: string }> = {
  speaking: {
    rings: [
      { r: 150, fill: "#5EEAD4", fo: 0.06, stroke: "#5EEAD4", so: 0.18, sw: 2 },
      { r: 128, fill: "#5EEAD4", fo: 0.08, stroke: "#5EEAD4", so: 0.35, sw: 2 },
      { r: 106, fill: "#5EEAD4", fo: 0.12, stroke: "#5EEAD4", so: 0.6, sw: 2 },
    ],
    core: "#5EEAD4", bars: [30, 64, 84, 54, 26], bar: "#042F2E",
  },
  listening: {
    rings: [
      { r: 132, fill: "#5EEAD4", fo: 0.07, stroke: "none", so: 0, sw: 0 },
      { r: 108, fill: "#5EEAD4", fo: 0.12, stroke: "none", so: 0, sw: 0 },
    ],
    core: "#5EEAD4", bars: [10, 16, 22, 16, 10], bar: "#042F2E",
  },
  waiting: { rings: [{ r: 118, fill: "#5EEAD4", fo: 0.08, stroke: "none", so: 0, sw: 0 }], core: "#5EEAD4", bars: [10, 10, 10, 10, 10], bar: "#042F2E" },
  offline: { rings: [{ r: 110, fill: "none", fo: 0, stroke: "#6B7280", so: 0.8, sw: 2, dash: "4 8" }], core: "#4B5563", bars: [10, 10, 10, 10, 10], bar: "#9CA3AF" },
};
const barX = (i: number) => 150 - 5.5 + (i - 2) * 20;

/**
 * The interviewer's avatar. While speaking, its bars and rings follow the interviewer's real voice level:
 * a requestAnimationFrame loop writes to the SVG directly, so nothing re-renders per frame. Static under
 * reduced motion.
 */
export function Orb({ mode, label, level, className }: { mode: OrbMode; label: string; level: () => number; className?: string }) {
  const reduced = useReducedMotion();
  const rings = useRef<SVGGElement>(null);
  const bars = useRef<(SVGRectElement | null)[]>([]);
  const m = MODES[mode];

  useEffect(() => {
    if (mode !== "speaking" || reduced) return;
    const base = MODES.speaking.bars;
    let smooth = 0;
    let frame = requestAnimationFrame(function tick() {
      const target = level();
      smooth += (target - smooth) * (target > smooth ? 0.5 : 0.12);
      base.forEach((b, i) => {
        const el = bars.current[i];
        if (!el) return;
        // Quiet: short bars; loud: up to ~1.3× the resting shape, capped inside the core.
        const h = Math.min(120, 10 + (b - 10) * (0.35 + smooth));
        el.setAttribute("height", h.toFixed(1));
        el.setAttribute("y", (150 - h / 2).toFixed(1));
      });
      if (rings.current) rings.current.style.transform = `scale(${(1 + smooth * 0.06).toFixed(3)})`;
      frame = requestAnimationFrame(tick);
    });
    const barEls = bars.current;
    const ringEl = rings.current;
    return () => {
      cancelAnimationFrame(frame);
      base.forEach((b, i) => { barEls[i]?.setAttribute("height", String(b)); barEls[i]?.setAttribute("y", String(150 - b / 2)); });
      if (ringEl) ringEl.style.transform = "";
    };
  }, [mode, reduced, level]);

  return (
    <svg viewBox="0 0 300 300" role="img" aria-label={label} className={cn("shrink-0 overflow-visible", mode === "offline" && "opacity-70", className)}>
      <g ref={rings} style={{ transformOrigin: "150px 150px" }}>
        {m.rings.map((r) => (
          <circle key={r.r} cx="150" cy="150" r={r.r} fill={r.fill} fillOpacity={r.fo} stroke={r.stroke} strokeOpacity={r.so} strokeWidth={r.sw} strokeDasharray={r.dash ?? "none"} />
        ))}
      </g>
      <circle cx="150" cy="150" r="74" fill={m.core} />
      {m.bars.map((h, i) => (
        // Keyed by mode so a mode change mounts fresh bars instead of racing the animation's cleanup.
        <rect key={`${mode}-${i}`} ref={(el) => { bars.current[i] = el; }} x={barX(i)} y={150 - h / 2} width="11" height={h} rx="5.5" fill={m.bar} />
      ))}
    </svg>
  );
}
