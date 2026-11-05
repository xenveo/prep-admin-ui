"use client";

import { useEffect, useRef } from "react";
import { previewEventsUrl, type PreviewEvent } from "@/services/preview";

const EVENTS = new Set<string>(["attempt.received", "attempt.evaluated", "attempt.failed", "question.retry_skipped", "live.answer_done", "live.ended", "live.retry_chosen", "live.paused", "live.repeat"] satisfies PreviewEvent["type"][]);

/**
 * Session WebSocket (authenticated by the admin cookie). Events accelerate the session GETs (`reconcile`) and are
 * passed to `onEvent`; polling reconciles missed frames. Reconnects with backoff.
 */
export function useSessionEvents(sessionId: string, reconcile: () => Promise<unknown>, onEvent?: (event: PreviewEvent) => void) {
  const callback = useRef(reconcile);
  const handler = useRef(onEvent);
  useEffect(() => { callback.current = reconcile; handler.current = onEvent; }, [reconcile, onEvent]);
  useEffect(() => {
    let stopped = false;
    let socket: WebSocket | null = null;
    let retry = 0;
    let failures = 0;
    const seen = new Set<string>();
    const check = () => { void callback.current().catch(() => {}); };
    function connect() {
      if (stopped) return;
      socket = new WebSocket(previewEventsUrl(sessionId));
      socket.onopen = () => { failures = 0; check(); };
      socket.onmessage = (frame) => {
        if (typeof frame.data !== "string") return;
        try {
          const event: unknown = JSON.parse(frame.data);
          if (!event || typeof event !== "object" || !("type" in event) || typeof event.type !== "string" || !EVENTS.has(event.type)) return;
          // Attempt frames may be redelivered; live frames (for example two separate live.ended) legitimately repeat.
          if ("attemptId" in event) {
            if (seen.has(frame.data)) return;
            seen.add(frame.data);
            if (seen.size > 200) seen.delete(seen.values().next().value!);
          }
          handler.current?.(event as PreviewEvent);
          check();
        } catch { /* malformed frames do not affect polling */ }
      };
      socket.onclose = (event) => {
        if (stopped) return;
        if (event.code === 4401) {
          // The admin login expired: same handling as a 401 from the API client.
          stopped = true;
          window.dispatchEvent(new CustomEvent("preppilot:unauthorized"));
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/login?reason=session");
          return;
        }
        check();
        retry = window.setTimeout(connect, Math.min(30_000, 1000 * 2 ** Math.min(failures++, 5)));
      };
      socket.onerror = () => socket?.close();
    }
    connect();
    return () => { stopped = true; window.clearTimeout(retry); socket?.close(); };
  }, [sessionId]);
}
