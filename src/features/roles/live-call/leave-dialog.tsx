"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useEscapeLayer, useFocusTrap } from "@/lib/use-focus-trap";

const BTN = "min-h-12 cursor-pointer rounded-xl px-[18px] text-[15px] font-semibold disabled:cursor-wait disabled:opacity-70";
const SECONDARY = "border border-neutral-line bg-transparent text-ink hover:bg-white/5";
const DANGER = "bg-[#B91C1C] text-white hover:bg-[#991B1B]";
const LINK = "relative cursor-pointer text-[14px] font-semibold after:absolute after:-inset-x-1 after:-inset-y-3 hover:opacity-80 disabled:cursor-wait disabled:opacity-60";

type Action = "leave" | "abandon" | "preview";

/**
 * "Leave now?" for a test interview: Leave hangs up and keeps the answers so the test can be resumed. The
 * admin-only section abandons the test session (its answers are discarded) or returns to the content preview.
 */
export function LeaveDialog({ open, onClose, questionNumber, onLeave, onAbandon, onBackToPreview }: {
  open: boolean;
  onClose: () => void;
  questionNumber: number;
  onLeave: () => Promise<void>;
  onAbandon: () => Promise<void>;
  onBackToPreview: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<Action | null>(null);
  const titleId = useId();
  const bodyId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const stay = useRef<HTMLButtonElement>(null);
  const close = () => { if (!busy) onClose(); };

  useEscapeLayer(open, close);
  useFocusTrap({ active: open, containerRef: dialog, getInitialFocus: () => stay.current });

  if (!open) return null;

  async function run(kind: Action, action: () => Promise<void>) {
    if (busy) return;
    setBusy(kind);
    try { await action(); } finally { setBusy(null); }
  }

  return (
    <div className="fixed inset-0 z-[5] flex items-center justify-center bg-black/60 p-4" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="flex w-[440px] max-w-full flex-col gap-4 rounded-2xl border border-line bg-[#161A19] p-6 text-ink"
      >
        <h2 id={titleId} className="m-0 text-[20px] leading-tight font-semibold">Leave now?</h2>
        <p id={bodyId} className="m-0 text-[15px] leading-[23px] text-neutral-text">
          Your answers so far are saved. You can pick up from question {questionNumber} later.
        </p>
        <div className="flex flex-wrap justify-end gap-2.5">
          <button ref={stay} type="button" disabled={!!busy} onClick={close} className={cn(BTN, SECONDARY)}>Stay in interview</button>
          <button type="button" disabled={!!busy} onClick={() => void run("leave", onLeave)} className={cn(BTN, DANGER)}>
            {busy === "leave" ? "Leaving…" : "Leave"}
          </button>
        </div>
        <div className="flex flex-col gap-1.5 border-t border-line pt-3.5">
          <span className="text-[12px] font-semibold text-ink-muted">Test mode (admins)</span>
          <div className="flex flex-wrap justify-between gap-3">
            <button type="button" disabled={!!busy} onClick={() => void run("abandon", onAbandon)} className={cn(LINK, "text-error")}>
              {busy === "abandon" ? "Abandoning…" : "Abandon test interview"}
            </button>
            <button type="button" disabled={!!busy} onClick={() => void run("preview", onBackToPreview)} className={cn(LINK, "text-neutral-text")}>
              {busy === "preview" ? "Leaving…" : "Back to content preview"}
            </button>
          </div>
          <span className="text-[12px] text-ink-muted">Abandoning discards this test session’s answers.</span>
        </div>
      </div>
    </div>
  );
}
