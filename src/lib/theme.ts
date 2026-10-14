"use client";

import { useSyncExternalStore } from "react";
import { THEME_KEY } from "@/lib/theme-script";

export type Theme = "system" | "light" | "dark";

const listeners = new Set<() => void>();

function isTheme(v: unknown): v is Theme {
  return v === "system" || v === "light" || v === "dark";
}

export function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isTheme(v) ? v : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

export function setTheme(theme: Theme): void {
  try {
    if (theme === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage unavailable: theme still applies for this page view */
  }
  applyTheme(theme);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/** Current theme preference; "system" on the server and during hydration. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getStoredTheme, () => "system" as Theme);
}
