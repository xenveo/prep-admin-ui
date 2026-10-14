"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import type { IconName } from "@/components/ui/icon";
import type { Admin } from "@/lib/types";


export type HeaderAction = {
  label: string;
  iconLeft?: IconName;
  onClick: () => void;
  /** Keeps the button focusable but inert, with a tooltip explaining why. */
  disabledReason?: string;
  /** Shows a busy state; the button does nothing while true. */
  loading?: boolean;
};

export type SettingsContextValue = {
  /** undefined while loading. */
  admin: Admin | undefined;
  setAction: (a: HeaderAction | null) => void;
};

export const SettingsContext = createContext<SettingsContextValue>({ admin: undefined, setAction: () => {} });

export function useSettingsContext(): SettingsContextValue {
  return useContext(SettingsContext);
}

/**
 * Registers the page header's primary button from inside a section. Pass null for none.
 * The click handler may change every render; only the visible fields re-register.
 */
export function useHeaderAction(action: HeaderAction | null): void {
  const { setAction } = useSettingsContext();
  const clickRef = useRef<(() => void) | null>(null);
  const present = action !== null;
  const label = action?.label;
  const iconLeft = action?.iconLeft;
  const disabledReason = action?.disabledReason;
  const loading = action?.loading;

  useEffect(() => {
    clickRef.current = action ? action.onClick : null;
  });

  useEffect(() => {
    if (!present || label === undefined) {
      setAction(null);
      return;
    }
    setAction({ label, iconLeft, disabledReason, loading, onClick: () => clickRef.current?.() });
    return () => setAction(null);
  }, [present, label, iconLeft, disabledReason, loading, setAction]);
}

export function SettingsProvider({ value, children }: { value: SettingsContextValue; children: ReactNode }) {
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
