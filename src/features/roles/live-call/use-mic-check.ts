"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type MicStatus = "idle" | "requesting" | "working" | "quiet" | "blocked" | "unsupported";

export interface UseMicCheck {
  status: MicStatus;
  /** Smoothed input level, 0..1. */
  level: number;
  /** Starts (or restarts) the check on the hook's `deviceId`. */
  request: () => void;
  stop: () => void;
}

const QUIET_AFTER_MS = 4000;
const SOUND_THRESHOLD = 0.04;

/**
 * Microphone permission and live level meter. Releases every track on stop and on unmount.
 * `deviceId` picks the input (falls back to the default when it is gone); `request` changes identity when it changes,
 * so callers that start the check in an effect on `request` restart it on the new device.
 */
export function useMicCheck(deviceId: string | null = null): UseMicCheck {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [level, setLevel] = useState(0);
  const cleanup = useRef<(() => void) | null>(null);
  const run = useRef(0);

  const stop = useCallback(() => {
    run.current += 1;
    cleanup.current?.();
    cleanup.current = null;
    setLevel(0);
    setStatus((s) => (s === "unsupported" || s === "blocked" ? s : "idle"));
  }, []);

  const request = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }
    cleanup.current?.();
    cleanup.current = null;
    const id = ++run.current;
    setLevel(0);
    setStatus("requesting");

    navigator.mediaDevices
      .getUserMedia({ audio: deviceId ? { deviceId: { ideal: deviceId } } : true })
      .then((stream) => {
        if (run.current !== id) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) {
          stream.getTracks().forEach((t) => t.stop());
          setStatus("unsupported");
          return;
        }
        const ctx = new Ctx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        let lastSound = performance.now();
        let smooth = 0;
        let raf = 0;

        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / data.length);
          const next = Math.min(1, rms * 4);
          smooth = Math.max(next, smooth * 0.85);
          setLevel(smooth);
          if (rms > SOUND_THRESHOLD) {
            lastSound = performance.now();
            setStatus((s) => (s === "quiet" ? "working" : s));
          } else if (performance.now() - lastSound > QUIET_AFTER_MS) {
            setStatus((s) => (s === "working" ? "quiet" : s));
          }
          raf = requestAnimationFrame(tick);
        };
        setStatus("working");
        raf = requestAnimationFrame(tick);

        cleanup.current = () => {
          cancelAnimationFrame(raf);
          stream.getTracks().forEach((t) => t.stop());
          void ctx.close();
        };
      })
      .catch((err: unknown) => {
        if (run.current !== id) return;
        const name = err instanceof DOMException ? err.name : "";
        setStatus(name === "NotFoundError" ? "unsupported" : "blocked");
      });
  }, [deviceId]);

  useEffect(
    () => () => {
      run.current += 1;
      cleanup.current?.();
      cleanup.current = null;
    },
    [],
  );

  return { status, level, request, stop };
}
