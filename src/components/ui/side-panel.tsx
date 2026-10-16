"use client";

import { useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useEscapeLayer, useFocusTrap, useIsClient } from "@/lib/use-focus-trap";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export function SidePanel({
  open,
  onClose,
  titleId,
  header,
  headerActions,
  children,
  footer,
  returnFocusRef,
  scrimClassName,
}: {
  open: boolean;
  onClose: () => void;
  titleId: string;
  header: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  returnFocusRef?: RefObject<HTMLElement | null>;
  scrimClassName?: string;
}) {
  const isClient = useIsClient();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const active = open && isClient;

  // Inner layers (Menu, ConfirmDialog) register later, so they receive Esc first.
  useEscapeLayer(active, onClose);
  useFocusTrap({ active, containerRef: panelRef, returnFocusRef, getInitialFocus: () => closeRef.current });

  if (!active) return null;

  return createPortal(
    <>
      {/* Scrim is a plain div: no tabindex, never takes focus, so arrow keys on the list still work. */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn("fixed inset-0 z-40 bg-scrim-panel", scrimClassName)}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-labelledby={titleId}
        style={{ width: "var(--panel-width)" }}
        className="fixed bottom-0 right-0 top-0 z-40 flex max-w-full flex-col border-l border-line bg-surface-sunken shadow-[var(--shadow-panel)]"
      >
        <div className="flex shrink-0 items-center gap-3.5 border-b border-line px-6 py-5">
          <div className="min-w-0 flex-1">{header}</div>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <button
              ref={closeRef}
              type="button"
              aria-label="Close panel"
              onClick={onClose}
              className="relative inline-flex size-[34px] items-center justify-center rounded-lg border border-input-line text-ink-muted hover:border-neutral-line hover:text-ink after:absolute after:-inset-1.5 after:content-['']"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
        {footer ? <div className="shrink-0 border-t border-line bg-surface-sunken px-6 py-3">{footer}</div> : null}
      </aside>
    </>,
    document.body,
  );
}
