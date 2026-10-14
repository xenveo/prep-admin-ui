"use client";

import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useIsClient } from "@/lib/use-focus-trap";

type Side = "top" | "right" | "bottom" | "left";
const GAP = 6;

const TRANSFORM: Record<Side, string> = {
  top: "translate(-50%, -100%)",
  bottom: "translate(-50%, 0)",
  left: "translate(-100%, -50%)",
  right: "translate(0, -50%)",
};

function anchorFor(rect: DOMRect, side: Side): { left: number; top: number } {
  switch (side) {
    case "top": return { left: rect.left + rect.width / 2, top: rect.top - GAP };
    case "bottom": return { left: rect.left + rect.width / 2, top: rect.bottom + GAP };
    case "left": return { left: rect.left - GAP, top: rect.top + rect.height / 2 };
    case "right": return { left: rect.right + GAP, top: rect.top + rect.height / 2 };
  }
}

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: ReactNode;
  children: ReactElement<{ "aria-describedby"?: string }>;
  side?: Side;
}) {
  const id = useId();
  const isClient = useIsClient();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const hasContent = content !== null && content !== undefined && content !== false && content !== "";

  const show = useCallback(() => {
    const el = wrapRef.current;
    if (el) setPos(anchorFor(el.getBoundingClientRect(), side));
  }, [side]);
  const hide = useCallback(() => setPos(null), []);

  // WCAG 1.4.13: dismissible with Esc without moving focus. Not a layer: it never swallows Esc.
  const visible = pos !== null;
  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPos(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible]);

  if (!hasContent) return children;

  const existing = children.props["aria-describedby"];
  const trigger = cloneElement(children, {
    "aria-describedby": existing ? `${existing} ${id}` : id,
  });

  return (
    <span
      ref={wrapRef}
      className="inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {trigger}
      {isClient
        ? createPortal(
            <div
              id={id}
              role="tooltip"
              style={{
                position: "fixed",
                left: pos?.left ?? 0,
                top: pos?.top ?? 0,
                transform: TRANSFORM[side],
                visibility: visible ? "visible" : "hidden",
              }}
              className={cn(
                "pointer-events-none z-[80] max-w-[260px] rounded-sm bg-ink px-2 py-1 text-xs leading-4 text-bg",
              )}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
