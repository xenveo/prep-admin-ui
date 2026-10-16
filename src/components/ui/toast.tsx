"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useIsClient } from "@/lib/use-focus-trap";
import { Icon } from "./icon";

export type ToastInput = { title: string; detail?: string; action?: { label: string; onClick?: () => void; href?: string } };
type ToastItem = ToastInput & { id: number };

const AUTO_DISMISS_MS = 8000;
const MAX_VISIBLE = 3;

const ToastContext = createContext<{ show(t: ToastInput): void }>({ show: () => {} });

export function useToast(): { show(t: ToastInput): void } {
  return useContext(ToastContext);
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = window.setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [paused, toast.id, onDismiss]);

  const actionClass = "mt-1 inline-flex w-fit text-xs font-semibold text-toast-text underline underline-offset-2";
  const { action } = toast;

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pointer-events-auto flex w-[380px] max-w-full items-start gap-2.5 rounded-card bg-toast px-4 py-3.5 text-toast-text shadow-[var(--shadow-panel)]"
    >
      <Icon name="check-circle" size={18} className="mt-0.5 text-toast-icon" />
      <div className="flex min-w-0 flex-1 flex-col text-sm leading-5">
        <span className="font-semibold">{toast.title}</span>
        {toast.detail ? <span className="text-xs leading-4 opacity-85">{toast.detail}</span> : null}
        {action?.href ? (
          <Link href={action.href} className={actionClass} onClick={() => { action.onClick?.(); onDismiss(toast.id); }}>
            {action.label}
          </Link>
        ) : action ? (
          <button type="button" className={actionClass} onClick={() => { action.onClick?.(); onDismiss(toast.id); }}>
            {action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
        className="-mr-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-toast-text opacity-80 hover:opacity-100"
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const isClient = useIsClient();

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback((t: ToastInput) => {
    const id = nextId.current++;
    setToasts((list) => [...list, { ...t, id }].slice(-MAX_VISIBLE));
  }, []);
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {isClient
        ? createPortal(
            // Persistent polite live region; cards are announced as they are inserted.
            // Left edge = main column (sidebar + 32px). AppShell may override --toast-left.
            <div
              role="status"
              aria-live="polite"
              style={{ left: "var(--toast-left, calc(var(--sidebar-width) + 32px))" }}
              className="pointer-events-none fixed bottom-6 z-[100] flex max-w-[calc(100vw-32px)] flex-col gap-2"
            >
              {toasts.map((t) => (
                <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}
