"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { INTERVIEWER_NAME } from "./call-prefs";
import { Icon } from "./icons";

/** Never made inert: not rendered content, or the Next.js dev overlay. */
const KEEP_INTERACTIVE = new Set(["SCRIPT", "STYLE", "TEMPLATE", "LINK", "META", "NOSCRIPT", "NEXTJS-PORTAL"]);

/**
 * Full-screen dark container for the lobby, the call and the summary, over the admin shell (Meet-style,
 * no app chrome). While it is open everything else on the page is inert and the page does not scroll.
 * `focusKey` changes when the screen inside changes; focus then returns to the overlay if it was lost.
 */
export function CallOverlay({ focusKey, children }: { focusKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const overlay = ref.current;
    if (!overlay) return;
    // Siblings of the overlay and of each of its ancestors: the sidebar, the role header, the skip link, ...
    const made: HTMLElement[] = [];
    for (let node: HTMLElement = overlay; node !== document.body && node.parentElement; node = node.parentElement) {
      for (const sibling of Array.from(node.parentElement.children)) {
        if (sibling === node || !(sibling instanceof HTMLElement) || sibling.inert || KEEP_INTERACTIVE.has(sibling.tagName)) continue;
        sibling.inert = true;
        made.push(sibling);
      }
    }
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      made.forEach((el) => { el.inert = false; });
      root.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    const overlay = ref.current;
    const active = document.activeElement;
    if (overlay && (!active || active === document.body || !overlay.contains(active))) overlay.focus({ preventScroll: true });
  }, [focusKey]);

  return (
    <div ref={ref} tabIndex={-1} className="call-dark fixed inset-0 z-[60] flex flex-col bg-[#0D1010] text-ink outline-none">
      {children}
    </div>
  );
}

/** Centred message for loading, errors and finishing; `busy` shows a spinner. */
export function CallMessage({ title, body, busy, tone = "neutral", children }: {
  title: string;
  body?: ReactNode;
  busy?: boolean;
  tone?: "neutral" | "error";
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-12">
      <div role={tone === "error" ? "alert" : "status"} className="flex max-w-[460px] flex-col items-center gap-3 text-center">
        {busy && <Spinner className="mb-2 size-8" />}
        <h1 className="m-0 text-[22px] leading-tight font-semibold">{title}</h1>
        {body && <p className="m-0 text-[15px] leading-[23px] text-neutral-text">{body}</p>}
        {children && <div className="mt-3 flex flex-wrap justify-center gap-3">{children}</div>}
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cn("motion-safe:animate-spin", className)}>
      <circle cx="12" cy="12" r="9" stroke="#4B5563" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="#E7E9E4" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export const callButton = {
  primary: "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-semibold text-on-primary no-underline hover:bg-primary/90 disabled:cursor-wait disabled:opacity-70",
  secondary: "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-neutral-line bg-transparent px-5 text-[15px] font-semibold text-ink no-underline hover:bg-white/5 disabled:cursor-wait disabled:opacity-70",
};

/** Top-centre pill while the call reconnects by itself. */
export function ReconnectPill() {
  return (
    <div role="status" className="absolute top-2 left-1/2 z-[4] flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-2.5 rounded-full border border-neutral-line bg-neutral-soft px-4 py-2.5 text-[14px] md:whitespace-nowrap">
      <Spinner className="size-4 shrink-0" />
      <span><strong className="font-semibold">Reconnecting…</strong> <span className="text-ink-muted">Your scored answers are saved.</span></span>
    </div>
  );
}

export function NoisePill({ className }: { className?: string }) {
  return (
    <div role="status" className={cn("z-[2] flex items-center gap-2 rounded-full bg-improve-soft px-3 py-2 text-[13px] font-semibold text-improve-text", className)}>
      <Icon name="noise" strokeWidth={2.2} className="size-3.5 shrink-0" />
      Lots of background noise. Headphones help.
    </div>
  );
}

/** Shown while the call is paused. */
export function MomentBlock() {
  return (
    <div role="status" className="flex shrink-0 flex-col items-center gap-1.5 rounded-2xl bg-primary-soft px-[22px] py-3.5 text-center">
      <span className="text-[20px] font-semibold text-ink">Take your time</span>
      <span className="text-[14px] text-primary-text">{INTERVIEWER_NAME} will wait. Press Resume when you&apos;re ready.</span>
    </div>
  );
}

/** Inline block on the stage for a problem that needs you (reconnect, play audio). */
export function StageAlert({ message, action, onAction, icon }: { message: string; action: string; onAction: () => void; icon: "repeat" | "speaker" }) {
  return (
    <div role="alert" className="flex w-full max-w-[560px] shrink-0 flex-col items-center gap-3 rounded-2xl border border-line bg-[#161A19] px-5 py-4 text-center md:flex-row md:text-left">
      <p className="m-0 flex-1 text-[15px] leading-[23px] text-neutral-text">{message}</p>
      <button type="button" onClick={onAction} className={callButton.primary}>
        <Icon name={icon} className="size-[18px]" />
        {action}
      </button>
    </div>
  );
}
