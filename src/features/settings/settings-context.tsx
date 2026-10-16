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
  /** header = primary button beside the page title (default); savebar = floating "unsaved changes" bar. */
  placement?: "header" | "savebar";
  /** Save bar only: shows a Discard button. */
  onDiscard?: () => void;
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
 * Registers the page's primary action (header button or save bar) from inside a section. Pass null for none.
 * The click handlers may change every render; only the visible fields re-register.
 */
export function useHeaderAction(action: HeaderAction | null): void {
  const { setAction } = useSettingsContext();
  const clickRef = useRef<(() => void) | null>(null);
  const discardRef = useRef<(() => void) | null>(null);
  const present = action !== null;
  const label = action?.label;
  const iconLeft = action?.iconLeft;
  const disabledReason = action?.disabledReason;
  const loading = action?.loading;
  const placement = action?.placement;
  const hasDiscard = Boolean(action?.onDiscard);

  useEffect(() => {
    clickRef.current = action ? action.onClick : null;
    discardRef.current = action?.onDiscard ?? null;
  });

  useEffect(() => {
    if (!present || label === undefined) {
      setAction(null);
      return;
    }
    setAction({
      label,
      iconLeft,
      disabledReason,
      loading,
      placement,
      onClick: () => clickRef.current?.(),
      onDiscard: hasDiscard ? () => discardRef.current?.() : undefined,
    });
    return () => setAction(null);
  }, [present, label, iconLeft, disabledReason, loading, placement, hasDiscard, setAction]);
}

export function SettingsProvider({ value, children }: { value: SettingsContextValue; children: ReactNode }) {
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
