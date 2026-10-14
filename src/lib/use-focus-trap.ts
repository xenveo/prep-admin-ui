"use client";

import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";

const noopSubscribe = () => () => {};

/** False during SSR and the first client render, true afterwards. Gate portals with it. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/* ------------------------------------------------------------------ */
/* Escape layer stack: Esc closes the innermost layer only.            */
/* Menu -> ConfirmDialog -> Modal / SidePanel (later-opened = inner).   */
/* ------------------------------------------------------------------ */

type Layer = { id: symbol; handler: () => void };
const layers: Layer[] = [];

function onDocumentKeyDown(e: KeyboardEvent) {
  if (e.key !== "Escape" || e.isComposing) return;
  const top = layers[layers.length - 1];
  if (!top) return;
  // Capture phase: nothing behind the top layer (rows, panels, parents) sees this Esc.
  e.stopPropagation();
  e.preventDefault();
  top.handler();
}

function pushLayer(layer: Layer) {
  if (layers.length === 0) document.addEventListener("keydown", onDocumentKeyDown, true);
  layers.push(layer);
}

function removeLayer(id: symbol) {
  const i = layers.findIndex((l) => l.id === id);
  if (i >= 0) layers.splice(i, 1);
  if (layers.length === 0) document.removeEventListener("keydown", onDocumentKeyDown, true);
}

/** Registers `onEscape` as a layer while `active`. The most recently activated layer wins. */
export function useEscapeLayer(active: boolean, onEscape: () => void) {
  const handlerRef = useRef(onEscape);
  useEffect(() => {
    handlerRef.current = onEscape;
  });
  useEffect(() => {
    if (!active) return;
    const id = Symbol("layer");
    pushLayer({ id, handler: () => handlerRef.current() });
    return () => removeLayer(id);
  }, [active]);
}

/* ------------------------------------------------------------------ */
/* Focus trap + focus return                                           */
/* ------------------------------------------------------------------ */

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[contenteditable="true"],[tabindex]:not([tabindex="-1"])';

export function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0 && el.getAttribute("aria-hidden") !== "true",
  );
}

export type FocusTrapOptions = {
  /** Pass `open && isClient` so the container exists when the effect runs. */
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  /** Element to focus on close. Falls back to the element focused before opening. */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** Element to focus on open. Falls back to the first focusable inside the container. */
  getInitialFocus?: () => HTMLElement | null | undefined;
  /** Cycle Tab/Shift+Tab inside the container while focus is inside it (default true). */
  trap?: boolean;
};

export function useFocusTrap(options: FocusTrapOptions) {
  const optsRef = useRef(options);
  useEffect(() => {
    optsRef.current = options;
  });
  const { active } = options;

  useEffect(() => {
    if (!active) return;
    const container = optsRef.current.containerRef.current;
    if (!container) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const initial = optsRef.current.getInitialFocus?.() ?? getFocusable(container)[0] ?? container;
    if (initial === container && !container.hasAttribute("tabindex")) container.tabIndex = -1;
    initial.focus({ preventScroll: true });

    // Native listener: React synthetic events bubble through portals, native ones do not.
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || optsRef.current.trap === false || !container) return;
      const items = getFocusable(container);
      if (items.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (e.shiftKey && (current === first || current === container)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    }
    container.addEventListener("keydown", onKeyDown);

    return () => {
      container.removeEventListener("keydown", onKeyDown);
      const target = optsRef.current.returnFocusRef?.current;
      const now = document.activeElement;
      const lost = !now || now === document.body || !now.isConnected;
      if (target && target.isConnected) target.focus({ preventScroll: true });
      else if (lost && previous && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [active]);
}
