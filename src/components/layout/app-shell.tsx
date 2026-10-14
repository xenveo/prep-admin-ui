"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar, type NavKey } from "@/components/layout/sidebar";
import { ToastProvider } from "@/components/ui/toast";

const STORAGE_KEY = "preppilot.sidebar";
const NARROW_QUERY = "(max-width: 1279.98px)";

const listeners = new Set<() => void>();

function readPref(): "collapsed" | "expanded" | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "collapsed" || v === "expanded" ? v : null;
  } catch {
    return null;
  }
}

function writePref(v: "collapsed" | "expanded") {
  try {
    localStorage.setItem(STORAGE_KEY, v);
  } catch {
    /* storage unavailable: preference lasts for this page view only */
  }
  listeners.forEach((l) => l());
}

function subscribePref(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function subscribeNarrow(cb: () => void) {
  const mq = window.matchMedia(NARROW_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function activeKey(pathname: string): NavKey | null {
  const seg = pathname.split("/")[1];
  return seg === "candidates" || seg === "roles" || seg === "reports" || seg === "settings" ? seg : null;
}

const SESSION_ROUTE = /^\/candidates\/[^/]+\/sessions\/[^/]+/;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pref = useSyncExternalStore(subscribePref, readPref, () => null);
  const narrow = useSyncExternalStore(
    subscribeNarrow,
    () => window.matchMedia(NARROW_QUERY).matches,
    () => false,
  );
  // On the session review route the sidebar starts collapsed and a toggle there is not persisted.
  const [sessionOverride, setSessionOverride] = useState<boolean | null>(null);
  const isSession = SESSION_ROUTE.test(pathname);

  const collapsed = isSession
    ? (sessionOverride ?? true)
    : pref
      ? pref === "collapsed"
      : narrow;

  // The toast is portalled to <body>, so the offset is set on <html> where it inherits.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      "--toast-left",
      `calc(var(${collapsed ? "--sidebar-width-collapsed" : "--sidebar-width"}) + 32px)`,
    );
    return () => {
      root.style.removeProperty("--toast-left");
    };
  }, [collapsed]);

  function toggle() {
    if (isSession) setSessionOverride(!collapsed);
    else writePref(collapsed ? "expanded" : "collapsed");
  }

  return (
    <ToastProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
      >
        Skip to main content
      </a>
      <div className="flex min-h-screen overflow-x-clip">
        <Sidebar active={activeKey(pathname)} collapsed={collapsed} onToggle={toggle} />
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
