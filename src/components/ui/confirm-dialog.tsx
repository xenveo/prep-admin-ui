"use client";

import { useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useEscapeLayer, useFocusTrap, useIsClient } from "@/lib/use-focus-trap";
import { Button } from "./button";

export function ConfirmDialog({
  open,
  title,
  body,
  bullets,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
  returnFocusRef,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  bullets?: string[];
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "destructive";
  onConfirm: () => void;
  onCancel: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const titleId = useId();
  const bodyId = useId();
  const isClient = useIsClient();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const active = open && isClient;

  // Registered after any panel/modal behind it, so Esc cancels this dialog only.
  useEscapeLayer(active, onCancel);
  useFocusTrap({
    active,
    containerRef: dialogRef,
    returnFocusRef,
    getInitialFocus: () => (tone === "destructive" ? cancelRef.current : confirmRef.current),
  });

  if (!active) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim-modal p-4">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="flex w-[460px] max-w-full flex-col gap-2 rounded-md border border-line bg-surface p-5 shadow-[var(--shadow-panel)]"
      >
        <h2 id={titleId} className="m-0 text-base font-semibold leading-6 text-ink">
          {title}
        </h2>
        <div id={bodyId} className="text-[13px] leading-5 text-ink-muted">
          <div>{body}</div>
          {bullets && bullets.length > 0 ? (
            <ul className="m-0 mt-2 list-disc pl-5">
              {bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button ref={confirmRef} variant={tone === "destructive" ? "destructive" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
