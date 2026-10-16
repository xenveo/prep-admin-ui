"use client";

import { useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { getFocusable, useEscapeLayer, useFocusTrap, useIsClient } from "@/lib/use-focus-trap";
import { Icon } from "./icon";

export function Modal({
  open,
  onClose,
  title,
  titleId,
  width = 640,
  tabs,
  children,
  footerNote,
  footer,
  returnFocusRef,
  initialFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId?: string;
  width?: number;
  tabs?: ReactNode;
  children: ReactNode;
  footerNote?: ReactNode;
  footer: ReactNode;
  returnFocusRef?: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
}) {
  const autoId = useId();
  const headingId = titleId ?? autoId;
  const isClient = useIsClient();
  const dialogRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const active = open && isClient;

  useEscapeLayer(active, onClose);
  useFocusTrap({
    active,
    containerRef: dialogRef,
    returnFocusRef,
    // First field in the body for forms; falls back to the close button.
    getInitialFocus: () =>
      initialFocusRef?.current ?? (bodyRef.current ? getFocusable(bodyRef.current)[0] : null) ?? closeRef.current,
  });

  if (!active) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-scrim-modal p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        style={{ width }}
        className="flex max-h-[calc(100vh-32px)] max-w-full flex-col overflow-hidden rounded-panel border border-line bg-surface shadow-[var(--shadow-panel)]"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-6 pt-5 pb-4">
          <h2 id={headingId} className="m-0 text-lg leading-6 font-semibold tracking-[-0.01em] text-ink">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="relative inline-flex size-[34px] shrink-0 items-center justify-center rounded-lg border border-input-line text-ink-muted transition-colors duration-100 hover:border-neutral-line hover:text-ink after:absolute after:-inset-[5px] after:content-['']"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
        {tabs ? <div className="shrink-0 px-6">{tabs}</div> : <div className="shrink-0 border-b border-line" />}
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-line px-6 py-4">
          <div className="min-w-0 text-[13px] leading-5 text-ink-faint">{footerNote}</div>
          <div className="flex shrink-0 items-center gap-2">{footer}</div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
