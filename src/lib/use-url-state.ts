"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type UrlStateUpdates = Record<string, string | string[] | null>;

export type UrlState = {
  get(key: string): string | null;
  getAll(key: string): string[];
  /** Merge updates into the query string. null, "" or [] removes a key; an array writes repeated keys. */
  set(updates: UrlStateUpdates): void;
};

/**
 * Read and write URL search params. Writes use router.replace with scroll: false, so filters,
 * sort and open panels are deep-linkable without adding history entries.
 * Must render under <Suspense> (it calls useSearchParams).
 */
export function useUrlState(): UrlState {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const search = params.toString();

  // Latest query string, so two set() calls in one tick compose instead of overwriting.
  const latest = useRef(search);
  useEffect(() => {
    latest.current = search;
  }, [search]);

  const set = useCallback(
    (updates: UrlStateUpdates) => {
      const next = new URLSearchParams(latest.current);
      for (const [key, value] of Object.entries(updates)) {
        next.delete(key);
        if (value === null || value === "") continue;
        if (Array.isArray(value)) value.filter((v) => v !== "").forEach((v) => next.append(key, v));
        else next.set(key, value);
      }
      const qs = next.toString();
      latest.current = qs;
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  return useMemo<UrlState>(
    () => ({
      get: (key) => params.get(key),
      getAll: (key) => params.getAll(key),
      set,
    }),
    [params, set],
  );
}
