"use client";

import { useEffect, useRef } from "react";

const EVENT = "preppilot:role-changed";

/** Call after a mutation that changes a role's counts/status (cards, questions, approval) so the role editor header and tabs refetch. */
export function emitRoleChanged(roleId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { roleId } }));
}

/** Run `callback` whenever the given role changes. */
export function useRoleChanged(roleId: string, callback: () => void): void {
  const cb = useRef(callback);
  useEffect(() => {
    cb.current = callback;
  });
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent<{ roleId: string }>).detail?.roleId === roleId) cb.current();
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, [roleId]);
}
