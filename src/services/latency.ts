/** Simulated network latency and defensive cloning for the mock services. */
export const LATENCY_MS = 120;

/** Deep copy so callers can never mutate the in-memory store. */
export function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Resolve with a clone of `produce()` after ~120ms. Errors thrown inside reject after the delay. */
export function respond<T>(produce: () => T, ms: number = LATENCY_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(clone(produce()));
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    }, ms);
  });
}
