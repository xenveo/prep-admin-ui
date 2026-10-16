"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Backend limits for a voice answer (MAX_ANSWER_SEC / MAX_AUDIO_BYTES). */
export const MAX_RECORDING_SEC = 300;
export const MAX_RECORDING_BYTES = 25 * 1024 * 1024;
/** Stop early enough that the final timeslice chunk cannot push the upload past the byte cap. */
const SIZE_HEADROOM = 512 * 1024;
const TIMESLICE_MS = 1000;
const MIME_PREFERENCE = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

export type VoiceRecording = { blob: Blob; url: string; durationSec: number; mimeType: string };
export type StopReason = "manual" | "time" | "size";
export type VoiceRecorderState =
  | { status: "idle" | "requesting" | "recording" | "denied" | "unsupported" }
  | { status: "stopped"; recording: VoiceRecording; reason: StopReason }
  | { status: "error"; message: string };

/** First MediaRecorder MIME type this browser supports, or null when voice capture is unavailable. */
export function pickRecorderMime(): string | null {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  return MIME_PREFERENCE.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

const subscribeNever = () => () => {};
/** Hydration-safe support check: false on the server, real capability on the client. */
export function useVoiceSupported(): boolean {
  return useSyncExternalStore(subscribeNever, () => pickRecorderMime() !== null, () => false);
}

function microphoneFailure(failure: unknown): VoiceRecorderState {
  const name = failure instanceof DOMException ? failure.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return { status: "denied" };
  if (name === "NotFoundError" || name === "OverconstrainedError") return { status: "unsupported" };
  return { status: "error", message: "The microphone could not be started. Try again." };
}

/**
 * Records one answer with MediaRecorder. Auto-stops at 300 s or ~25 MiB; microphone tracks and
 * the playback object URL are released on stop, reset and unmount.
 */
export function useVoiceRecorder() {
  const [state, setState] = useState<VoiceRecorderState>({ status: "idle" });
  const [elapsedSec, setElapsedSec] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const bytes = useRef(0);
  const startedAt = useRef(0);
  const ticker = useRef<number | null>(null);
  const url = useRef<string | null>(null);
  const generation = useRef(0);
  const stopReason = useRef<StopReason>("manual");

  const release = useCallback(() => {
    if (ticker.current !== null) { window.clearInterval(ticker.current); ticker.current = null; }
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);
  const revoke = useCallback(() => {
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = null;
  }, []);
  /** Drops any in-flight recording without emitting a result. */
  const teardown = useCallback(() => {
    generation.current++;
    const active = recorder.current;
    recorder.current = null;
    if (active) {
      active.ondataavailable = null; active.onstop = null; active.onerror = null;
      if (active.state !== "inactive") active.stop();
    }
    release(); revoke();
    chunks.current = []; bytes.current = 0;
  }, [release, revoke]);

  const finish = useCallback((reason: StopReason) => {
    const active = recorder.current;
    if (!active || active.state === "inactive") return;
    stopReason.current = reason;
    if (ticker.current !== null) { window.clearInterval(ticker.current); ticker.current = null; }
    active.stop();
  }, []);

  const start = useCallback(async () => {
    teardown();
    const mimeType = pickRecorderMime();
    if (!mimeType) { setState({ status: "unsupported" }); return; }
    const run = generation.current;
    setElapsedSec(0);
    setState({ status: "requesting" });
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (failure) {
      if (run === generation.current) setState(microphoneFailure(failure));
      return;
    }
    if (run !== generation.current) { media.getTracks().forEach((track) => track.stop()); return; }
    stream.current = media;
    let active: MediaRecorder;
    try {
      active = new MediaRecorder(media, { mimeType });
    } catch {
      release();
      setState({ status: "unsupported" });
      return;
    }
    active.ondataavailable = (event) => {
      if (run !== generation.current || !event.data.size) return;
      chunks.current.push(event.data);
      bytes.current += event.data.size;
      if (bytes.current >= MAX_RECORDING_BYTES - SIZE_HEADROOM) finish("size");
    };
    active.onerror = () => {
      if (run !== generation.current) return;
      teardown();
      setState({ status: "error", message: "Recording failed. Try again." });
    };
    active.onstop = () => {
      if (run !== generation.current) return;
      const elapsedMs = Date.now() - startedAt.current;
      recorder.current = null;
      release();
      const type = active.mimeType || mimeType;
      const blob = new Blob(chunks.current, { type });
      chunks.current = []; bytes.current = 0;
      if (!blob.size) { setState({ status: "error", message: "No audio was captured. Check your microphone and try again." }); return; }
      if (blob.size > MAX_RECORDING_BYTES) { setState({ status: "error", message: "The recording is larger than 25 MB. Record a shorter answer." }); return; }
      revoke();
      url.current = URL.createObjectURL(blob);
      const durationSec = Math.min(MAX_RECORDING_SEC, Math.max(1, Math.ceil(elapsedMs / 1000)));
      setElapsedSec(durationSec);
      setState({ status: "stopped", recording: { blob, url: url.current, durationSec, mimeType: type }, reason: stopReason.current });
    };
    stopReason.current = "manual";
    try {
      active.start(TIMESLICE_MS);
    } catch {
      teardown();
      setState({ status: "error", message: "Recording could not start. Try again." });
      return;
    }
    recorder.current = active;
    startedAt.current = Date.now();
    setState({ status: "recording" });
    ticker.current = window.setInterval(() => {
      const seconds = (Date.now() - startedAt.current) / 1000;
      setElapsedSec(Math.min(MAX_RECORDING_SEC, Math.floor(seconds)));
      if (seconds >= MAX_RECORDING_SEC) finish("time");
    }, 250);
  }, [teardown, release, revoke, finish]);

  const stop = useCallback(() => finish("manual"), [finish]);
  const reset = useCallback(() => {
    teardown();
    setElapsedSec(0);
    setState({ status: "idle" });
  }, [teardown]);

  useEffect(() => teardown, [teardown]);

  return { state, elapsedSec, start, stop, reset };
}
export type VoiceRecorder = ReturnType<typeof useVoiceRecorder>;
