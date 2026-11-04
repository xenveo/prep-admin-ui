"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { connectPreviewLive } from "@/services/preview";

/**
 * idle: not joined yet · connecting · live · dropped: connection lost or the server ended the live
 * voice (offer Reconnect) · closed: we hung up.
 */
export type LiveStatus = "idle" | "connecting" | "live" | "dropped" | "closed";
export type CaptionSpeaker = "interviewer" | "candidate";
export type Caption = { id: number; speaker: CaptionSpeaker; text: string };

const ICE_GATHERING_CAP_MS = 3000;
const CLOSE_ACK_CAP_MS = 2000;
const MAX_CAPTIONS = 60;

function iceGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => { window.clearTimeout(timer); pc.removeEventListener("icegatheringstatechange", check); resolve(); };
    const check = () => { if (pc.iceGatheringState === "complete") done(); };
    const timer = window.setTimeout(done, ICE_GATHERING_CAP_MS);
    pc.addEventListener("icegatheringstatechange", check);
  });
}

function failureMessage(failure: unknown): string {
  const name = failure instanceof DOMException ? failure.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Microphone access is blocked. Allow the microphone in your browser settings, then reconnect.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No microphone was found. Connect one, then reconnect.";
  if (failure instanceof ApiError) {
    if (failure.status === 503) return "The AI interviewer is unavailable right now. Try reconnecting in a moment.";
    if (failure.status === 409) return "This interview is not taking live answers (it may be finished or every question is answered).";
    return failure.message;
  }
  return "The live interview could not connect. Check your connection and try again.";
}

type Connection = { pc: RTCPeerConnection; dc: RTCDataChannel; mic: MediaStream };

/**
 * WebRTC client for the OpenAI Live interview (LIVE_INTERVIEW_CONTRACT.md). The backend starts the
 * session from POST /sessions/:id/live and owns the conversation; the browser only streams audio,
 * shows transcript captions and may send close/mute. Mic and peer connection are released on
 * hang-up, reconnect and unmount.
 */
export function useLiveInterview(sessionId: string | null) {
  const [status, setStatus] = useState<LiveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [endReason, setEndReason] = useState<string | null>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [muted, setMuted] = useState(false);
  const [mic, setMic] = useState<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const connection = useRef<Connection | null>(null);
  /** Bumped on every connect/teardown so late async results and events from an old connection are ignored. */
  const generation = useRef(0);
  const closing = useRef(false);
  const closedAck = useRef<(() => void) | null>(null);
  const captionId = useRef(0);

  const teardown = useCallback(() => {
    generation.current++;
    const current = connection.current;
    connection.current = null;
    closedAck.current = null;
    if (current) {
      current.dc.onmessage = null;
      current.pc.onconnectionstatechange = null;
      current.pc.ontrack = null;
      try { current.dc.close(); } catch { /* already closed */ }
      current.pc.close();
      current.mic.getTracks().forEach((track) => track.stop());
    }
    if (audioRef.current) audioRef.current.srcObject = null;
    setMic(null);
  }, []);

  // Leaving the page or switching interviews: tell the server we left (best effort), then release
  // the mic and peer connection synchronously.
  useEffect(() => () => {
    const dc = connection.current?.dc;
    if (dc?.readyState === "open") { try { dc.send(JSON.stringify({ type: "session.close" })); } catch { /* closing */ } }
    closing.current = true;
    teardown();
    setCaptions([]);
    setStatus("idle");
  }, [sessionId, teardown]);

  const appendCaption = useCallback((speaker: CaptionSpeaker, delta: string) => {
    if (!delta) return;
    setCaptions((previous) => {
      const last = previous[previous.length - 1];
      if (last?.speaker === speaker) return [...previous.slice(0, -1), { ...last, text: last.text + delta }];
      return [...previous, { id: ++captionId.current, speaker, text: delta.trimStart() }].slice(-MAX_CAPTIONS);
    });
  }, []);

  const drop = useCallback((reason: string) => {
    if (closing.current) return;
    teardown();
    setEndReason(reason);
    setStatus("dropped");
  }, [teardown]);

  const connect = useCallback(async () => {
    if (!sessionId) return;
    teardown();
    const gen = generation.current;
    closing.current = false;
    setStatus("connecting");
    setError(null);
    setEndReason(null);
    setMuted(false);
    let stream: MediaStream | null = null;
    let pc: RTCPeerConnection | null = null;
    try {
      if (typeof RTCPeerConnection === "undefined" || !navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (gen !== generation.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      pc = new RTCPeerConnection();
      const peer = pc;
      peer.ontrack = (event) => {
        if (audioRef.current) audioRef.current.srcObject = event.streams[0] ?? new MediaStream([event.track]);
      };
      for (const track of stream.getAudioTracks()) peer.addTrack(track, stream);
      const dc = peer.createDataChannel("oai-events");
      connection.current = { pc: peer, dc, mic: stream };
      setMic(stream);
      dc.onmessage = (frame) => {
        if (gen !== generation.current || typeof frame.data !== "string") return;
        let event: { type?: unknown; delta?: unknown; reason?: unknown; message?: unknown; error?: unknown };
        try { event = JSON.parse(frame.data); } catch { return; }
        switch (event.type) {
          case "session.started": setStatus("live"); break;
          case "session.closed":
            closedAck.current?.();
            drop(typeof event.reason === "string" ? event.reason : "closed");
            break;
          case "session.input_transcript.delta": if (typeof event.delta === "string") appendCaption("candidate", event.delta); break;
          case "session.output_transcript.delta": if (typeof event.delta === "string") appendCaption("interviewer", event.delta); break;
          case "session.input_audio.muted": setMuted(true); break;
          case "session.input_audio.unmuted": setMuted(false); break;
          case "error": {
            const detail = event.error && typeof event.error === "object" && "message" in event.error ? (event.error as { message?: unknown }).message : event.message;
            setError(typeof detail === "string" && detail ? detail : "The live interviewer reported an error.");
            break;
          }
        }
      };
      peer.onconnectionstatechange = () => {
        if (gen !== generation.current) return;
        if (peer.connectionState === "connected") setStatus("live");
        else if (peer.connectionState === "failed" || peer.connectionState === "disconnected") drop("connection_lost");
      };
      await peer.setLocalDescription(await peer.createOffer());
      await iceGatheringComplete(peer);
      if (gen !== generation.current) return;
      const answer = await connectPreviewLive(sessionId, peer.localDescription!.sdp);
      if (gen !== generation.current) return;
      // Do not send session.start: the HTTP call already started the session.
      await peer.setRemoteDescription({ type: "answer", sdp: answer.sdp });
    } catch (failure) {
      if (gen !== generation.current) return;
      if (connection.current) teardown();
      else { stream?.getTracks().forEach((track) => track.stop()); pc?.close(); }
      setError(failure instanceof Error && failure.message === "unsupported" ? "This browser cannot run a live voice interview. Use a current Chrome, Edge, Firefox or Safari." : failureMessage(failure));
      setStatus("dropped");
    }
  }, [sessionId, teardown, appendCaption, drop]);

  /** Sends session.close, waits for session.closed (capped), then releases the connection and mic. */
  const hangUp = useCallback(async () => {
    const current = connection.current;
    closing.current = true;
    if (current?.dc.readyState === "open") {
      await new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, CLOSE_ACK_CAP_MS);
        closedAck.current = () => { window.clearTimeout(timer); resolve(); };
        try { current.dc.send(JSON.stringify({ type: "session.close" })); } catch { window.clearTimeout(timer); resolve(); }
      });
    }
    teardown();
    setStatus("closed");
  }, [teardown]);

  const setMute = useCallback((next: boolean) => {
    const current = connection.current;
    if (!current) return;
    // Disable the track locally as well, so nothing leaves the browser while muted.
    current.mic.getAudioTracks().forEach((track) => { track.enabled = !next; });
    if (current.dc.readyState === "open") current.dc.send(JSON.stringify({ type: next ? "session.input_audio.mute" : "session.input_audio.unmute" }));
    setMuted(next);
  }, []);

  /** The server's `live.ended` event (WS); ignored when we hung up ourselves. */
  const serverEnded = useCallback((reason: string) => {
    if (connection.current || status === "live" || status === "connecting") drop(reason);
  }, [drop, status]);

  return { status, error, endReason, captions, muted, mic, audioRef, connect, hangUp, setMute, serverEnded, clearError: () => setError(null) };
}
