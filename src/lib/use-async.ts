"use client";

import { useCallback, useEffect, useState } from "react";

type Settled<T> = { tick: number; deps: unknown[]; data?: T; error: Error | null };

function sameDeps(a: unknown[], b: unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
}

/**
 * Run an async function on mount and whenever `deps` change or `reload()` is called.
 * `loading` is true until the result for the current deps arrives. `data` keeps the previous
 * value while reloading so tables don't flash empty. Stale responses are ignored.
 */
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[],
): { data: T | undefined; error: Error | null; loading: boolean; reload: () => void } {
  const [tick, setTick] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fn().then(
      (data) => {
        if (!cancelled) setSettled({ tick, deps, data, error: null });
      },
      (err: unknown) => {
        if (!cancelled) {
          setSettled((prev) => ({
            tick,
            deps,
            data: prev?.data,
            error: err instanceof Error ? err : new Error(String(err)),
          }));
        }
      },
    );
    return () => {
      cancelled = true;
    };
    // The caller owns the dependency list; `fn` is intentionally read at effect time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const current = settled !== null && settled.tick === tick && sameDeps(settled.deps, deps);

  return {
    data: settled?.data,
    error: current ? settled.error : null,
    loading: !current,
    reload,
  };
}
